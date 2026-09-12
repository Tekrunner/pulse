"""Neutral original-file adapter fragment."""

import csv
import io
from pathlib import Path
from pulse.sources import AdapterAcquisition, SourceAcquisitionError


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    if fixture is None:
        raise SourceAcquisitionError("configure explicit live file download in this source package")
    try:
        payload = fixture.read_bytes()
        rows = list(csv.DictReader(io.StringIO(payload.decode("utf-8"))))
        latest = max(row["period"] for row in rows) + "-01"
    except OSError as error:
        raise SourceAcquisitionError("recorded source fixture could not be read") from error
    except (KeyError, UnicodeError, ValueError) as error:
        raise SourceAcquisitionError("public source file is incompatible") from error
    return AdapterAcquisition(None, latest, [configuration["url"]], "original-file-v1", original_bytes=payload, original_filename=fixture.name, assertions=({"check": "file-has-observations", "passed": bool(rows)},))
