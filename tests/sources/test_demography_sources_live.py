"""Explicit, opt-in provider checks for the six demography sources.

Each asks the one question a fixture cannot: does the live provider still
answer the declared request in the declared shape? They are skipped unless the
source family's own environment variable is set.
"""

from __future__ import annotations

import os

import pytest

from pulse.sources import acquire_from_adapter, discover_sources


WPP_OPT_IN = "PULSE_LIVE_UN_WPP"
EUROSTAT_OPT_IN = "PULSE_LIVE_EUROSTAT_MIGRATION"
WHO_OPT_IN = "PULSE_LIVE_WHO_HALE"


@pytest.mark.live
@pytest.mark.skipif(os.environ.get(WPP_OPT_IN) != "1", reason=f"{WPP_OPT_IN} is not set to 1")
@pytest.mark.parametrize(
    "source_id",
    ("un-wpp-demographic-indicators", "un-wpp-projection-scenarios", "un-wpp-population-by-age"),
)
def test_declared_wpp_file_still_matches_the_live_provider(source_id: str) -> None:
    declaration = discover_sources()[source_id]

    acquired = acquire_from_adapter(declaration, fixture=None, live=True)

    assert acquired.original_bytes and acquired.rows is None
    # The declared revision is the one the URL names, and its estimates end at
    # the declared boundary. A new revision arrives at a different URL, so a
    # change here means the provider rebuilt this one in place.
    boundary = declaration.configuration["estimates_through_year"]
    assert acquired.source_data_date == f"{boundary}-12-31"
    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert not failed, f"live provider response failed plausibility checks: {failed}"


@pytest.mark.live
@pytest.mark.skipif(
    os.environ.get(EUROSTAT_OPT_IN) != "1", reason=f"{EUROSTAT_OPT_IN} is not set to 1"
)
@pytest.mark.parametrize("source_id", ("eurostat-immigration", "eurostat-emigration"))
def test_declared_eurostat_key_still_matches_the_live_provider(source_id: str) -> None:
    declaration = discover_sources()[source_id]

    acquired = acquire_from_adapter(declaration, fixture=None, live=True)

    assert acquired.rows
    assert acquired.source_data_date is not None and acquired.source_data_date.endswith("-12-31")
    for dimension, code in declaration.configuration["key"].items():
        assert {row[dimension] for row in acquired.rows} == {code}
    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert not failed, f"live provider response failed plausibility checks: {failed}"


@pytest.mark.live
@pytest.mark.skipif(os.environ.get(WHO_OPT_IN) != "1", reason=f"{WHO_OPT_IN} is not set to 1")
def test_declared_who_indicator_still_matches_the_live_provider() -> None:
    declaration = discover_sources()["who-healthy-life-expectancy"]

    acquired = acquire_from_adapter(declaration, fixture=None, live=True)

    assert acquired.rows
    assert {row["IndicatorCode"] for row in acquired.rows} == {
        declaration.configuration["indicator_code"]
    }
    assert acquired.source_data_date is not None and acquired.source_data_date.endswith("-12-31")
    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert not failed, f"live provider response failed plausibility checks: {failed}"
