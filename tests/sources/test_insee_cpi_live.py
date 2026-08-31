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
            "acquire",
            declaration.source_id,
            "--live",
            "--archive-root",
            str(tmp_path),
            "--acquisition-id",
            "acq-live-smoke",
        ]
    ) == 0
    manifest_path = next((tmp_path / declaration.source_id).glob("*/snapshot.json"))
    manifest = validate_snapshot_manifest(json.loads(manifest_path.read_text(encoding="utf-8")))
    assert manifest.source_id == declaration.source_id
    raw = manifest_path.parent / "raw.parquet"
    connection = duckdb.connect()
    try:
        archived_counts = {
            row[0]: row[1]
            for row in connection.execute(
                "SELECT IDBANK, count(*) FROM read_parquet(?) GROUP BY IDBANK", [str(raw)]
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
    assert set(archived_counts) == {item["id"] for item in declaration.configuration["series"]}
    assert all(count > 0 for count in archived_counts.values())
    assert column_types == {"VARCHAR"}
