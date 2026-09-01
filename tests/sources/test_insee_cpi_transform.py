"""Offline conformance tests for the immutable INSEE replay slice."""

from __future__ import annotations

import json
from pathlib import Path
import shutil
from types import SimpleNamespace
from datetime import date

import duckdb
import pytest

from pulse.contracts.landing import validate_landing_manifest
from pulse.contracts.dataset import validate_diagnostic
from pulse import transform
from pulse.transform import TransformError, _validate_candidate, _write_landing, replay_insee


ROOT = Path(__file__).parents[2]
ARCHIVE = ROOT / "snapshots/public"


def _quoted(path: Path) -> str:
    return "'" + str(path).replace("'", "''") + "'"


def _roots(tmp_path: Path) -> dict[str, Path]:
    return {
        "archive_root": ARCHIVE,
        "landing_root": tmp_path / "landing",
        "publish_root": tmp_path / "publish/insee-cpi/monthly",
    }


def test_clean_raw_replay_publishes_the_documented_monthly_model(tmp_path: Path) -> None:
    roots = _roots(tmp_path)

    manifest = replay_insee(**roots)

    landing = json.loads((roots["landing_root"] / "landing.json").read_text(encoding="utf-8"))
    dataset = json.loads((roots["publish_root"] / "dataset.json").read_text(encoding="utf-8"))
    connection = duckdb.connect()
    try:
        rows, periods, start, end = connection.execute(
            "SELECT count(*), count(DISTINCT period), min(period)::VARCHAR, max(period)::VARCHAR FROM read_parquet(?)",
            [str(roots["publish_root"] / "dataset.parquet")],
        ).fetchone()
        schema = {
            name: kind
            for name, kind, *_ in connection.execute(
                "DESCRIBE SELECT * FROM read_parquet(?)", [str(roots["publish_root"] / "dataset.parquet")]
            ).fetchall()
        }
    finally:
        connection.close()

    assert validate_landing_manifest(landing).row_count == 1101
    assert manifest.dataset_id == "insee-cpi/monthly"
    assert dataset["logical_table"] == "insee_cpi_monthly"
    assert dataset["status"] == {
        "state": "suspect",
        "assertions": [{"check": "release_calendar_freshness", "affected_columns": []}],
    }
    assert (rows, periods, start, end) == (367, 367, "1996-01-01", "2026-07-01")
    assert schema == {
        "period": "DATE",
        "cpi_index": "DECIMAL(12,2)",
        "monthly_change_pct": "DECIMAL(8,1)",
        "annual_change_pct": "DECIMAL(8,1)",
    }


def test_repeated_clean_replay_has_equivalent_content_and_metadata(tmp_path: Path) -> None:
    first = replay_insee(**_roots(tmp_path / "first"))
    second = replay_insee(**_roots(tmp_path / "second"))

    assert first.content_sha256 == second.content_sha256
    assert first.represented_period == second.represented_period
    assert first.columns == second.columns
    assert first.indicators == second.indicators


def test_lfs_rejection_retains_the_previously_published_dataset(tmp_path: Path) -> None:
    archive_root = tmp_path / "snapshots"
    shutil.copytree(ARCHIVE, archive_root)
    roots = _roots(tmp_path)
    roots["archive_root"] = archive_root
    replay_insee(**roots)
    published = roots["publish_root"] / "dataset.parquet"
    before = published.read_bytes()

    raw = next((archive_root / "insee-cpi").glob("*/raw.parquet"))
    raw.write_text("version https://git-lfs.github.com/spec/v1\n", encoding="utf-8")

    with pytest.raises(TransformError, match="snapshot contract is invalid"):
        replay_insee(**roots)
    assert published.read_bytes() == before
    diagnostic = validate_diagnostic(
        json.loads((roots["publish_root"].parent / "diagnostic.json").read_text(encoding="utf-8"))
    )
    assert diagnostic["code"] == "candidate_rejected"


def test_compatible_provider_attribute_is_recorded_in_landing(tmp_path: Path) -> None:
    raw = next((ARCHIVE / "insee-cpi").glob("*/raw.parquet"))
    evolved = tmp_path / "evolved.parquet"
    connection = duckdb.connect()
    try:
        connection.execute(
            f"COPY (SELECT *, 'kept'::VARCHAR AS provider_addition FROM read_parquet(?)) TO {_quoted(evolved)} (FORMAT PARQUET)",
            [str(raw)],
        )
    finally:
        connection.close()

    _, manifest = _write_landing(
        evolved,
        SimpleNamespace(snapshot_id="acq-test", artifacts=[{"sha256": "a" * 64}]),
        tmp_path / "landing",
    )

    assert manifest.compatible_additions == ["provider_addition"]
    assert manifest.observed_schema["provider_addition"] == "VARCHAR"


def test_missing_required_landing_field_is_rejected(tmp_path: Path) -> None:
    raw = next((ARCHIVE / "insee-cpi").glob("*/raw.parquet"))
    invalid = tmp_path / "invalid.parquet"
    connection = duckdb.connect()
    try:
        connection.execute(
            f"COPY (SELECT * EXCLUDE (FREQ) FROM read_parquet(?)) TO {_quoted(invalid)} (FORMAT PARQUET)",
            [str(raw)],
        )
    finally:
        connection.close()

    with pytest.raises(TransformError, match="missing required INSEE contract fields"):
        _write_landing(invalid, SimpleNamespace(snapshot_id="acq-test"), tmp_path / "landing")


def test_duplicate_provider_grain_is_rejected_before_widening(tmp_path: Path) -> None:
    raw = next((ARCHIVE / "insee-cpi").glob("*/raw.parquet"))
    invalid = tmp_path / "duplicate.parquet"
    connection = duckdb.connect()
    try:
        connection.execute(
            f"COPY ((SELECT * FROM read_parquet(?)) UNION ALL (SELECT * FROM read_parquet(?) LIMIT 1)) TO {_quoted(invalid)} (FORMAT PARQUET)",
            [str(raw), str(raw)],
        )
    finally:
        connection.close()

    with pytest.raises(TransformError, match="declared INSEE series contract"):
        _write_landing(invalid, SimpleNamespace(snapshot_id="acq-test"), tmp_path / "landing")


def test_contract_valid_assertion_failure_is_suspect(tmp_path: Path) -> None:
    roots = _roots(tmp_path)
    replay_insee(**roots)
    suspect = tmp_path / "suspect.parquet"
    connection = duckdb.connect()
    try:
        connection.execute(
            f"COPY (SELECT period, cpi_index, CASE WHEN period = DATE '2026-07-01' THEN 99.9::DECIMAL(8,1) ELSE monthly_change_pct END AS monthly_change_pct, annual_change_pct FROM read_parquet(?)) TO {_quoted(suspect)} (FORMAT PARQUET)",
            [str(roots["publish_root"] / "dataset.parquet")],
        )
    finally:
        connection.close()

    _, status, _ = _validate_candidate(suspect)

    assert status["state"] == "suspect"
    assert {failure["check"] for failure in status["assertions"]} >= {"provider_monthly_change"}


def test_release_calendar_allows_a_slow_indicator_until_its_next_due_window(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class AugustTwentieth(date):
        @classmethod
        def today(cls) -> date:
            return cls(2026, 8, 20)

    monkeypatch.setattr(transform, "date", AugustTwentieth)

    assert not transform._is_stale("2026-07-01", "monthly; after publication")
    assert not transform._is_stale("2026-01-01", "annual; after publication")
