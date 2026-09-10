"""INSEE BDM StructureSpecific SDMX-ML access and faithful decoding."""

from __future__ import annotations

from datetime import date
from pathlib import Path
import re
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

import dlt

from pulse.sources import AdapterAcquisition, SourceAcquisitionError, SourceDeclarationError


DECODER_VERSION = "insee-bdm-structurespecific-sdmxml-v1"
MEDIA_TYPE = "application/vnd.sdmx.structurespecificdata+xml;version=2.1"
_MONTH = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")
_YEAR = re.compile(r"^\d{4}$")


class InseeResponseError(SourceAcquisitionError):
    """The provider response cannot be faithfully decoded."""


def _provider_scope(configuration: dict[str, Any]) -> tuple[str, dict[str, str]]:
    endpoint = configuration.get("url")
    series = configuration.get("series")
    if not isinstance(endpoint, str) or not endpoint.startswith("https://"):
        raise SourceDeclarationError("INSEE acquisition requires one HTTPS combined-series url")
    if not isinstance(series, list) or not series:
        raise SourceDeclarationError("INSEE acquisition requires provider series")
    expected: dict[str, str] = {}
    for item in series:
        if (
            not isinstance(item, dict)
            or not isinstance(item.get("id"), str)
            or not item["id"]
            or not isinstance(item.get("name"), str)
            or not item["name"]
        ):
            raise SourceDeclarationError("INSEE provider series require native id and name")
        expected[item["id"]] = item["name"]
    if len(expected) != len(series):
        raise SourceDeclarationError("INSEE provider series IDs must be unique")
    return endpoint, expected


def load_response(*, fixture: Path | None, url: str, live: bool) -> bytes:
    if fixture is not None:
        try:
            return fixture.read_bytes()
        except OSError as error:
            raise InseeResponseError("recorded INSEE fixture could not be read") from error
    if not live:
        raise InseeResponseError("live acquisition is opt-in; pass --live or a recorded --fixture")
    try:
        request = Request(url, headers={"Accept": MEDIA_TYPE})
        with urlopen(request, timeout=30) as response:  # nosec B310: declared public HTTPS URL
            return response.read()
    except HTTPError as error:
        retryable = error.code in {408, 425, 429} or 500 <= error.code <= 599
        raise InseeResponseError(
            f"INSEE HTTP request failed with status {error.code}", retryable=retryable
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise InseeResponseError("INSEE transport failed; retry later", retryable=True) from error


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _source_date(periods: list[str]) -> str:
    for period in periods:
        if _MONTH.fullmatch(period) is None and _YEAR.fullmatch(period) is None:
            raise InseeResponseError("INSEE TIME_PERIOD must be a monthly YYYY-MM or annual YYYY provider value")
    monthly = [period for period in periods if _MONTH.fullmatch(period)]
    latest = max(monthly or periods)
    if _YEAR.fullmatch(latest):
        return f"{latest}-01-01"
    value = f"{latest}-01"
    date.fromisoformat(value)
    return value


def decode_response(payload: bytes, expected_series: dict[str, str]) -> tuple[list[dict[str, str]], str]:
    """Flatten Series and Obs attributes without renaming, typing, or dropping additions."""
    try:
        root = ET.fromstring(payload)
    except ET.ParseError as error:
        raise InseeResponseError("INSEE response is malformed SDMX-ML") from error
    if _local_name(root.tag) != "StructureSpecificData":
        raise InseeResponseError("INSEE response is not StructureSpecificData SDMX-ML")

    rows: list[dict[str, str]] = []
    observed_series: dict[str, str] = {}
    periods: list[str] = []
    for series_element in (element for element in root.iter() if _local_name(element.tag) == "Series"):
        series_attributes = dict(series_element.attrib)
        series_id = series_attributes.get("IDBANK")
        if not series_id:
            raise InseeResponseError("INSEE Series is missing required IDBANK")
        title = series_attributes.get("TITLE_FR")
        if not title:
            raise InseeResponseError(f"INSEE series {series_id} is missing required TITLE_FR")
        observed_series[series_id] = title
        observations = [child for child in series_element if _local_name(child.tag) == "Obs"]
        if not observations:
            raise InseeResponseError(f"INSEE series {series_id} contains no observations")
        for observation in observations:
            observation_attributes = dict(observation.attrib)
            for required in ("TIME_PERIOD", "OBS_VALUE"):
                if not observation_attributes.get(required):
                    raise InseeResponseError(
                        f"INSEE series {series_id} observation is missing required {required}"
                    )
            collisions = set(series_attributes) & set(observation_attributes)
            if collisions:
                raise InseeResponseError("INSEE Series and Obs attributes collide and cannot be flattened faithfully")
            rows.append({**series_attributes, **observation_attributes})
            periods.append(observation_attributes["TIME_PERIOD"])

    missing = set(expected_series) - set(observed_series)
    unexpected = set(observed_series) - set(expected_series)
    if missing or unexpected:
        details = []
        if missing:
            details.append("missing declared series " + ", ".join(sorted(missing)))
        if unexpected:
            details.append("unexpected series " + ", ".join(sorted(unexpected)))
        raise InseeResponseError("INSEE response does not match the declared provider scope: " + "; ".join(details))
    mismatched_names = [
        series_id
        for series_id, expected_name in expected_series.items()
        if observed_series[series_id] != expected_name
    ]
    if mismatched_names:
        raise InseeResponseError(
            "INSEE provider series name changed for " + ", ".join(sorted(mismatched_names))
        )
    return rows, _source_date(periods)


@dlt.resource(name="observations", write_disposition="replace")
def observation_rows(
    configuration: dict[str, Any], *, fixture: Path | None, live: bool
):
    """Own provider scope, access, SDMX-ML decoding, and faithful row emission."""
    endpoint, expected_series = _provider_scope(configuration)
    payload = load_response(fixture=fixture, url=endpoint, live=live)
    decoded_rows, _ = decode_response(payload, expected_series)
    yield from decoded_rows


def acquire(
    configuration: dict[str, Any], *, fixture: Path | None, live: bool
) -> AdapterAcquisition:
    # Iterating the dlt resource executes the entire provider-specific path. This
    # wrapper only projects generic archive metadata from the faithful rows/config.
    try:
        decoded_rows = list(observation_rows(configuration, fixture=fixture, live=live))
    except Exception as error:
        # dlt wraps generator failures in ResourceExtractionError. Restore only
        # our already-sanitized source diagnostics at this adapter boundary.
        cause: BaseException | None = error
        while cause is not None:
            if isinstance(cause, (InseeResponseError, SourceDeclarationError)):
                raise cause from error
            cause = cause.__cause__
        raise
    return AdapterAcquisition(
        rows=decoded_rows,
        source_data_date=_source_date([row["TIME_PERIOD"] for row in decoded_rows]),
        source_urls=[configuration["url"]],
        decoder_version=DECODER_VERSION,
    )
