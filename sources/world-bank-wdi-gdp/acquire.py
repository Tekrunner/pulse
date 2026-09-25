"""Faithful acquisition of the declared World Bank WDI indicators for one country.

The API answers with a two-element JSON array: a paging header and a list of
observations. Each observation nests `indicator` and `country` objects; the
adapter flattens them with the provider's own key names joined by a dot
(`indicator.id`, `country.value`) and keeps every other field, with its JSON
type, unrenamed. It types, calculates and classifies nothing.
"""

import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "world-bank-api-v2-json-v1"
YEAR = re.compile(r"^\d{4}$")


def _read(url: str, *, fixture: Path | None, live: bool) -> bytes:
    if fixture is not None:
        try:
            return fixture.read_bytes()
        except OSError as error:
            raise SourceAcquisitionError("recorded source fixture could not be read") from error
    if not live:
        raise SourceAcquisitionError("live acquisition is opt-in")
    try:
        with urlopen(url, timeout=60) as response:  # nosec B310: declared public HTTPS URL
            return response.read()
    except HTTPError as error:
        raise SourceAcquisitionError(
            "World Bank API HTTP request failed",
            retryable=error.code == 429 or error.code >= 500,
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise SourceAcquisitionError("World Bank API transport failed", retryable=True) from error


def _declared_indicators(configuration: dict) -> dict[str, str]:
    declared = configuration.get("indicators")
    if not isinstance(declared, list) or not declared:
        raise SourceAcquisitionError("source declaration carries no provider indicator scope")
    scope: dict[str, str] = {}
    for entry in declared:
        identifier, name = entry.get("id"), entry.get("name")
        if not isinstance(identifier, str) or not isinstance(name, str) or identifier in scope:
            raise SourceAcquisitionError("declared provider indicator scope is invalid or duplicated")
        scope[identifier] = name
    return scope


def _flatten(observation: dict) -> dict:
    row: dict = {}
    for key, value in observation.items():
        if isinstance(value, dict):
            for inner, field in value.items():
                row[f"{key}.{inner}"] = field
        else:
            row[key] = value
    return row


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    scope = _declared_indicators(configuration)
    country = configuration.get("country")
    payload = _read(configuration["url"], fixture=fixture, live=live)
    try:
        header, observations = json.loads(payload)
        total = header["total"]
    except (KeyError, TypeError, ValueError, UnicodeError, json.JSONDecodeError) as error:
        # The API reports an invalid request as a one-element array carrying a
        # message, which fails to unpack here as well.
        raise SourceAcquisitionError("World Bank API response is incompatible") from error
    if not isinstance(observations, list) or not observations:
        raise SourceAcquisitionError("World Bank API returned no observations")
    # One page must hold the whole answer; a truncated page would archive a
    # partial history as though it were complete.
    if total != len(observations):
        raise SourceAcquisitionError("World Bank API answer spans more than one page")

    rows = [_flatten(observation) for observation in observations]
    seen: set[tuple[str, str]] = set()
    names: dict[str, str] = {}
    for row in rows:
        indicator, period = row.get("indicator.id"), row.get("date")
        if not isinstance(indicator, str) or not isinstance(period, str) or YEAR.fullmatch(period) is None:
            raise SourceAcquisitionError("World Bank API returned an observation without indicator or year")
        if (indicator, period) in seen:
            raise SourceAcquisitionError("World Bank API returned a duplicate indicator-year observation")
        seen.add((indicator, period))
        names[indicator] = row.get("indicator.value")
    if set(names) != set(scope):
        raise SourceAcquisitionError("World Bank API indicator scope does not match the declaration")
    if any(names[identifier] != name for identifier, name in scope.items()):
        raise SourceAcquisitionError("World Bank API renamed a declared indicator")
    if any(row.get("countryiso3code") != country for row in rows):
        raise SourceAcquisitionError("World Bank API answered for another country")

    published = [row for row in rows if row.get("value") is not None]
    if not published:
        raise SourceAcquisitionError("World Bank API returned no published values")
    latest = max(row["date"] for row in published)
    latest_by_indicator = {
        identifier: max((row["date"] for row in published if row["indicator.id"] == identifier), default=None)
        for identifier in scope
    }
    numeric = all(isinstance(row["value"], (int, float)) and not isinstance(row["value"], bool) for row in published)
    # Every declared quantity — GDP levels, a price index, an exchange rate — is
    # strictly positive.
    positive = numeric and all(row["value"] > 0 for row in published)
    return AdapterAcquisition(
        rows,
        f"{latest}-12-31",
        [configuration["url"]],
        DECODER_VERSION,
        assertions=(
            {"check": "every_published_value_is_numeric", "passed": numeric},
            {"check": "every_published_value_is_positive", "passed": positive},
            {"check": "every_declared_indicator_reaches_the_latest_year", "passed": set(latest_by_indicator.values()) == {latest}},
        ),
    )
