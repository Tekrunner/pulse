"""Faithful acquisition of the declared INSEE annual national-accounts dataflows.

The adapter requests each declared SDMX 2.1 dataflow whole, decodes every
`StructureSpecificData` response and emits one provider-native row per
observation. Series attributes differ between dataflows (a branch account
carries `CNA_ACTIVITE`, the employment table `CNA_TYPE_EMP`); each row keeps the
attributes its own series carries and nothing else. The adapter renames
nothing, types nothing, calculates nothing, and classifies nothing: every
analytical decision about what these series mean belongs to a dataset package.
"""

from pathlib import Path
import re
import xml.etree.ElementTree as ElementTree
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "insee-bdm-sdmx-annual-dataflows-v1"
MEDIA_TYPE = "application/vnd.sdmx.structurespecificdata+xml;version=2.1"
YEAR = re.compile(r"^\d{4}$")
# The provider's total-economy branch code. Series carrying it are the ones a
# release must advance, which is what makes them the currency probe.
TOTAL_ECONOMY = "NNTOTAL"


def _declared_dataflows(configuration: dict) -> list[str]:
    declared = configuration.get("dataflows")
    if not isinstance(declared, list) or not declared:
        raise SourceAcquisitionError("source declaration carries no provider dataflow scope")
    identifiers = [entry.get("id") if isinstance(entry, dict) else None for entry in declared]
    if not all(isinstance(identifier, str) and identifier for identifier in identifiers):
        raise SourceAcquisitionError("declared provider dataflow scope is invalid")
    if len(set(identifiers)) != len(identifiers):
        raise SourceAcquisitionError("declared provider dataflow scope is duplicated")
    return identifiers


def _url(configuration: dict, dataflow: str) -> str:
    base = configuration.get("url")
    if not isinstance(base, str) or not base.startswith("https://") or not base.endswith("/"):
        raise SourceAcquisitionError("source declaration carries no HTTPS dataflow base URL")
    return base + dataflow


def _read(url: str, dataflow: str, *, fixture: Path | None, live: bool) -> bytes:
    if fixture is not None:
        try:
            return (fixture / f"{dataflow}.xml").read_bytes()
        except OSError as error:
            raise SourceAcquisitionError("recorded source fixture could not be read") from error
    if not live:
        raise SourceAcquisitionError("live acquisition is opt-in")
    request = Request(url, headers={"Accept": MEDIA_TYPE})
    try:
        with urlopen(request, timeout=120) as response:  # nosec B310: declared public HTTPS URL
            return response.read()
    except HTTPError as error:
        raise SourceAcquisitionError(
            "INSEE BDM HTTP request failed",
            retryable=error.code == 429 or error.code >= 500,
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise SourceAcquisitionError("INSEE BDM transport failed", retryable=True) from error


def _local(element: ElementTree.Element) -> str:
    return element.tag.rpartition("}")[2]


def _decode(payload: bytes, dataflow: str) -> list[ElementTree.Element]:
    try:
        root = ElementTree.fromstring(payload)  # nosec B314: provider XML, no entity expansion used
    except ElementTree.ParseError as error:
        raise SourceAcquisitionError("INSEE BDM response is not well-formed XML") from error
    # The response names the dataflow it answers. A response for another
    # dataflow would be decoded faithfully and archived under the wrong scope.
    answered = {element.get("id") for element in root.iter() if _local(element) == "Ref"}
    if answered != {dataflow}:
        raise SourceAcquisitionError("INSEE BDM response does not answer the declared dataflow")
    series = [element for element in root.iter() if _local(element) == "Series"]
    if not series:
        raise SourceAcquisitionError("INSEE BDM returned a dataflow without series")
    return series


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    dataflows = _declared_dataflows(configuration)

    rows: list[dict[str, str]] = []
    urls: list[str] = []
    identities: set[str] = set()
    # Latest year per series, and which series describe the total economy.
    series_latest: dict[str, str] = {}
    total_economy: set[str] = set()
    distinct = True
    for dataflow in dataflows:
        url = _url(configuration, dataflow)
        urls.append(url)
        keys: set[tuple] = set()
        for element in _decode(_read(url, dataflow, fixture=fixture, live=live), dataflow):
            attributes = dict(element.attrib)
            identifier = attributes.get("IDBANK")
            if not isinstance(identifier, str) or identifier in identities:
                raise SourceAcquisitionError("INSEE BDM returned a missing or duplicate series identity")
            identities.add(identifier)
            key = tuple(sorted(
                (name, value) for name, value in attributes.items()
                if name not in {"IDBANK", "TITLE_FR", "TITLE_EN", "LAST_UPDATE", "DECIMALS"}
            ))
            distinct &= key not in keys
            keys.add(key)
            if attributes.get("CNA_ACTIVITE", TOTAL_ECONOMY) == TOTAL_ECONOMY:
                total_economy.add(identifier)
            observations = [child for child in element if _local(child) == "Obs"]
            if not observations:
                raise SourceAcquisitionError("INSEE BDM returned a series without observations")
            for observation in observations:
                row = attributes | dict(observation.attrib)
                period, value = row.get("TIME_PERIOD"), row.get("OBS_VALUE")
                if not isinstance(period, str) or not isinstance(value, str):
                    raise SourceAcquisitionError("INSEE BDM returned an observation without period or value")
                if YEAR.fullmatch(period) is None:
                    raise SourceAcquisitionError("INSEE BDM returned an unexpected period format")
                series_latest[identifier] = max(series_latest.get(identifier, period), period)
                rows.append({name: str(field) for name, field in row.items()})

    latest = max(series_latest.values())
    annual = all(row.get("FREQ") == "A" for row in rows)
    numeric = all(_is_number(row["OBS_VALUE"]) for row in rows)
    # Currency: a release advances the total economy in every dataflow. Detailed
    # branches may legitimately stop a year earlier, and some duplicate branch
    # series have not been extended since the base was launched, so only the
    # total-economy series are required to reach the latest year.
    current = all(series_latest[identifier] == latest for identifier in total_economy)
    return AdapterAcquisition(
        rows,
        f"{latest}-12-31",
        urls,
        DECODER_VERSION,
        assertions=(
            {"check": "every_observation_is_annual", "passed": annual},
            {"check": "every_observation_value_is_numeric", "passed": numeric},
            {"check": "every_series_has_a_distinct_dimension_key_within_its_dataflow", "passed": distinct},
            {"check": "every_total_economy_series_reaches_the_latest_year", "passed": current and bool(total_economy)},
        ),
    )


def _is_number(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return True
