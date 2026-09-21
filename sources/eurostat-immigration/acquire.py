"""Acquire Eurostat annual immigration totals as provider-native SDMX-CSV rows.

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


DECODER_VERSION = "eurostat-immigration-sdmx-csv-v1"
MEDIA_TYPE = "application/vnd.sdmx.data+csv;version=1.0.0"


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


def _numeric(value: str) -> bool:
    if value == "":
        return True
    try:
        float(value)
    except ValueError:
        return False
    return True


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
    key = {str(dimension): str(code) for dimension, code in configuration["key"].items()}
    missing = [name for name in (*key, "geo", "TIME_PERIOD", "OBS_VALUE") if name not in rows[0]]
    if missing:
        raise SourceAcquisitionError("Eurostat response is missing declared dimensions")
    years = {row["TIME_PERIOD"] for row in rows}
    if not all(year.isdigit() and len(year) == 4 for year in years):
        raise SourceAcquisitionError("Eurostat response carries a non-annual time period")
    assertions = (
        {
            "check": "every-row-matches-the-requested-series-key",
            "passed": all(row[name] == code for row in rows for name, code in key.items()),
        },
        {
            "check": "every-observation-value-is-a-number-or-empty",
            "passed": all(_numeric(row["OBS_VALUE"]) for row in rows),
        },
        {
            "check": "the-latest-year-is-published-for-more-than-one-reporting-country",
            "passed": len({
                row["geo"] for row in rows if row["TIME_PERIOD"] == max(years)
            }) > 1,
        },
        {
            "check": "no-reporting-country-repeats-a-year",
            "passed": len({(row["geo"], row["TIME_PERIOD"]) for row in rows}) == len(rows),
        },
    )
    # The represented date is the end of the latest reference year the response
    # publishes, which is what the provider's release calendar advances.
    return AdapterAcquisition(
        rows,
        f"{max(years)}-12-31",
        [url],
        DECODER_VERSION,
        assertions=assertions,
    )
