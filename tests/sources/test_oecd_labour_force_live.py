"""Explicit, opt-in provider checks for the two OECD labour-force sources."""

from __future__ import annotations

import os

import pytest

from pulse.sources import acquire_from_adapter, discover_sources


OPT_IN = "PULSE_LIVE_OECD_LABOUR_FORCE"
AREA = "REF_AREA: Reference area"


@pytest.mark.live
@pytest.mark.skipif(os.environ.get(OPT_IN) != "1", reason=f"{OPT_IN} is not set to 1")
@pytest.mark.parametrize(
    ("source_id", "suffixes"),
    (
        ("oecd-unemployment-rate", ("-01-31", "-02-28", "-02-29", "-03-31", "-04-30", "-05-31",
                                    "-06-30", "-07-31", "-08-31", "-09-30", "-10-31", "-11-30",
                                    "-12-31")),
        ("oecd-participation-rate", ("-03-31", "-06-30", "-09-30", "-12-31")),
    ),
)
def test_declared_key_still_matches_the_live_provider_response(
    source_id: str, suffixes: tuple[str, ...]
) -> None:
    declaration = discover_sources()[source_id]

    acquired = acquire_from_adapter(declaration, fixture=None, live=True)

    assert acquired.rows
    assert acquired.source_data_date is not None and acquired.source_data_date.endswith(suffixes)
    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert not failed, f"live provider response failed plausibility checks: {failed}"
