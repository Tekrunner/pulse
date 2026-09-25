"""Faithful acquisition of the declared OECD Productivity Database measures.

The provider answers a pinned SDMX key as SDMX-CSV 2.0 with `labels=both`, so
every dimension arrives as one column holding `"<code>: <label>"`. Both halves
are kept exactly as sent. The response mixes, for each measure, several units,
price bases and transformations (levels and growth rates); every one is retained
as a provider row, because choosing among them is a dataset's decision.
"""

import csv
import io
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "oecd-sdmx-csv2-annual-v1"
AREA = "REF_AREA: Reference area"
MEASURE = "MEASURE: Measure"
UNIT = "UNIT_MEASURE: Unit of measure"
PRICE_BASE = "PRICE_BASE: Price base"
TRANSFORMATION = "TRANSFORMATION: Transformation"
PERIOD = "TIME_PERIOD: Time period"
VALUE = "OBS_VALUE: Observation value"
YEAR = re.compile(r"^\d{4}$")
# The provider refuses Python's default `Python-urllib` user agent with HTTP
# 403 (observed 2026-09-23), so the request names the pipeline that sends it.
USER_AGENT = "pulse-data-pipeline/1.0"
# The level of GDP in national currency at current prices: the one series every
# reference area publishes first, and so the probe of whether a year has been
# released rather than merely begun by an early reporter.
GDP_LEVEL = {MEASURE: "GDP", UNIT: "XDC", PRICE_BASE: "V", TRANSFORMATION: "N"}


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
        with urlopen(request, timeout=120) as response:  # nosec B310: declared public HTTPS URL
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
    _code_part, separator, label = value.partition(":")
    return label.strip() if separator else ""


def _is_number(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return True


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    payload = _read(configuration["url"], configuration["media_type"], fixture=fixture, live=live)
    reader = csv.DictReader(io.StringIO(payload))
    key = configuration.get("key", {})
    required_columns = set(key) | {AREA, PERIOD, VALUE, UNIT, PRICE_BASE, TRANSFORMATION}
    if reader.fieldnames is None or not required_columns <= set(reader.fieldnames):
        raise SourceAcquisitionError("OECD response is missing declared SDMX dimensions")
    if len(set(reader.fieldnames)) != len(reader.fieldnames):
        raise SourceAcquisitionError("OECD response repeats a column name")

    rows = [{name: str(value or "") for name, value in row.items() if name is not None} for row in reader]
    if not rows:
        raise SourceAcquisitionError("OECD returned no observations")

    # The request pins frequency, activity and the set of measures. A response
    # that widens beyond that key describes something other than what was
    # declared; one that narrows it has lost a declared measure.
    for dimension, expected in key.items():
        allowed = {str(value) for value in expected} if isinstance(expected, list) else {str(expected)}
        if {_code(row.get(dimension, "")) for row in rows} != allowed:
            raise SourceAcquisitionError(f"OECD returned unexpected values for dimension {dimension}")

    # The provider emits a row with neither period nor value for a series key
    # it holds no observation for. Those rows are kept as sent; every other row
    # is an observation and must carry a calendar year.
    observations = [row for row in rows if row[PERIOD] or row[VALUE]]
    if not observations:
        raise SourceAcquisitionError("OECD returned no dated observations")
    if not all(YEAR.fullmatch(row[PERIOD]) for row in observations):
        raise SourceAcquisitionError("OECD returned an unexpected period format")
    identities = [
        tuple(row[name] for name in row if name not in {VALUE, "OBS_STATUS: Observation status"})
        for row in observations
    ]
    if len(set(identities)) != len(identities):
        raise SourceAcquisitionError("OECD returned a duplicate observation")

    edge = max(row[PERIOD] for row in observations)
    gdp_level = [row for row in observations if all(_code(row[name]) == code for name, code in GDP_LEVEL.items())]
    areas = {_code(row[AREA]) for row in gdp_level}
    at_edge = {_code(row[AREA]) for row in gdp_level if row[PERIOD] == edge and _is_number(row[VALUE])}
    return AdapterAcquisition(
        rows,
        f"{edge}-12-31",
        [configuration["url"]],
        DECODER_VERSION,
        assertions=(
            {"check": "every_observation_value_is_numeric", "passed": all(_is_number(row[VALUE]) for row in observations)},
            {"check": "every_reference_area_carries_both_a_code_and_a_label", "passed": all(_code(row[AREA]) and _label(row[AREA]) for row in rows)},
            # Areas report a year at different speeds, and that spread is real
            # provider structure. What would not be real is an edge set by a
            # handful of early reporters while most areas have not released.
            {"check": "most_reference_areas_publish_gdp_for_the_publication_edge", "passed": len(at_edge) * 2 > len(areas)},
        ),
    )
