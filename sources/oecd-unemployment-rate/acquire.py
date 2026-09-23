"""Faithful acquisition of OECD harmonised monthly unemployment rates.

The provider answers a pinned SDMX key as SDMX-CSV 2.0 with `labels=both`, so
every dimension arrives as one column holding `"<code>: <label>"`. Both halves
are kept exactly as sent: the labels are the OECD's own country names, and a
consumer that re-invented them would be inventing data. Splitting the composite
value is a decoding decision for a dataset, not for acquisition.
"""

import csv
import io
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "oecd-sdmx-csv2-monthly-v1"
AREA = "REF_AREA: Reference area"
PERIOD = "TIME_PERIOD: Time period"
VALUE = "OBS_VALUE: Observation value"
MONTH = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")
MONTH_END = {
    "01": 31, "02": 28, "03": 31, "04": 30, "05": 31, "06": 30,
    "07": 31, "08": 31, "09": 30, "10": 31, "11": 30, "12": 31,
}
# The United Kingdom's rolling-quarter survey sits about three months behind the
# publication edge, so a tighter tolerance than this would report the OECD's
# ordinary reporting spread as a fault.
# Measured over every area in the response. On 2026-09-14 the widest lag was
# three months, for the United Kingdom's rolling-quarter survey.
MAXIMUM_AREA_LAG_MONTHS = 4
# sdmx.oecd.org answers 403 to urllib's default `Python-urllib/3.x` agent, so
# every request names the pipeline making it.
USER_AGENT = "pulse-data-pipeline/1.0"


def _read(url: str, media_type: str, *, fixture: Path | None, live: bool) -> str:
    if fixture is not None:
        try:
            return fixture.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as error:
            raise SourceAcquisitionError("recorded source fixture could not be read") from error
    if not live:
        raise SourceAcquisitionError("live acquisition is opt-in")
    request = Request(url, headers={"Accept": media_type, "User-Agent": USER_AGENT})
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
    code, separator, label = value.partition(":")
    return label.strip() if separator else ""


def _month_end(period: str) -> str:
    matched = MONTH.fullmatch(period)
    if matched is None:
        raise SourceAcquisitionError("OECD returned an unexpected period format")
    year, month = matched.group(1), matched.group(2)
    day = 29 if month == "02" and _is_leap(int(year)) else MONTH_END[month]
    return f"{year}-{month}-{day:02d}"


def _is_leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def _months_between(earlier: str, later: str) -> int:
    start, end = MONTH.fullmatch(earlier), MONTH.fullmatch(later)
    if start is None or end is None:
        raise SourceAcquisitionError("OECD returned an unexpected period format")
    return (int(end.group(1)) - int(start.group(1))) * 12 + int(end.group(2)) - int(start.group(2))


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    payload = _read(
        configuration["url"], configuration["media_type"], fixture=fixture, live=live
    )
    reader = csv.DictReader(io.StringIO(payload))
    key = configuration.get("key", {})
    required_columns = set(key) | {AREA, PERIOD, VALUE}
    if reader.fieldnames is None or not required_columns <= set(reader.fieldnames):
        raise SourceAcquisitionError("OECD response is missing declared SDMX dimensions")
    duplicated = [name for name in reader.fieldnames if reader.fieldnames.count(name) > 1]
    if duplicated:
        raise SourceAcquisitionError("OECD response repeats a column name")

    rows = [{name: str(value or "") for name, value in row.items() if name is not None} for row in reader]
    if not rows:
        raise SourceAcquisitionError("OECD returned no observations")

    # The request pins one series per reference area. A response that widens
    # beyond that key describes something other than what was declared.
    for dimension, expected in key.items():
        if {_code(row.get(dimension, "")) for row in rows} != {str(expected)}:
            raise SourceAcquisitionError(f"OECD returned unexpected values for dimension {dimension}")

    areas = {_code(row[AREA]) for row in rows}

    periods = {row[PERIOD] for row in rows}
    numeric = [row for row in rows if _is_number(row[VALUE])]
    # The represented date is the provider's publication edge: the newest month
    # the OECD published anything for. It answers "did the OECD release", which
    # is what the source-level deadline judges. Reference areas reach that edge
    # at different speeds, and that spread is real provider structure for a
    # dataset and a report to show rather than something to hide by back-dating
    # the whole snapshot to the slowest member.
    edge = max(periods)
    # Measured across every area the provider sent, not a chosen few: the
    # slowest reporter is what says whether the release is usable, and
    # naming a subset here would import a consumer's preferences.
    complete = _latest_complete_period(rows, sorted(areas))
    return AdapterAcquisition(
        rows,
        _month_end(edge),
        [configuration["url"]],
        DECODER_VERSION,
        assertions=(
            {"check": "every_observation_value_is_numeric", "passed": len(numeric) == len(rows)},
            {
                "check": "every_rate_lies_within_zero_and_one_hundred",
                "passed": all(0.0 <= float(row[VALUE]) <= 100.0 for row in numeric),
            },
            {
                "check": "every_period_is_a_calendar_month",
                "passed": all(MONTH.fullmatch(period) for period in periods),
            },
            {
                "check": "every_reference_area_is_within_four_months_of_the_publication_edge",
                "passed": _months_between(complete, edge) <= MAXIMUM_AREA_LAG_MONTHS,
            },
            {
                "check": "every_reference_area_carries_both_a_code_and_a_label",
                "passed": all(_code(row[AREA]) and _label(row[AREA]) for row in rows),
            },
        ),
    )


def _latest_complete_period(rows: list[dict[str, str]], required: list[str]) -> str:
    """The newest month for which every one of `required` has a value."""
    if not required:
        return max(row[PERIOD] for row in rows)
    by_period: dict[str, set[str]] = {}
    for row in rows:
        if _is_number(row[VALUE]):
            by_period.setdefault(row[PERIOD], set()).add(_code(row[AREA]))
    complete = [period for period, areas in by_period.items() if areas.issuperset(required)]
    if not complete:
        raise SourceAcquisitionError("no period carries every required reference area")
    return max(complete)


def _is_number(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return True
