"""INSEE BDM/SDMX access and faithful response decoding for this source only."""

from __future__ import annotations

from datetime import date
import json
from pathlib import Path
from urllib.request import Request, urlopen

import dlt


DECODER_VERSION = "insee-cpi-json-v1"


class InseeResponseError(ValueError):
    """The provider response cannot be faithfully decoded."""


def load_response(*, fixture: Path | None, url: str, live: bool) -> tuple[dict, str]:
    if fixture is not None:
        try:
            return json.loads(fixture.read_text(encoding="utf-8")), fixture.resolve().as_uri()
        except (OSError, json.JSONDecodeError) as error:
            raise InseeResponseError("recorded INSEE fixture is not valid JSON") from error
    if not live:
        raise InseeResponseError("live acquisition is opt-in; pass --live or a recorded --fixture")
    try:
        with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=30) as response:  # nosec B310: declared public URL
            return json.loads(response.read()), url
    except Exception as error:
        raise InseeResponseError("INSEE request failed; retry later or use a recorded fixture") from error


def load_responses(*, fixture: Path | None, urls: list[str], live: bool) -> dict:
    """Load one recorded multi-series response or every selected live BDM series."""
    if fixture is not None:
        payload, _ = load_response(fixture=fixture, url=urls[0], live=live)
        return payload
    combined: list[dict] = []
    source_dates: set[str | None] = set()
    for url in urls:
        payload, _ = load_response(fixture=None, url=url, live=live)
        rows, source_data_date = decode_response(payload)
        combined.extend(rows)
        source_dates.add(source_data_date)
    if len(source_dates) > 1:
        raise InseeResponseError("INSEE selected series have inconsistent source-data dates")
    return {"source_data_date": source_dates.pop() if source_dates else None, "data": combined}


def decode_response(payload: dict) -> tuple[list[dict], str | None]:
    rows = payload.get("data")
    if not isinstance(rows, list) or not rows or not all(isinstance(row, dict) for row in rows):
        raise InseeResponseError("INSEE response must contain a non-empty object 'data' array")
    source_data_date = payload.get("source_data_date")
    if source_data_date is not None:
        try:
            date.fromisoformat(source_data_date)
        except ValueError as error:
            raise InseeResponseError("INSEE source_data_date must be an ISO date") from error
    return rows, source_data_date


def ensure_selected_series(rows: list[dict], selected_series: list[dict[str, str]]) -> None:
    """Enforce this source's approved three-measure CPI slice without reshaping rows."""
    expected = {series["id"] for series in selected_series}
    required_measures = {"cpi-level", "cpi-year-on-year", "cpi-month-on-month"}
    if {series.get("measure") for series in selected_series} != required_measures:
        raise InseeResponseError("INSEE declaration must select level, year-on-year, and month-on-month CPI")
    observed = {row.get("SERIES") for row in rows}
    if observed != expected:
        missing = expected - observed
        unexpected = observed - expected
        details = []
        if missing:
            details.append("missing selected series " + ", ".join(sorted(missing)))
        if unexpected:
            details.append("unexpected series " + ", ".join(sorted(str(value) for value in unexpected)))
        raise InseeResponseError("INSEE response does not faithfully cover the declared slice: " + "; ".join(details))


@dlt.resource(name="insee_cpi", write_disposition="replace")
def insee_cpi_rows(rows: list[dict]):
    """Yield provider rows unchanged; dlt owns source-format decoding."""
    yield from rows
