"""Faithful acquisition of OECD quarterly labour force participation rates.

Same provider and representation as `oecd-unemployment-rate`, but a quarterly
frequency and an open `SEX` dimension: total, men and women all arrive, because
the participation gap between men and women is one of the questions this data
exists to answer. Every dimension arrives as one column holding
`"<code>: <label>"` and both halves are kept exactly as sent.
"""

import csv
import io
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "oecd-sdmx-csv2-quarterly-v1"
AREA = "REF_AREA: Reference area"
SEX = "SEX: Sex"
PERIOD = "TIME_PERIOD: Time period"
VALUE = "OBS_VALUE: Observation value"
QUARTER = re.compile(r"^(\d{4})-Q([1-4])$")
# The last day of each quarter, so the represented date is the end of the period
# the observation describes; `pulse` advances one period from it to find the
# publication deadline.
QUARTER_END = {"1": "03-31", "2": "06-30", "3": "09-30", "4": "12-31"}
# Measured over every area still being published. On 2026-09-14 the widest
# lag was one quarter for 17 areas and two for Iceland, so three leaves a
# quarter of headroom over ordinary provider variation.
MAXIMUM_REPORTING_AREA_LAG_QUARTERS = 3


def _read(url: str, media_type: str, *, fixture: Path | None, live: bool) -> str:
    if fixture is not None:
        try:
            return fixture.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as error:
            raise SourceAcquisitionError("recorded source fixture could not be read") from error
    if not live:
        raise SourceAcquisitionError("live acquisition is opt-in")
    request = Request(url, headers={"Accept": media_type})
    try:
        with urlopen(request, timeout=30) as response:  # nosec B310: declared public HTTPS URL
            return response.read().decode("utf-8")
    except HTTPError as error:
        raise SourceAcquisitionError(
            "OECD SDMX HTTP request failed",
            retryable=error.code == 429 or error.code >= 500,
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise SourceAcquisitionError("OECD SDMX transport failed", retryable=True) from error
    except UnicodeDecodeError as error:
        raise SourceAcquisitionError("OECD SDMX response is not valid UTF-8") from error


def _code(value: str) -> str:
    """The code half of a `"<code>: <label>"` SDMX-CSV 2.0 value."""
    return value.split(":", 1)[0].strip()


def _label(value: str) -> str:
    _, separator, label = value.partition(":")
    return label.strip() if separator else ""


def _quarter_end(period: str) -> str:
    matched = QUARTER.fullmatch(period)
    if matched is None:
        raise SourceAcquisitionError("OECD returned an unexpected period format")
    return f"{matched.group(1)}-{QUARTER_END[matched.group(2)]}"


def _quarters_between(earlier: str, later: str) -> int:
    start, end = QUARTER.fullmatch(earlier), QUARTER.fullmatch(later)
    if start is None or end is None:
        raise SourceAcquisitionError("OECD returned an unexpected period format")
    return (int(end.group(1)) - int(start.group(1))) * 4 + int(end.group(2)) - int(start.group(2))


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    payload = _read(configuration["url"], configuration["media_type"], fixture=fixture, live=live)
    reader = csv.DictReader(io.StringIO(payload))
    key = configuration.get("key", {})
    if reader.fieldnames is None or not set(key) | {AREA, SEX, PERIOD, VALUE} <= set(reader.fieldnames):
        raise SourceAcquisitionError("OECD response is missing declared SDMX dimensions")
    if [name for name in reader.fieldnames if reader.fieldnames.count(name) > 1]:
        raise SourceAcquisitionError("OECD response repeats a column name")

    rows = [{name: str(value or "") for name, value in row.items() if name is not None} for row in reader]
    if not rows:
        raise SourceAcquisitionError("OECD returned no observations")

    for dimension, expected in key.items():
        if {_code(row.get(dimension, "")) for row in rows} != {str(expected)}:
            raise SourceAcquisitionError(f"OECD returned unexpected values for dimension {dimension}")

    required_sexes = list(configuration.get("required_sexes", []))
    sexes = {_code(row[SEX]) for row in rows}
    if not sexes <= set(required_sexes) or not set(required_sexes) <= sexes:
        raise SourceAcquisitionError("OECD returned an unexpected set of sex breakdowns")

    # Areas the provider has stopped publishing are held out of the edge check;
    # which areas must exist at all is the dataset package's question, not this
    # one.
    discontinued = set(configuration.get("discontinued_reference_areas", []))
    areas = {_code(row[AREA]) for row in rows} - discontinued

    periods = {row[PERIOD] for row in rows}
    numeric = [row for row in rows if _is_number(row[VALUE])]
    edge = max(periods)
    complete = _latest_complete_period(rows, sorted(areas))
    return AdapterAcquisition(
        rows,
        _quarter_end(edge),
        [configuration["url"]],
        DECODER_VERSION,
        assertions=(
            {"check": "every_observation_value_is_numeric", "passed": len(numeric) == len(rows)},
            {
                "check": "every_rate_lies_within_zero_and_one_hundred",
                "passed": all(0.0 <= float(row[VALUE]) <= 100.0 for row in numeric),
            },
            {
                "check": "every_period_is_a_calendar_quarter",
                "passed": all(QUARTER.fullmatch(period) for period in periods),
            },
            {
                "check": "every_reporting_reference_area_is_within_three_quarters_of_the_publication_edge",
                "passed": _quarters_between(complete, edge) <= MAXIMUM_REPORTING_AREA_LAG_QUARTERS,
            },
            {
                "check": "every_reference_area_carries_both_a_code_and_a_label",
                "passed": all(_code(row[AREA]) and _label(row[AREA]) for row in rows),
            },
            {
                # A participation gap cannot be drawn from a total alone.
                # Every area is checked except those declared as carrying a
                # known provider gap, which is the opposite of naming the few
                # areas a consumer happens to draw.
                "check": "men_and_women_are_reported_wherever_a_total_is",
                "passed": _sex_coverage_is_complete(
                    rows, required_sexes, configuration.get("sex_incomplete_reference_areas", [])
                ),
            },
        ),
    )


def _latest_complete_period(rows: list[dict[str, str]], required: list[str]) -> str:
    """The newest quarter carrying an observation for every one of `required`.

    Presence only: whether an area also carries its men/women split is a
    separate assertion, and folding it in here would let a declared provider
    gap masquerade as a publication delay.
    """
    if not required:
        return max(row[PERIOD] for row in rows)
    by_period: dict[str, set[str]] = {}
    for row in rows:
        if _is_number(row[VALUE]):
            by_period.setdefault(row[PERIOD], set()).add(_code(row[AREA]))
    complete = [period for period, seen in by_period.items() if seen.issuperset(required)]
    if not complete:
        raise SourceAcquisitionError("no quarter carries every reporting reference area")
    return max(complete)


def _sex_coverage_is_complete(
    rows: list[dict[str, str]], sexes: list[str], excluded: list[str]
) -> bool:
    """Every area outside `excluded` reports all sexes in every quarter it
    reports at all."""
    wanted, skip = set(sexes), set(excluded)
    seen: dict[tuple[str, str], set[str]] = {}
    for row in rows:
        area = _code(row[AREA])
        if area not in skip and _is_number(row[VALUE]):
            seen.setdefault((area, row[PERIOD]), set()).add(_code(row[SEX]))
    return bool(seen) and all(observed == wanted for observed in seen.values())


def _is_number(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return True
