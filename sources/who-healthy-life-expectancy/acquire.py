"""Acquire WHO healthy life expectancy at birth as provider-native OData rows.

The upstream is an API response rather than a downloadable file, so the archive
keeps faithful rows: every field the provider sends is retained under its own
name, and a JSON null stays null rather than becoming an empty string. Nothing
here renames, types, calculates or drops a field.
"""

import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "who-gho-hale-odata-v1"


def _read(url: str, *, fixture: Path | None, live: bool) -> bytes:
    if fixture is not None:
        try:
            return fixture.read_bytes()
        except OSError as error:
            raise SourceAcquisitionError("recorded source fixture could not be read") from error
    if not live:
        raise SourceAcquisitionError("live acquisition is opt-in")
    try:
        with urlopen(url, timeout=300) as response:  # nosec B310: declared public HTTPS URL
            return response.read()
    except HTTPError as error:
        raise SourceAcquisitionError(
            "Global Health Observatory HTTP request failed",
            retryable=error.code == 429 or error.code >= 500,
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise SourceAcquisitionError(
            "Global Health Observatory transport failed", retryable=True
        ) from error


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    url = configuration["url"]
    payload = _read(url, fixture=fixture, live=live)
    try:
        rows = json.loads(payload.decode("utf-8"))["value"]
    except (KeyError, TypeError, UnicodeError, ValueError, json.JSONDecodeError) as error:
        raise SourceAcquisitionError(
            "Global Health Observatory response is incompatible"
        ) from error
    if not isinstance(rows, list) or not rows or not all(isinstance(row, dict) for row in rows):
        raise SourceAcquisitionError("Global Health Observatory response carries no observations")
    required = ("IndicatorCode", "SpatialDim", "SpatialDimType", "TimeDim", "Dim1", "Dim1Type",
                "NumericValue", "Value", "Low", "High")
    if any(name not in rows[0] for name in required):
        raise SourceAcquisitionError("Global Health Observatory response is missing declared fields")
    indicator = str(configuration["indicator_code"])
    sex_dimension = str(configuration["sex_dimension"])
    sex_codes = set(configuration["sex_codes"])
    years = {row["TimeDim"] for row in rows if isinstance(row["TimeDim"], int)}
    if not years:
        raise SourceAcquisitionError("Global Health Observatory response carries no reference years")
    countries = {row["SpatialDim"] for row in rows if row["SpatialDimType"] == "COUNTRY"}
    latest = max(years)
    assertions = (
        {
            "check": "every-row-reports-the-requested-indicator",
            "passed": all(row["IndicatorCode"] == indicator for row in rows),
        },
        {
            "check": "every-row-is-disaggregated-by-the-declared-dimension",
            "passed": all(row["Dim1Type"] == sex_dimension for row in rows),
        },
        {
            "check": "every-declared-sex-code-is-published",
            "passed": sex_codes <= {row["Dim1"] for row in rows},
        },
        {
            "check": "country-rows-are-published",
            "passed": bool(countries),
        },
        {
            # The provider publishes an uncertainty interval alongside most
            # estimates. Where it publishes one, it should contain the estimate.
            "check": "published-uncertainty-interval-contains-the-estimate",
            "passed": all(
                row["Low"] <= row["NumericValue"] <= row["High"]
                for row in rows
                if isinstance(row["Low"], (int, float)) and isinstance(row["High"], (int, float))
            ),
        },
        {
            "check": "the-latest-reference-year-is-published-for-every-declared-sex-code",
            "passed": sex_codes <= {row["Dim1"] for row in rows if row["TimeDim"] == latest},
        },
    )
    # The represented date is the end of the latest reference year the
    # indicator publishes. It advances only when the Global Health Estimates
    # are revised, which is why the declared schedule is the provider's
    # revision cycle rather than a yearly one.
    return AdapterAcquisition(
        rows,
        f"{latest}-12-31",
        [url],
        DECODER_VERSION,
        assertions=assertions,
    )
