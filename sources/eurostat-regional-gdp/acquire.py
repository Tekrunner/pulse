"""Acquire Eurostat GDP by NUTS 3 region as provider-native SDMX-CSV rows.

The upstream is an API response rather than a downloadable file, so the archive
keeps faithful rows: every column the provider sends is retained under its own
name and as the string it arrived as. Nothing here renames, types, calculates
or drops a field.
"""

import csv
import io
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "eurostat-regional-gdp-sdmx-csv-v1"
MEDIA_TYPE = "application/vnd.sdmx.data+csv;version=1.0.0"
# A two-letter geo code is a country (NUTS 0): the level every member reports,
# and so the one against which "has the year been released" is judged.
COUNTRY_CODE_LENGTH = 2


def _read(url: str, *, fixture: Path | None, live: bool) -> bytes:
    if fixture is not None:
        try:
            return fixture.read_bytes()
        except OSError as error:
            raise SourceAcquisitionError("recorded source fixture could not be read") from error
    if not live:
        raise SourceAcquisitionError("live acquisition is opt-in")
    request = Request(url, headers={"Accept": MEDIA_TYPE})  # nosec B310: declared public HTTPS URL
    try:
        with urlopen(request, timeout=120) as response:  # nosec B310: declared public HTTPS URL
            return response.read()
    except HTTPError as error:
        raise SourceAcquisitionError(
            "Eurostat HTTP request failed",
            retryable=error.code == 429 or error.code >= 500,
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise SourceAcquisitionError("Eurostat transport failed", retryable=True) from error


def _number(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    url = configuration["url"]
    payload = _read(url, fixture=fixture, live=live)
    try:
        rows = list(csv.DictReader(io.StringIO(payload.decode("utf-8"), newline="")))
    except (UnicodeError, csv.Error) as error:
        raise SourceAcquisitionError("Eurostat response is not readable UTF-8 CSV") from error
    if not rows:
        raise SourceAcquisitionError("Eurostat response carries no observations")
    if any(key is None or value is None for row in rows for key, value in row.items()):
        raise SourceAcquisitionError("Eurostat response has ragged rows")
    key = {
        str(dimension): {str(code) for code in codes} if isinstance(codes, list) else {str(codes)}
        for dimension, codes in configuration["key"].items()
    }
    missing = [name for name in (*key, "geo", "TIME_PERIOD", "OBS_VALUE", "CONF_STATUS") if name not in rows[0]]
    if missing:
        raise SourceAcquisitionError("Eurostat response is missing declared dimensions")
    # The response must cover exactly the pinned key: a unit outside it means
    # the request widened; a declared unit absent means it narrowed.
    for dimension, codes in key.items():
        if {row[dimension] for row in rows} != codes:
            raise SourceAcquisitionError(f"Eurostat response does not match the declared {dimension}")
    years = {row["TIME_PERIOD"] for row in rows}
    if not all(year.isdigit() and len(year) == 4 for year in years):
        raise SourceAcquisitionError("Eurostat response carries a non-annual time period")
    if len({(row["unit"], row["geo"], row["TIME_PERIOD"]) for row in rows}) != len(rows):
        raise SourceAcquisitionError("Eurostat response repeats a region-year observation")

    published = [row for row in rows if row["OBS_VALUE"] != ""]
    if not published:
        raise SourceAcquisitionError("Eurostat response publishes no values")
    latest = max(row["TIME_PERIOD"] for row in published)
    values = [_number(row["OBS_VALUE"]) for row in published]
    countries = {row["geo"] for row in published if len(row["geo"]) == COUNTRY_CODE_LENGTH}
    at_edge = {
        row["geo"] for row in published
        if len(row["geo"]) == COUNTRY_CODE_LENGTH and row["TIME_PERIOD"] == latest
    }
    assertions = (
        {"check": "every_published_value_is_numeric", "passed": all(value is not None for value in values)},
        # Zero is a real value: an extra-regio territory can have no GDP.
        {"check": "every_published_value_is_non_negative", "passed": all(value is not None and value >= 0 for value in values)},
        # Eurostat leaves a cell empty only when it withholds or lacks it, and
        # says which through the confidentiality status or the flag.
        {"check": "every_empty_value_carries_a_status_or_flag", "passed": all(
            row["CONF_STATUS"] or row.get("OBS_FLAG") for row in rows if row["OBS_VALUE"] == ""
        )},
        {"check": "most_countries_publish_the_latest_year", "passed": len(at_edge) * 2 > len(countries)},
    )
    return AdapterAcquisition(
        rows,
        f"{latest}-12-31",
        [url],
        DECODER_VERSION,
        assertions=assertions,
    )
