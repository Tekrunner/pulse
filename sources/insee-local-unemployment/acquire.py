"""Faithful acquisition of the declared INSEE localised unemployment rate series.

One combined SDMX 2.1 `StructureSpecificData` response covering every published
territory becomes one provider-native row per observation. The adapter checks
that the territorial scope it was promised is the territorial scope it received;
it makes no analytical claim about what any rate means or how territories relate.
"""

from pathlib import Path
import re
import xml.etree.ElementTree as ElementTree
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "insee-bdm-sdmx-localised-v1"
MEDIA_TYPE = "application/vnd.sdmx.structurespecificdata+xml;version=2.1"
QUARTER = re.compile(r"^(\d{4})-Q([1-4])$")
# The represented date is the END of the quarter, because `pulse` derives the
# publication deadline by advancing one period from it; a deadline built from a
# quarter start would fall a whole quarter early.
QUARTER_END = {"1": "03-31", "2": "06-30", "3": "09-30", "4": "12-31"}
# INSEE codes departements as `D` plus the official departement code.
DEPARTEMENT = re.compile(r"^D(?:\d{2}|2A|2B|\d{3})$")
EXPECTED_DEPARTEMENTS = 100


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


def _declared_series(configuration: dict) -> dict[str, tuple[str, str]]:
    declared = configuration.get("series")
    if not isinstance(declared, list) or not declared:
        raise SourceAcquisitionError("source declaration carries no provider series scope")
    scope: dict[str, tuple[str, str]] = {}
    for entry in declared:
        identifier, area, name = entry.get("id"), entry.get("ref_area"), entry.get("name")
        if (
            not isinstance(identifier, str)
            or not isinstance(area, str)
            or not isinstance(name, str)
            or identifier in scope
        ):
            raise SourceAcquisitionError("declared provider series scope is invalid or duplicated")
        scope[identifier] = (area, name)
    if len({area for area, _ in scope.values()}) != len(scope):
        raise SourceAcquisitionError("declared provider series scope repeats a territory")
    return scope


def _represented_date(periods: set[str]) -> str:
    matched = QUARTER.fullmatch(max(periods))
    if matched is None:
        raise SourceAcquisitionError("INSEE BDM returned an unexpected period format")
    return f"{matched.group(1)}-{QUARTER_END[matched.group(2)]}"


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    scope = _declared_series(configuration)
    try:
        root = ElementTree.fromstring(  # nosec B314: provider XML, no entity expansion used
            _read(configuration["url"], fixture=fixture, live=live)
        )
    except ElementTree.ParseError as error:
        raise SourceAcquisitionError("INSEE BDM response is not well-formed XML") from error

    rows: list[dict[str, str]] = []
    periods: set[str] = set()
    observed: dict[str, tuple[str, str]] = {}
    for element in root.iter():
        if element.tag.rpartition("}")[2] != "Series":
            continue
        attributes = dict(element.attrib)
        identifier = attributes.get("IDBANK")
        if not isinstance(identifier, str) or identifier in observed:
            raise SourceAcquisitionError("INSEE BDM returned a missing or duplicate series identity")
        observed[identifier] = (attributes.get("REF_AREA", ""), attributes.get("TITLE_FR", ""))
        for observation in element:
            row = attributes | dict(observation.attrib)
            period, value = row.get("TIME_PERIOD"), row.get("OBS_VALUE")
            if not isinstance(period, str) or not isinstance(value, str):
                raise SourceAcquisitionError("INSEE BDM returned an observation without period or value")
            periods.add(period)
            rows.append({key: str(field) for key, field in row.items()})

    if set(observed) != set(scope):
        raise SourceAcquisitionError("INSEE BDM territorial scope does not match the declaration")
    for identifier, (area, title) in scope.items():
        if observed[identifier][0] != area:
            raise SourceAcquisitionError("INSEE BDM moved a declared series to another territory")
        if observed[identifier][1] != title:
            raise SourceAcquisitionError("INSEE BDM renamed a declared series")
    if not rows:
        raise SourceAcquisitionError("INSEE BDM returned no observations")

    areas = {area for area, _ in observed.values()}
    departements = {area for area in areas if DEPARTEMENT.fullmatch(area)}
    numeric = [row for row in rows if _is_number(row["OBS_VALUE"])]
    return AdapterAcquisition(
        rows,
        _represented_date(periods),
        [configuration["url"]],
        DECODER_VERSION,
        assertions=(
            {"check": "every_observation_is_quarterly", "passed": all(row.get("FREQ") == "T" for row in rows)},
            {"check": "every_observation_value_is_numeric", "passed": len(numeric) == len(rows)},
            {
                "check": "every_rate_lies_within_zero_and_one_hundred",
                "passed": all(0.0 <= float(row["OBS_VALUE"]) <= 100.0 for row in numeric),
            },
            {
                "check": "one_hundred_departements_are_present",
                "passed": len(departements) == EXPECTED_DEPARTEMENTS,
            },
            {
                "check": "every_territory_shares_the_latest_period",
                "passed": len({
                    max(row["TIME_PERIOD"] for row in rows if row["IDBANK"] == identifier)
                    for identifier in observed
                }) == 1,
            },
        ),
    )


def _is_number(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return True
