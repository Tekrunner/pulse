"""Acquire the UN World Population Prospects alternative-scenario indicator file.

The upstream is a downloadable gzip-compressed CSV, so the archive keeps the
provider's bytes exactly as served. This adapter decompresses only transiently,
to answer whether the response is well formed and current.
"""

import csv
import gzip
import io
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse
from urllib.request import urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "un-wpp-scenarios-original-file-v1"


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
        # This is the largest file the provider publishes in this group, so the
        # timeout is generous enough that a slow but healthy transfer is not
        # mistaken for a fault.
        with urlopen(url, timeout=1800) as response:  # nosec B310: declared public HTTPS URL
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


def _scan(payload: bytes, required: list[str], world_location_id: str) -> dict:
    """Read the compressed CSV once, keeping only what the assertions need."""
    try:
        stream = io.TextIOWrapper(
            gzip.GzipFile(fileobj=io.BytesIO(payload)), encoding="utf-8-sig", newline=""
        )
        reader = csv.DictReader(stream)
        columns = reader.fieldnames or []
    except (EOFError, OSError, UnicodeError, ValueError, csv.Error) as error:
        raise SourceAcquisitionError(
            "World Population Prospects file is not a readable gzip UTF-8 CSV"
        ) from error
    missing = [name for name in required if name not in columns]
    if missing:
        raise SourceAcquisitionError("World Population Prospects file is missing declared columns")
    years: set[int] = set()
    scenarios: set[str] = set()
    world_scenarios: set[str] = set()
    try:
        for row in reader:
            years.add(int(row["Time"]))
            scenarios.add(row["Variant"])
            if row["LocID"] == world_location_id:
                world_scenarios.add(row["Variant"])
    except (EOFError, OSError, TypeError, UnicodeError, ValueError, csv.Error) as error:
        raise SourceAcquisitionError(
            "World Population Prospects file is not a readable gzip UTF-8 CSV"
        ) from error
    if not years:
        raise SourceAcquisitionError("World Population Prospects file carries no observations")
    return {"years": years, "scenarios": scenarios, "world_scenarios": world_scenarios}


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    url = configuration["url"]
    filename = _filename(url)
    payload = _read(url, fixture=fixture, live=live)
    boundary = int(configuration["estimates_through_year"])
    horizon = int(configuration["projection_horizon_year"])
    declared = set(configuration["scenarios"])
    aggregated = set(configuration["world_total_scenarios"])
    world_id = str(configuration["world_location_id"])
    scanned = _scan(payload, list(configuration["required_columns"]), world_id)
    years, scenarios, world_scenarios = (
        scanned["years"], scanned["scenarios"], scanned["world_scenarios"]
    )
    assertions = (
        {
            "check": "projection-begins-the-year-after-the-declared-estimate-boundary",
            "passed": min(years) == boundary + 1,
        },
        {"check": "projection-reaches-the-declared-horizon", "passed": horizon in years},
        {"check": "every-declared-scenario-is-published", "passed": declared <= scenarios},
        {
            "check": "world-total-is-published-for-every-scenario-the-provider-aggregates",
            "passed": aggregated <= world_scenarios,
        },
    )
    # The represented date is the last estimated year this projection is based
    # on, so that it advances with the revision rather than standing still at
    # the projection horizon.
    return AdapterAcquisition(
        None,
        f"{boundary}-12-31",
        [url],
        DECODER_VERSION,
        original_bytes=payload,
        original_filename=filename,
        assertions=assertions,
    )
