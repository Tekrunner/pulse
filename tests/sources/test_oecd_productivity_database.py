"""Offline contract coverage for the OECD Productivity Database source.

Every test runs against the recorded response, trimmed to France, Germany, the
United States and Brazil from 2018, with the network severed.
"""

from __future__ import annotations

import csv
import importlib.util
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


SOURCE_ID = "oecd-productivity-database"
AREA = "REF_AREA: Reference area"
MEASURE = "MEASURE: Measure"
PERIOD = "TIME_PERIOD: Time period"
VALUE = "OBS_VALUE: Observation value"


@pytest.fixture(name="declaration")
def _declaration():
    return discover_sources()[SOURCE_ID]


@pytest.fixture(name="offline")
def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "socket.create_connection",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("network")),
    )


def _rows(declaration) -> tuple[list[str], list[dict[str, str]]]:
    text = (declaration.path.parent / "fixture.csv").read_text(encoding="utf-8")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader.fieldnames), list(reader)


def _write(tmp_path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> Path:
    fixture = tmp_path / "fixture.csv"
    with fixture.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return fixture


def _acquire(declaration, fixture: Path | None = None):
    return acquire_from_adapter(
        declaration, fixture=fixture or declaration.path.parent / "fixture.csv", live=False
    )


def test_fixture_acquisition_is_offline_faithful_and_year_ended(declaration, offline) -> None:
    acquired = _acquire(declaration)

    assert acquired.source_urls == [declaration.configuration["url"]]
    assert acquired.source_data_date == "2025-12-31"
    assert all(assertion["passed"] for assertion in acquired.assertions)
    assert {row[MEASURE].split(":")[0] for row in acquired.rows} == set(
        declaration.configuration["key"][MEASURE]
    )


def test_codes_and_labels_survive_acquisition_unsplit(declaration, offline) -> None:
    row = next(row for row in _acquire(declaration).rows if row[AREA].startswith("FRA"))

    assert row[AREA] == "FRA: France"
    assert set(declaration.snapshot_contract["required_fields"]) <= set(row)


def test_rows_without_an_observation_are_kept_as_sent(declaration, offline) -> None:
    rows = _acquire(declaration).rows

    empty = [row for row in rows if not row[PERIOD] and not row[VALUE]]
    assert empty, "the recorded response carries the provider's observation-less rows"
    assert all(assertion["passed"] for assertion in _acquire(declaration).assertions)


def test_live_access_requires_an_explicit_opt_in(declaration, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(declaration, fixture=None, live=False)


def test_live_requests_name_the_pipeline_in_their_user_agent(declaration, monkeypatch) -> None:
    sent = {}

    def refuse(request, timeout):
        sent.update(request.header_items())
        raise OSError("stop before the network")

    spec = importlib.util.spec_from_file_location("oecd_pdb_acquire", declaration.path.parent / "acquire.py")
    adapter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(adapter)
    monkeypatch.setattr(adapter, "urlopen", refuse)

    with pytest.raises(SourceAcquisitionError, match="transport"):
        adapter.acquire(declaration.configuration, fixture=None, live=True)
    assert sent["User-agent"] == adapter.USER_AGENT


def _drop_measure(fieldnames, rows):
    return fieldnames, [row for row in rows if not row[MEASURE].startswith("HRSTO")]


def _widen_measure(fieldnames, rows):
    extra = dict(rows[0])
    extra[MEASURE] = "GVA: Gross value added"
    return fieldnames, rows + [extra]


def _duplicate(fieldnames, rows):
    dated = next(row for row in rows if row[PERIOD])
    return fieldnames, rows + [dict(dated)]


def _quarterly(fieldnames, rows):
    dated = next(row for row in rows if row[PERIOD])
    dated[PERIOD] = "2024-Q4"
    return fieldnames, rows


def _missing_column(fieldnames, rows):
    kept = [name for name in fieldnames if name != "ACTIVITY: Economic activity"]
    return kept, [{name: row[name] for name in kept} for row in rows]


@pytest.mark.parametrize(
    ("mutation", "expected"),
    (
        (_drop_measure, "unexpected values for dimension MEASURE"),
        (_widen_measure, "unexpected values for dimension MEASURE"),
        (_duplicate, "duplicate observation"),
        (_quarterly, "period format"),
        (_missing_column, "missing declared SDMX dimensions"),
    ),
)
def test_incompatible_provider_responses_are_rejected_without_a_snapshot(
    declaration, offline, tmp_path: Path, mutation, expected: str
) -> None:
    fieldnames, rows = mutation(*_rows(declaration))

    with pytest.raises(SourceAcquisitionError, match=expected):
        _acquire(declaration, _write(tmp_path, fieldnames, rows))


def test_an_edge_set_by_one_early_reporter_is_suspect(declaration, offline, tmp_path: Path) -> None:
    fieldnames, rows = _rows(declaration)
    early = dict(next(row for row in rows if row[AREA].startswith("FRA") and row[PERIOD] == "2025"))
    early[PERIOD] = "2026"

    acquired = _acquire(declaration, _write(tmp_path, fieldnames, rows + [early]))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["most_reference_areas_publish_gdp_for_the_publication_edge"]
    assert acquired.source_data_date == "2026-12-31"


def test_a_non_numeric_value_is_suspect_rather_than_rejected(declaration, offline, tmp_path: Path) -> None:
    fieldnames, rows = _rows(declaration)
    next(row for row in rows if row[PERIOD])[VALUE] = "n.a."

    acquired = _acquire(declaration, _write(tmp_path, fieldnames, rows))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_observation_value_is_numeric"]


def test_snapshot_archives_a_manifest_that_matches_its_raw_parquet(
    declaration, offline, tmp_path: Path
) -> None:
    acquired = _acquire(declaration)

    snapshot, no_op = archive_rows(
        root=tmp_path,
        source_id=SOURCE_ID,
        acquisition_id="acq-test-oecd-productivity-database",
        acquired_at="2026-09-23T08:00:00Z",
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
    assert manifest.source_data_date == "2025-12-31"


def test_declaration_carries_the_requested_schedule_and_no_placeholders(tmp_path: Path) -> None:
    package = tmp_path / SOURCE_ID
    shutil.copytree(Path("sources") / SOURCE_ID, package)

    declaration = load_source_declaration(package / "source.yaml")

    assert declaration.publication_schedule == {
        "period": "annual",
        "expected_within_days": 273,
        "grace_days": 30,
    }
    assert declaration.visibility == "public"
    assert "__" not in (package / "source.yaml").read_text(encoding="utf-8")
