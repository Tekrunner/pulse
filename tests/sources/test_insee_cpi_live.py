from __future__ import annotations

import json
import os
from pathlib import Path

import duckdb
import pytest

from pulse.cli import main
from pulse.contracts.snapshot import validate_snapshot_manifest
from pulse.sources import discover_sources


pytestmark = pytest.mark.live


@pytest.mark.skipif(os.environ.get("PULSE_LIVE_INSEE") != "1", reason="set PULSE_LIVE_INSEE=1")
def test_live_insee_contract_and_temporary_archive(tmp_path: Path) -> None:
    declaration = discover_sources()["insee-cpi"]
    assert main(
        [
            "source",
            "refresh",
            declaration.source_id,
            "--live",
            "--archive-root",
            str(tmp_path),
            "--build-root",
            str(tmp_path / "build"),
            "--publish-root",
            str(tmp_path / "publish"),
            "--logical-run-key",
            "acq-live-smoke",
        ]
    ) == 0
    manifest_path = next((tmp_path / declaration.source_id).glob("*/snapshot.json"))
    manifest = validate_snapshot_manifest(json.loads(manifest_path.read_text(encoding="utf-8")))
    assert manifest.source_id == declaration.source_id
    raw = manifest_path.parent / "raw.parquet"
    connection = duckdb.connect()
    try:
        archived_series = {
            row[0]: {"count": row[1], "title": row[2], "frequency": row[3]}
            for row in connection.execute(
                """
                SELECT IDBANK, count(*), min(TITLE_FR), min(FREQ)
                FROM read_parquet(?)
                GROUP BY IDBANK
                """,
                [str(raw)],
            ).fetchall()
        }
        column_types = {
            row[1]
            for row in connection.execute(
                "DESCRIBE SELECT * FROM read_parquet(?)", [str(raw)]
            ).fetchall()
        }
    finally:
        connection.close()
    declared = {item["id"]: item["name"] for item in declaration.configuration["series"]}
    assert set(archived_series) == set(declared)
    assert all(series["count"] > 0 for series in archived_series.values())
    assert {series_id: series["title"] for series_id, series in archived_series.items()} == declared
    annual_weights = {"011814578", "011814509", "011815638", "011814579", "011814496"}
    assert {
        series_id: series["frequency"] for series_id, series in archived_series.items()
    } == {
        series_id: "A" if series_id in annual_weights else "M" for series_id in declared
    }
    assert column_types == {"VARCHAR"}
