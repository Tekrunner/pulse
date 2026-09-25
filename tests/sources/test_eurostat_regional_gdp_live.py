"""Explicit, opt-in provider check for the Eurostat regional GDP source.

Excluded from ordinary verification by the `live` marker and skipped unless the
source-specific opt-in variable is set, so no routine run can reach Eurostat.
"""

from __future__ import annotations

import os

import pytest

from pulse.sources import acquire_from_adapter, discover_sources


OPT_IN = "PULSE_LIVE_EUROSTAT_REGIONAL_GDP"


@pytest.mark.live
@pytest.mark.skipif(os.environ.get(OPT_IN) != "1", reason=f"{OPT_IN} is not set to 1")
def test_declared_scope_still_matches_the_live_provider_response() -> None:
    declaration = discover_sources()["eurostat-regional-gdp"]

    acquired = acquire_from_adapter(declaration, fixture=None, live=True)

    assert acquired.source_data_date is not None and acquired.source_data_date.endswith("-12-31")
    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert not failed, f"live provider response failed plausibility checks: {failed}"
