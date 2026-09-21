"""Offline contract coverage for the three demography API sources.

Two Eurostat migration flows and one WHO indicator. The Eurostat pair share a
provider, a representation and a release calendar and differ only in direction,
so their invariants run over both; the WHO indicator is tested on its own.
"""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import pytest

from pulse.sources import (
    SourceAcquisitionError,
    acquire_from_adapter,
    discover_sources,
)


IMMIGRATION = "eurostat-immigration"
EMIGRATION = "eurostat-emigration"
EUROSTAT = (IMMIGRATION, EMIGRATION)
HALE = "who-healthy-life-expectancy"


@pytest.fixture(name="offline")
def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "socket.create_connection",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("network")),
    )


def _declaration(source_id: str):
    return discover_sources()[source_id]


def _fixture_name(source_id: str) -> str:
    return "fixture.json" if source_id == HALE else "fixture.csv"


def _acquire(source_id: str, fixture: Path | None = None):
    declaration = _declaration(source_id)
    return acquire_from_adapter(
        declaration,
        fixture=fixture or declaration.path.parent / _fixture_name(source_id),
        live=False,
    )


def _rewritten_csv(source_id: str, tmp_path: Path, mutate) -> Path:
    declaration = _declaration(source_id)
    with (declaration.path.parent / "fixture.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    fields = list(rows[0])
    rows = mutate(rows) or rows
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=fields, lineterminator="\r\n")
    writer.writeheader()
    writer.writerows(rows)
    fixture = tmp_path / "fixture.csv"
    fixture.write_text(buffer.getvalue(), encoding="utf-8", newline="")
    return fixture


def _rewritten_json(tmp_path: Path, mutate) -> Path:
    declaration = _declaration(HALE)
    payload = json.loads((declaration.path.parent / "fixture.json").read_text(encoding="utf-8"))
    payload["value"] = mutate(payload["value"]) or payload["value"]
    fixture = tmp_path / "fixture.json"
    fixture.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return fixture


@pytest.mark.parametrize("source_id", (*EUROSTAT, HALE))
def test_fixture_acquisition_is_offline_and_faithful(source_id: str, offline) -> None:
    declaration = _declaration(source_id)

    acquired = _acquire(source_id)

    assert acquired.source_urls == [declaration.configuration["url"]]
    assert acquired.rows
    assert all(assertion["passed"] for assertion in acquired.assertions)
    assert set(declaration.snapshot_contract["required_fields"]) <= set(acquired.rows[0])
    # An API source emits rows, never a preserved file payload.
    assert acquired.original_bytes is None


@pytest.mark.parametrize("source_id", (*EUROSTAT, HALE))
def test_live_access_requires_an_explicit_opt_in(source_id: str, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(_declaration(source_id), fixture=None, live=False)


@pytest.mark.parametrize("source_id", EUROSTAT)
def test_eurostat_rows_stay_inside_the_pinned_series_key(source_id: str, offline) -> None:
    key = _declaration(source_id).configuration["key"]
    rows = _acquire(source_id).rows

    for dimension, code in key.items():
        assert {row[dimension] for row in rows} == {code}


@pytest.mark.parametrize("source_id", EUROSTAT)
def test_eurostat_notices_a_response_that_widens_beyond_the_pinned_key(
    source_id: str, offline, tmp_path: Path
) -> None:
    """Widening is suspect rather than rejected: the rows are still the
    provider's, and a consumer that reads the key can see what arrived."""
    pinned = next(iter(_declaration(source_id).configuration["key"]))

    def widen(rows):
        rows[0][pinned] = "SOMETHING_ELSE"

    acquired = _acquire(source_id, _rewritten_csv(source_id, tmp_path, widen))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "every-row-matches-the-requested-series-key" in failed
    assert acquired.rows


@pytest.mark.parametrize("source_id", EUROSTAT)
def test_eurostat_names_no_reporting_country_of_its_own(
    source_id: str, offline, tmp_path: Path
) -> None:
    """Which countries report is a question about Eurostat's own membership and
    reporting obligations, answered by whichever package declares them. The
    United Kingdom leaving after 2019 is provider history, not a fault."""

    def drop_the_united_kingdom(rows):
        return [row for row in rows if row["geo"] != "UK"]

    acquired = _acquire(source_id, _rewritten_csv(source_id, tmp_path, drop_the_united_kingdom))

    assert "UK" not in {row["geo"] for row in acquired.rows}
    assert all(assertion["passed"] for assertion in acquired.assertions)


@pytest.mark.parametrize("source_id", EUROSTAT)
def test_eurostat_represents_the_end_of_its_latest_reference_year(
    source_id: str, offline
) -> None:
    acquired = _acquire(source_id)

    latest = max(row["TIME_PERIOD"] for row in acquired.rows)
    assert acquired.source_data_date == f"{latest}-12-31"


@pytest.mark.parametrize("source_id", EUROSTAT)
def test_eurostat_rejects_a_non_annual_period(source_id: str, offline, tmp_path: Path) -> None:
    """The key pins an annual frequency, so a monthly period in the response
    means the request no longer means what the declaration says it means."""

    def make_it_monthly(rows):
        rows[0]["TIME_PERIOD"] = "2024-01"

    with pytest.raises(SourceAcquisitionError, match="non-annual time period"):
        _acquire(source_id, _rewritten_csv(source_id, tmp_path, make_it_monthly))


@pytest.mark.parametrize("source_id", EUROSTAT)
def test_eurostat_keeps_a_suppressed_observation_as_the_empty_value_it_arrived_as(
    source_id: str, offline, tmp_path: Path
) -> None:
    """An observation the provider withholds is not a zero, and coercing it to
    one here would invent a flow that was never published."""

    def withhold(rows):
        rows[0]["OBS_VALUE"] = ""
        rows[0]["CONF_STATUS"] = "C"

    acquired = _acquire(source_id, _rewritten_csv(source_id, tmp_path, withhold))

    assert acquired.rows[0]["OBS_VALUE"] == ""
    assert all(assertion["passed"] for assertion in acquired.assertions)


@pytest.mark.parametrize("source_id", EUROSTAT)
def test_eurostat_notices_a_value_that_is_not_a_number(
    source_id: str, offline, tmp_path: Path
) -> None:
    def corrupt(rows):
        rows[0]["OBS_VALUE"] = "not a count"

    acquired = _acquire(source_id, _rewritten_csv(source_id, tmp_path, corrupt))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "every-observation-value-is-a-number-or-empty" in failed


@pytest.mark.parametrize("source_id", EUROSTAT)
def test_eurostat_notices_a_country_reporting_a_year_twice(
    source_id: str, offline, tmp_path: Path
) -> None:
    """One country, one year, one count. A duplicate means the pinned key no
    longer identifies a single series."""

    def duplicate(rows):
        return [*rows, dict(rows[0])]

    acquired = _acquire(source_id, _rewritten_csv(source_id, tmp_path, duplicate))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "no-reporting-country-repeats-a-year" in failed


def test_the_two_eurostat_flows_read_the_same_scope_in_opposite_directions(offline) -> None:
    """Both count every mover regardless of citizenship, which is what makes
    them differenceable. A citizenship-restricted flow on either side would
    describe a different population from the other."""
    immigration, emigration = _declaration(IMMIGRATION), _declaration(EMIGRATION)

    assert immigration.configuration["key"] == emigration.configuration["key"]
    assert immigration.configuration["key"]["citizen"] == "TOTAL"
    assert immigration.configuration["url"] != emigration.configuration["url"]
    assert "migr_imm1ctz" in immigration.configuration["url"]
    assert "migr_emi1ctz" in emigration.configuration["url"]


def test_hale_represents_the_end_of_its_latest_reference_year(offline) -> None:
    acquired = _acquire(HALE)

    assert acquired.source_data_date == "2021-12-31"
    assert {row["IndicatorCode"] for row in acquired.rows} == {"WHOSIS_000002"}


def test_hale_carries_every_declared_sex_code(offline) -> None:
    declared = set(_declaration(HALE).configuration["sex_codes"])

    acquired = _acquire(HALE)

    assert declared <= {row["Dim1"] for row in acquired.rows}
    assert {row["Dim1Type"] for row in acquired.rows} == {"SEX"}


def test_hale_notices_a_withdrawn_sex_code(offline, tmp_path: Path) -> None:
    def drop_women(rows):
        return [row for row in rows if row["Dim1"] != "SEX_FMLE"]

    acquired = _acquire(HALE, _rewritten_json(tmp_path, drop_women))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "every-declared-sex-code-is-published" in failed
    assert acquired.rows


def test_hale_notices_an_uncertainty_interval_that_excludes_its_estimate(
    offline, tmp_path: Path
) -> None:
    def break_the_interval(rows):
        rows[0]["High"] = rows[0]["NumericValue"] - 1.0

    acquired = _acquire(HALE, _rewritten_json(tmp_path, break_the_interval))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "published-uncertainty-interval-contains-the-estimate" in failed


def test_hale_keeps_an_estimate_the_provider_published_without_an_interval(
    offline, tmp_path: Path
) -> None:
    """The provider publishes a null interval on some rows. An adapter that
    demanded one would discard estimates the provider does publish."""

    def withhold_the_interval(rows):
        rows[0]["Low"] = None
        rows[0]["High"] = None

    acquired = _acquire(HALE, _rewritten_json(tmp_path, withhold_the_interval))

    assert acquired.rows[0]["Low"] is None
    assert all(assertion["passed"] for assertion in acquired.assertions)


def test_hale_treats_a_foreign_indicator_as_suspect_rather_than_rejected(
    offline, tmp_path: Path
) -> None:
    """The rows are structurally fine, so a wrong indicator code is a
    plausibility failure that makes the snapshot suspect but still usable."""

    def relabel(rows):
        rows[0]["IndicatorCode"] = "WHOSIS_000007"

    acquired = _acquire(HALE, _rewritten_json(tmp_path, relabel))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "every-row-reports-the-requested-indicator" in failed
    assert acquired.rows


def test_hale_names_no_country_of_its_own(offline, tmp_path: Path) -> None:
    """Which countries the Global Health Estimates cover is a question about
    that round, answered by whichever package declares its universe."""

    def drop_france(rows):
        return [row for row in rows if row["SpatialDim"] != "FRA"]

    acquired = _acquire(HALE, _rewritten_json(tmp_path, drop_france))

    assert "FRA" not in {row["SpatialDim"] for row in acquired.rows}
    assert all(assertion["passed"] for assertion in acquired.assertions)
