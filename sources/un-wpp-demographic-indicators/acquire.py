"""Acquire the UN World Population Prospects medium-scenario indicator file.

The upstream is a downloadable gzip-compressed CSV, so the archive keeps the
provider's bytes exactly as served. This adapter decompresses only transiently,
to answer whether the response is well formed and current, and never
substitutes a reserialized payload for the bytes it was given.
"""

import csv
import gzip
import io
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse
from urllib.request import urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "un-wpp-indicators-original-file-v1"

# Columns that identify a row rather than measure anything. Every other
# declared column is a measure, and a complete row carries all of them.
KEY_COLUMNS = frozenset(
    {
        "LocID", "Notes", "ISO3_code", "LocTypeID", "LocTypeName", "ParentID",
        "Location", "VarID", "Variant", "Time",
    }
)


def _filename(url: str) -> str:
    name = unquote(urlparse(url).path).rsplit("/", 1)[-1]
    if not name.endswith(".csv.gz"):
        raise SourceAcquisitionError("declared World Population Prospects URL is not a CSV archive")
    return name


def _read(url: str, *, fixture: Path | None, live: bool) -> bytes:
    if fixture is not None:
        try:
            return fixture.read_bytes()
        except OSError as error:
            raise SourceAcquisitionError("recorded source fixture could not be read") from error
    if not live:
        raise SourceAcquisitionError("live acquisition is opt-in")
    try:
        # The published file is tens of megabytes, so the timeout is generous
        # enough that a slow but healthy transfer is not mistaken for a fault.
        with urlopen(url, timeout=600) as response:  # nosec B310: declared public HTTPS URL
            return response.read()
    except HTTPError as error:
        raise SourceAcquisitionError(
            "World Population Prospects HTTP request failed",
            retryable=error.code == 429 or error.code >= 500,
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise SourceAcquisitionError(
            "World Population Prospects transport failed", retryable=True
        ) from error


def _rows(payload: bytes):
    stream = io.TextIOWrapper(
        gzip.GzipFile(fileobj=io.BytesIO(payload)), encoding="utf-8-sig", newline=""
    )
    reader = csv.DictReader(stream)
    return reader, reader.fieldnames or []


def _scan(payload: bytes, required: list[str], world_location_id: str) -> dict:
    """Read the compressed CSV once, keeping only what the assertions need."""
    try:
        reader, columns = _rows(payload)
    except (EOFError, OSError, UnicodeError, ValueError, csv.Error) as error:
        raise SourceAcquisitionError(
            "World Population Prospects file is not a readable gzip UTF-8 CSV"
        ) from error
    missing = [name for name in required if name not in columns]
    if missing:
        raise SourceAcquisitionError("World Population Prospects file is missing declared columns")
    measures = [name for name in required if name not in KEY_COLUMNS]
    years: set[int] = set()
    world_years: set[int] = set()
    world_complete: set[int] = set()
    try:
        for row in reader:
            year = int(row["Time"])
            years.add(year)
            if row["LocID"] == world_location_id:
                world_years.add(year)
                if all(row[name] not in (None, "") for name in measures):
                    world_complete.add(year)
    except (EOFError, OSError, TypeError, UnicodeError, ValueError, csv.Error) as error:
        raise SourceAcquisitionError(
            "World Population Prospects file is not a readable gzip UTF-8 CSV"
        ) from error
    if not years:
        raise SourceAcquisitionError("World Population Prospects file carries no observations")
    return {"years": years, "world_years": world_years, "world_complete": world_complete}


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    url = configuration["url"]
    filename = _filename(url)
    payload = _read(url, fixture=fixture, live=live)
    first_year = int(configuration["first_year"])
    boundary = int(configuration["estimates_through_year"])
    horizon = int(configuration["projection_horizon_year"])
    world_id = str(configuration["world_location_id"])
    scanned = _scan(payload, list(configuration["required_columns"]), world_id)
    years, world_years, world_complete = (
        scanned["years"], scanned["world_years"], scanned["world_complete"]
    )
    assertions = (
        {"check": "series-starts-at-the-declared-first-year", "passed": min(years) == first_year},
        {"check": "declared-estimate-boundary-year-is-published", "passed": boundary in years},
        {"check": "projection-reaches-the-declared-horizon", "passed": horizon in years},
        {"check": "world-total-is-published", "passed": bool(world_years)},
        {
            "check": "world-total-carries-every-declared-measure-at-the-boundary-year",
            "passed": boundary in world_complete,
        },
    )
    # The represented date is the last year the provider treats as estimated,
    # not the last year the file reaches: a revision's currency is how far its
    # observed period runs, while its projection horizon stands still at 2100.
    return AdapterAcquisition(
        None,
        f"{boundary}-12-31",
        [url],
        DECODER_VERSION,
        original_bytes=payload,
        original_filename=filename,
        assertions=assertions,
    )
