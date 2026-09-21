"""Acquire the UN World Population Prospects five-year age-group population file.

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


DECODER_VERSION = "un-wpp-population-by-age-original-file-v1"


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
        with urlopen(url, timeout=1200) as response:  # nosec B310: declared public HTTPS URL
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


def _scan(payload: bytes, required: list[str], world_location_id: str, boundary: int) -> dict:
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
    world_years: set[int] = set()
    world_boundary_groups: set[str] = set()
    sexes_sum_to_total = True
    try:
        for row in reader:
            year = int(row["Time"])
            years.add(year)
            if row["LocID"] != world_location_id:
                continue
            world_years.add(year)
            if year != boundary:
                continue
            world_boundary_groups.add(row["AgeGrp"])
            male, female, total = (
                float(row["PopMale"]), float(row["PopFemale"]), float(row["PopTotal"])
            )
            # The provider rounds each column independently, so equality is
            # asserted to the published precision rather than exactly.
            if abs(male + female - total) > 0.5:
                sexes_sum_to_total = False
    except (EOFError, OSError, TypeError, UnicodeError, ValueError, csv.Error) as error:
        raise SourceAcquisitionError(
            "World Population Prospects file is not a readable gzip UTF-8 CSV"
        ) from error
    if not years:
        raise SourceAcquisitionError("World Population Prospects file carries no observations")
    return {
        "years": years,
        "world_years": world_years,
        "world_boundary_groups": world_boundary_groups,
        "sexes_sum_to_total": sexes_sum_to_total,
    }


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    url = configuration["url"]
    filename = _filename(url)
    payload = _read(url, fixture=fixture, live=live)
    first_year = int(configuration["first_year"])
    boundary = int(configuration["estimates_through_year"])
    horizon = int(configuration["projection_horizon_year"])
    groups = set(configuration["age_groups"])
    world_id = str(configuration["world_location_id"])
    scanned = _scan(payload, list(configuration["required_columns"]), world_id, boundary)
    years = scanned["years"]
    assertions = (
        {"check": "series-starts-at-the-declared-first-year", "passed": min(years) == first_year},
        {"check": "declared-estimate-boundary-year-is-published", "passed": boundary in years},
        {"check": "projection-reaches-the-declared-horizon", "passed": horizon in years},
        {"check": "world-total-is-published", "passed": bool(scanned["world_years"])},
        {
            "check": "every-declared-age-group-is-published-at-the-boundary-year",
            "passed": groups <= scanned["world_boundary_groups"],
        },
        {
            "check": "male-and-female-populations-sum-to-the-published-total",
            "passed": scanned["sexes_sum_to_total"],
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
