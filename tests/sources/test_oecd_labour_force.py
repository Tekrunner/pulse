"""Offline contract coverage for the two OECD labour-force sources.

They share a provider, a representation and a release calendar but not a
frequency, so the tests run the shared invariants over both and the
frequency-specific ones separately.
"""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path
import shutil

import pytest

from pulse.archive import archive_rows
from pulse.contracts.snapshot import validate_snapshot_manifest
from pulse.sources import (
    SourceAcquisitionError,
    acquire_from_adapter,
    discover_sources,
    load_source_declaration,
)


UNEMPLOYMENT = "oecd-unemployment-rate"
PARTICIPATION = "oecd-participation-rate"
BOTH = (UNEMPLOYMENT, PARTICIPATION)
AREA = "REF_AREA: Reference area"
SEX = "SEX: Sex"
PERIOD = "TIME_PERIOD: Time period"
VALUE = "OBS_VALUE: Observation value"


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
        declaration, fixture=fixture or declaration.path.parent / "fixture.csv", live=False
    )


def _rewritten(source_id: str, tmp_path: Path, mutate) -> Path:
    declaration = _declaration(source_id)
    with (declaration.path.parent / "fixture.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    fields = list(rows[0])
    rows = mutate(rows) or rows
    fixture = tmp_path / "fixture.csv"
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
    fixture.write_text(buffer.getvalue(), encoding="utf-8", newline="")
    return fixture


@pytest.mark.parametrize("source_id", BOTH)
def test_fixture_acquisition_is_offline_and_faithful(source_id: str, offline) -> None:
    declaration = _declaration(source_id)

    acquired = _acquire(source_id)

    assert acquired.source_urls == [declaration.configuration["url"]]
    assert acquired.rows
    assert all(assertion["passed"] for assertion in acquired.assertions)
    assert set(declaration.snapshot_contract["required_fields"]) <= set(acquired.rows[0])


@pytest.mark.parametrize("source_id", BOTH)
def test_codes_and_labels_both_survive_in_one_column(source_id: str, offline) -> None:
    """SDMX-CSV 2.0 is chosen precisely so neither half has to be dropped."""
    row = _acquire(source_id).rows[0]

    code, separator, label = row[AREA].partition(":")
    assert separator and code.strip() and label.strip()
    # No two columns may differ only in case: the Parquet writer cannot store
    # such a payload, which is why the labelled file format is not used.
    names = [name.lower() for name in row]
    assert len(names) == len(set(names))


@pytest.mark.parametrize("source_id", BOTH)
def test_live_access_requires_an_explicit_opt_in(source_id: str, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(_declaration(source_id), fixture=None, live=False)


@pytest.mark.parametrize("source_id", BOTH)
def test_a_response_that_widens_beyond_the_pinned_key_is_rejected(
    source_id: str, offline, tmp_path: Path
) -> None:
    pinned = next(iter(_declaration(source_id).configuration["key"]))

    def widen(rows):
        rows[0][pinned] = "OTHER: Something the key did not ask for"

    with pytest.raises(SourceAcquisitionError, match="unexpected values for dimension"):
        _acquire(source_id, _rewritten(source_id, tmp_path, widen))


@pytest.mark.parametrize("source_id", BOTH)
def test_acquisition_names_no_reference_area_of_its_own(
    source_id: str, offline, tmp_path: Path
) -> None:
    """Which areas must exist is a question about OECD membership, answered by
    the dataset package that declares it. An acquisition that failed on a
    missing France would make the provider contract depend on what some
    consumer happens to draw first."""

    def drop_france(rows):
        return [row for row in rows if not row[AREA].startswith("FRA")]

    acquired = _acquire(source_id, _rewritten(source_id, tmp_path, drop_france))

    assert acquired.rows
    assert "FRA" not in {row[AREA].split(":")[0].strip() for row in acquired.rows}
    assert not [item["check"] for item in acquired.assertions if not item["passed"]]


def test_an_area_left_far_behind_the_publication_edge_is_suspect(offline, tmp_path: Path) -> None:
    """The lag assertion measures the slowest area in the response, so a laggard
    is visible without any area being named in the contract. Run against the
    monthly source, whose fixture spans enough periods to exceed the tolerance."""

    def strand_germany(rows):
        oldest = min(row[PERIOD] for row in rows)
        return [
            row for row in rows if not row[AREA].startswith("DEU") or row[PERIOD] == oldest
        ]

    acquired = _acquire(UNEMPLOYMENT, _rewritten(UNEMPLOYMENT, tmp_path, strand_germany))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "every_reference_area_is_within_four_months_of_the_publication_edge" in failed
    # Suspect, never rejected: a slow reporter is provider structure to show.
    assert acquired.rows


@pytest.mark.parametrize("source_id", BOTH)
def test_an_impossible_rate_is_suspect_rather_than_rejected(
    source_id: str, offline, tmp_path: Path
) -> None:
    def implausible(rows):
        rows[0][VALUE] = "250.0"

    acquired = _acquire(source_id, _rewritten(source_id, tmp_path, implausible))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_rate_lies_within_zero_and_one_hundred"]
    assert acquired.rows


def test_monthly_source_represents_the_publication_edge_not_the_slowest_member(offline) -> None:
    """Countries reach the edge at different speeds; the date is the edge."""
    acquired = _acquire(UNEMPLOYMENT)

    periods = {row[PERIOD] for row in acquired.rows}
    assert acquired.source_data_date == "2026-08-31"
    assert max(periods) == "2026-08"
    # The United Kingdom is structurally behind, and that spread is reported
    # through an assertion rather than by back-dating the whole snapshot.
    british = {row[PERIOD] for row in acquired.rows if row[AREA].startswith("GBR")}
    assert max(british) < max(periods)
    assert all(assertion["passed"] for assertion in acquired.assertions)


def test_quarterly_source_carries_all_three_sex_breakdowns(offline) -> None:
    acquired = _acquire(PARTICIPATION)

    assert acquired.source_data_date == "2026-06-30"
    assert {row[SEX].split(":")[0] for row in acquired.rows} == {"_T", "M", "F"}


def test_quarterly_source_rejects_an_unexpected_sex_breakdown(offline, tmp_path: Path) -> None:
    def drop_women(rows):
        return [row for row in rows if not row[SEX].startswith("F")]

    with pytest.raises(SourceAcquisitionError, match="sex breakdowns"):
        _acquire(PARTICIPATION, _rewritten(PARTICIPATION, tmp_path, drop_women))


def test_a_declared_sex_gap_does_not_make_the_snapshot_suspect(offline, tmp_path: Path) -> None:
    """Croatia is declared as carrying totals without a men/women split for part
    of its history. The same omission that is a fault elsewhere is provider
    history here, so the assertion has to tell them apart."""

    def drop_croatian_women(rows):
        return [
            row
            for row in rows
            if not (row[AREA].startswith("HRV") and row[SEX].startswith("F"))
        ]

    acquired = _acquire(PARTICIPATION, _rewritten(PARTICIPATION, tmp_path, drop_croatian_women))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "men_and_women_are_reported_wherever_a_total_is" not in failed


def test_missing_sex_split_outside_the_known_gaps_is_suspect(offline, tmp_path: Path) -> None:
    def drop_french_women(rows):
        return [
            row
            for row in rows
            if not (row[AREA].startswith("FRA") and row[SEX].startswith("F") and row[PERIOD] == "2026-Q2")
        ]

    acquired = _acquire(PARTICIPATION, _rewritten(PARTICIPATION, tmp_path, drop_french_women))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert "men_and_women_are_reported_wherever_a_total_is" in failed
    assert acquired.rows


@pytest.mark.parametrize("source_id", BOTH)
def test_snapshot_archives_a_manifest_that_matches_its_raw_parquet(
    source_id: str, offline, tmp_path: Path
) -> None:
    declaration = _declaration(source_id)
    acquired = _acquire(source_id)

    snapshot, no_op = archive_rows(
        root=tmp_path,
        source_id=source_id,
        acquisition_id=f"acq-test-{source_id}",
        acquired_at="2026-09-14T10:00:00Z",
        source_data_date=acquired.source_data_date,
        source_urls=acquired.source_urls,
        rows=acquired.rows,
        decoder_version=acquired.decoder_version,
        licence=declaration.licence,
        attribution=declaration.attribution,
        assertions=acquired.assertions,
    )

    assert no_op is False
    manifest = validate_snapshot_manifest(
        json.loads((snapshot / "snapshot.json").read_text(encoding="utf-8"))
    )
    assert manifest.format == "parquet"
    assert manifest.source_data_date == acquired.source_data_date
    # CC BY 4.0 obliges an adaptation to carry the OECD disclaimer.
    assert "adaptation of an original work by the OECD" in manifest.attribution


def test_the_two_oecd_sources_declare_different_frequencies(tmp_path: Path) -> None:
    schedules = {}
    for source_id in BOTH:
        package = tmp_path / source_id
        shutil.copytree(Path("sources") / source_id, package)
        schedules[source_id] = load_source_declaration(package / "source.yaml").publication_schedule

    # One source for both would advertise the quarterly series as being as fresh
    # as the monthly one, every month of the year.
    assert schedules[UNEMPLOYMENT]["period"] == "monthly"
    assert schedules[PARTICIPATION]["period"] == "quarterly"
