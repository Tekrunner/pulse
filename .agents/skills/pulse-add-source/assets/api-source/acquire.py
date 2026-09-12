"""Neutral JSON API adapter asset; replace only source-local provider details."""

import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


def _read(url: str, *, fixture: Path | None, live: bool) -> bytes:
    if fixture is not None:
        try:
            return fixture.read_bytes()
        except OSError as error:
            raise SourceAcquisitionError("recorded source fixture could not be read") from error
    if not live:
        raise SourceAcquisitionError("live acquisition is opt-in")
    try:
        with urlopen(url, timeout=30) as response:  # nosec B310: declared public HTTPS URL
            return response.read()
    except HTTPError as error:
        raise SourceAcquisitionError("public source HTTP request failed", retryable=error.code == 429 or error.code >= 500) from error
    except (URLError, TimeoutError, OSError) as error:
        raise SourceAcquisitionError("public source transport failed", retryable=True) from error


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    try:
        payload = json.loads(_read(configuration["url"], fixture=fixture, live=live))
        rows = payload["observations"]
        latest = max(row["period"] for row in rows) + "-01"
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise SourceAcquisitionError("public source response is incompatible") from error
    return AdapterAcquisition(rows, latest, [configuration["url"]], "example-json-v1", assertions=({"check": "response-has-observations", "passed": bool(rows)},))
