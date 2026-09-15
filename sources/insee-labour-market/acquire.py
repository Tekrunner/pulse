"""Faithful acquisition of the declared INSEE BDM quarterly ILO labour-market series.

The adapter decodes one combined SDMX 2.1 `StructureSpecificData` response and
emits one provider-native row per observation. It renames nothing, types
nothing, calculates nothing, and classifies nothing: every analytical decision
about what these series mean belongs to a dataset package.
"""

from pathlib import Path
import re
import xml.etree.ElementTree as ElementTree
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "insee-bdm-sdmx-quarterly-v1"
MEDIA_TYPE = "application/vnd.sdmx.structurespecificdata+xml;version=2.1"
# INSEE writes quarters as `YYYY-Qn`; nothing else is expected at this cadence.
QUARTER = re.compile(r"^(\d{4})-Q([1-4])$")
# The last day of each quarter, so the represented date is genuinely the end of
# the period the observation describes. `pulse` derives the publication deadline
# from that end, and a quarterly deadline built from a quarter *start* would
# land one whole quarter early.
QUARTER_END = {"1": "03-31", "2": "06-30", "3": "09-30", "4": "12-31"}


def _read(url: str, *, fixture: Path | None, live: bool) -> bytes:
    if fixture is not None:
        try:
            return fixture.read_bytes()
        except OSError as error:
            raise SourceAcquisitionError("recorded source fixture could not be read") from error
    if not live:
        raise SourceAcquisitionError("live acquisition is opt-in")
    request = Request(url, headers={"Accept": MEDIA_TYPE})
    try:
        with urlopen(request, timeout=30) as response:  # nosec B310: declared public HTTPS URL
            return response.read()
    except HTTPError as error:
        raise SourceAcquisitionError(
            "INSEE BDM HTTP request failed",
            retryable=error.code == 429 or error.code >= 500,
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise SourceAcquisitionError("INSEE BDM transport failed", retryable=True) from error


def _series_elements(payload: bytes) -> list[ElementTree.Element]:
    try:
        root = ElementTree.fromstring(payload)  # nosec B314: provider XML, no entity expansion used
    except ElementTree.ParseError as error:
        raise SourceAcquisitionError("INSEE BDM response is not well-formed XML") from error
    return [element for element in root.iter() if element.tag.rpartition("}")[2] == "Series"]


def _declared_series(configuration: dict) -> dict[str, str]:
    declared = configuration.get("series")
    if not isinstance(declared, list) or not declared:
        raise SourceAcquisitionError("source declaration carries no provider series scope")
    scope: dict[str, str] = {}
    for entry in declared:
        identifier, name = entry.get("id"), entry.get("name")
        if not isinstance(identifier, str) or not isinstance(name, str) or identifier in scope:
            raise SourceAcquisitionError("declared provider series scope is invalid or duplicated")
        scope[identifier] = name
    return scope


def _represented_date(periods: set[str]) -> str:
    """Derive the represented date from the greatest provider `TIME_PERIOD`."""
    latest = max(periods)
    matched = QUARTER.fullmatch(latest)
    if matched is None:
        raise SourceAcquisitionError("INSEE BDM returned an unexpected period format")
    return f"{matched.group(1)}-{QUARTER_END[matched.group(2)]}"


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    scope = _declared_series(configuration)
    elements = _series_elements(_read(configuration["url"], fixture=fixture, live=live))

    rows: list[dict[str, str]] = []
    periods: set[str] = set()
    observed: dict[str, str] = {}
    for element in elements:
        attributes = dict(element.attrib)
        identifier = attributes.get("IDBANK")
        if not isinstance(identifier, str) or identifier in observed:
            raise SourceAcquisitionError("INSEE BDM returned a missing or duplicate series identity")
        observed[identifier] = attributes.get("TITLE_FR", "")
        for observation in element:
            row = attributes | dict(observation.attrib)
            period, value = row.get("TIME_PERIOD"), row.get("OBS_VALUE")
            if not isinstance(period, str) or not isinstance(value, str):
                raise SourceAcquisitionError("INSEE BDM returned an observation without period or value")
            periods.add(period)
            rows.append({key: str(field) for key, field in row.items()})

    # Scope checks are structural, not analytical: a series that disappeared, a
    # series that arrived unannounced, or a series whose provider title changed
    # all mean the declaration no longer describes what was fetched.
    if set(observed) != set(scope):
        raise SourceAcquisitionError("INSEE BDM series scope does not match the declaration")
    if any(observed[identifier] != title for identifier, title in scope.items()):
        raise SourceAcquisitionError("INSEE BDM renamed a declared series")
    if not rows:
        raise SourceAcquisitionError("INSEE BDM returned no observations")

    quarterly = all(row.get("FREQ") == "T" for row in rows)
    numeric = all(_is_number(row["OBS_VALUE"]) for row in rows)
    rate_bounds = all(
        0.0 <= float(row["OBS_VALUE"]) <= 100.0
        for row in rows
        if row.get("UNIT_MEASURE") == "POURCENT" and _is_number(row["OBS_VALUE"])
    )
    return AdapterAcquisition(
        rows,
        _represented_date(periods),
        [configuration["url"]],
        DECODER_VERSION,
        assertions=(
            {"check": "every_observation_is_quarterly", "passed": quarterly},
            {"check": "every_observation_value_is_numeric", "passed": numeric},
            {"check": "percentage_observations_lie_within_zero_and_one_hundred", "passed": rate_bounds},
            {"check": "every_declared_series_carries_observations", "passed": len(observed) == len(scope)},
        ),
    )


def _is_number(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return True
