"""Offline contract coverage for the three UN World Population Prospects sources.

They share a provider, a file representation and a release calendar but not a
shape: one carries the medium scenario, one the alternative scenarios, one the
five-year age groups. The shared invariants run over all three and the
shape-specific ones separately.
"""

from __future__ import annotations

import csv
import gzip
import io
import json
from pathlib import Path

import pytest

from pulse.archive import archive_rows
from pulse.contracts.snapshot import validate_snapshot_manifest
from pulse.sources import (
    SourceAcquisitionError,
    acquire_from_adapter,
    discover_sources,
)


INDICATORS = "un-wpp-demographic-indicators"
SCENARIOS = "un-wpp-projection-scenarios"
BY_AGE = "un-wpp-population-by-age"
ALL = (INDICATORS, SCENARIOS, BY_AGE)
FIXTURE = "fixture.csv.gz"


@pytest.fixture(name="offline")
def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "socket.create_connection",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("network")),
    )


def _declaration(source_id: str):
    return discover_sources()[source_id]


def _acquire(source_id: str, fixture: Path | None = None):
    declaration = _declaration(source_id)
    return acquire_from_adapter(
        declaration, fixture=fixture or declaration.path.parent / FIXTURE, live=False
    )


def _rewritten(source_id: str, tmp_path: Path, mutate) -> Path:
    """Rebuild a source's fixture through a mutation, preserving its encoding."""
    declaration = _declaration(source_id)
    with gzip.open(
        declaration.path.parent / FIXTURE, "rt", encoding="utf-8-sig", newline=""
    ) as handle:
        rows = list(csv.DictReader(handle))
    fields = list(rows[0])
    rows = mutate(rows, fields) or rows
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=fields, lineterminator="\r\n")
    writer.writeheader()
    writer.writerows(rows)
    fixture = tmp_path / FIXTURE
    with gzip.GzipFile(fixture, "wb", mtime=0) as handle:
        handle.write(("﻿" + buffer.getvalue()).encode("utf-8"))
    return fixture


@pytest.mark.parametrize("source_id", ALL)
def test_fixture_acquisition_is_offline_and_faithful(source_id: str, offline) -> None:
    declaration = _declaration(source_id)

    acquired = _acquire(source_id)

    assert acquired.source_urls == [declaration.configuration["url"]]
    assert all(assertion["passed"] for assertion in acquired.assertions)
    # An original-file source archives bytes, never decoded rows.
    assert acquired.rows is None
    assert acquired.original_bytes == (declaration.path.parent / FIXTURE).read_bytes()


@pytest.mark.parametrize("source_id", ALL)
def test_archived_bytes_are_the_bytes_the_provider_served(
    source_id: str, offline, tmp_path: Path
) -> None:
    """A gzip payload reserialized rather than preserved would still decode, so
    the check is byte equality against the response, not readability."""
    declaration = _declaration(source_id)
    acquired = _acquire(source_id)

    snapshot, retried = archive_rows(
        root=tmp_path,
        source_id=source_id,
        acquisition_id="acq-0123456789abcdef0123456789abcdef",
        acquired_at="2026-09-16T00:00:00Z",
        source_data_date=acquired.source_data_date,
        source_urls=acquired.source_urls,
        rows=None,
        decoder_version=acquired.decoder_version,
        licence=declaration.licence,
        attribution=declaration.attribution,
        original_bytes=acquired.original_bytes,
        original_filename=acquired.original_filename,
        assertions=acquired.assertions,
    )

    # The second value marks an exact-retry no-op, and this is a first write.
    assert not retried
    manifest = validate_snapshot_manifest(
        json.loads((snapshot / "snapshot.json").read_text(encoding="utf-8"))
    )
    assert manifest.source_data_date == "2023-12-31"
    raw = snapshot / "raw.csv.gz"
    assert raw.read_bytes() == (declaration.path.parent / FIXTURE).read_bytes()


@pytest.mark.parametrize("source_id", ALL)
def test_live_access_requires_an_explicit_opt_in(source_id: str, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(_declaration(source_id), fixture=None, live=False)


@pytest.mark.parametrize("source_id", ALL)
def test_a_missing_declared_column_is_incompatible_rather_than_suspect(
    source_id: str, offline, tmp_path: Path
) -> None:
    """A column the acquisition declared and the provider withdrew leaves the
    response unreadable, so it rejects the candidate instead of archiving a
    snapshot nothing can rely on."""
    declared = _declaration(source_id).configuration["required_columns"]

    def drop_column(rows, fields):
        fields.remove(declared[-1])
        return [{name: row[name] for name in fields} for row in rows]

    with pytest.raises(SourceAcquisitionError, match="missing declared columns"):
        _acquire(source_id, _rewritten(source_id, tmp_path, drop_column))


@pytest.mark.parametrize("source_id", ALL)
def test_a_payload_that_is_not_gzip_is_incompatible(
    source_id: str, offline, tmp_path: Path
) -> None:
    fixture = tmp_path / FIXTURE
    fixture.write_bytes(b"LocID,Time\n900,2023\n")

    with pytest.raises(SourceAcquisitionError, match="not a readable gzip UTF-8 CSV"):
        _acquire(source_id, fixture)


@pytest.mark.parametrize("source_id", ALL)
def test_acquisition_names_no_country_of_its_own(
    source_id: str, offline, tmp_path: Path
) -> None:
    """Which countries must exist is a question about the provider's location
    universe, answered by whichever package declares it. An acquisition that
    failed on a missing France would make the provider contract depend on what
    some consumer happens to draw first."""

    def drop_france(rows, _fields):
        return [row for row in rows if row["ISO3_code"] != "FRA"]

    acquired = _acquire(source_id, _rewritten(source_id, tmp_path, drop_france))

    assert acquired.original_bytes
    assert all(assertion["passed"] for assertion in acquired.assertions)


@pytest.mark.parametrize("source_id", (INDICATORS, BY_AGE))
def test_a_withdrawn_world_total_is_suspect_rather_than_rejected(
    source_id: str, offline, tmp_path: Path
) -> None:
    """The world total is the provider's own aggregate, so losing it is a fact
    about the response rather than a reason to discard the countries in it."""

    def drop_world(rows, _fields):
        return [row for row in rows if row["LocID"] != "900"]

    acquired = _acquire(source_id, _rewritten(source_id, tmp_path, drop_world))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "world-total-is-published" in failed
    assert acquired.original_bytes


def test_indicator_file_represents_the_estimate_boundary_not_the_horizon(offline) -> None:
    """The file reaches 2100, but a revision's currency is how far its observed
    period runs, so the represented date is the last estimated year."""
    acquired = _acquire(INDICATORS)

    assert acquired.source_data_date == "2023-12-31"
    assert acquired.original_filename == "WPP2024_Demographic_Indicators_Medium.csv.gz"


def test_indicator_file_notices_a_boundary_year_the_provider_stopped_publishing(
    offline, tmp_path: Path
) -> None:
    def drop_boundary(rows, _fields):
        return [row for row in rows if row["Time"] != "2023"]

    acquired = _acquire(INDICATORS, _rewritten(INDICATORS, tmp_path, drop_boundary))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "declared-estimate-boundary-year-is-published" in failed


def test_scenario_file_checks_the_boundary_against_its_own_first_year(offline) -> None:
    """Unlike the medium file, this one begins where the estimates end, so the
    declared boundary is verifiable rather than only asserted to be present."""
    acquired = _acquire(SCENARIOS)

    assert acquired.source_data_date == "2023-12-31"
    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert not failed


def test_scenario_file_notices_a_withdrawn_scenario(offline, tmp_path: Path) -> None:
    def drop_low(rows, _fields):
        return [row for row in rows if row["Variant"] != "Low"]

    acquired = _acquire(SCENARIOS, _rewritten(SCENARIOS, tmp_path, drop_low))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "every-declared-scenario-is-published" in failed
    assert acquired.original_bytes


def test_scenario_file_does_not_require_a_world_total_for_a_country_only_scenario(
    offline,
) -> None:
    """The provider publishes `Mean` for countries and areas only. Asking the
    world aggregate for it would fail on the provider's own structure."""
    configuration = _declaration(SCENARIOS).configuration

    assert "Mean" in configuration["scenarios"]
    assert "Mean" not in configuration["world_total_scenarios"]
    assert all(assertion["passed"] for assertion in _acquire(SCENARIOS).assertions)


def test_age_file_publishes_every_declared_age_group(offline) -> None:
    acquired = _acquire(BY_AGE)

    assert acquired.source_data_date == "2023-12-31"
    assert len(_declaration(BY_AGE).configuration["age_groups"]) == 21
    assert all(assertion["passed"] for assertion in acquired.assertions)


def test_age_file_notices_sexes_that_stop_summing_to_the_total(
    offline, tmp_path: Path
) -> None:
    def break_the_sum(rows, _fields):
        for row in rows:
            if row["LocID"] == "900" and row["Time"] == "2023":
                row["PopTotal"] = str(float(row["PopTotal"]) + 10.0)
                break

    acquired = _acquire(BY_AGE, _rewritten(BY_AGE, tmp_path, break_the_sum))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "male-and-female-populations-sum-to-the-published-total" in failed
    assert acquired.original_bytes
