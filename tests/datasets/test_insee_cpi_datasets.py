"""Offline conformance for independent dataset packages."""

from __future__ import annotations

import json
from pathlib import Path
import shutil

import duckdb
import pytest

from pulse.archive import archive_rows
from pulse.cli import main
from pulse.contracts.dataset import validate_dataset_manifest
from pulse.datasets import (
    DatasetError,
    build_dataset,
    discover_datasets,
    load_dataset_declaration,
)


ROOT = Path(__file__).parents[2]
ARCHIVE = ROOT / "snapshots/public"


def _build(dataset_id: str, tmp_path: Path):
    declaration = discover_datasets()[dataset_id]
    return build_dataset(
        declaration,
        archive_root=ARCHIVE,
        build_root=tmp_path / "build",
        publish_root=tmp_path / "publish" / dataset_id,
    )


def test_dataset_packages_are_discovered_independently() -> None:
    declarations = discover_datasets()
    assert set(declarations) == {"insee-cpi-monthly", "insee-cpi-category-analysis"}
    assert all("/" not in item.dataset_id for item in declarations.values())
    assert all(item.source_id == "insee-cpi" for item in declarations.values())
    assert all((item.path.parent / "dataset-contract.md").is_file() for item in declarations.values())


def test_monthly_build_preserves_analytical_rows_schema_and_bytes(tmp_path: Path) -> None:
    manifest = _build("insee-cpi-monthly", tmp_path)
    parquet = tmp_path / "publish/insee-cpi-monthly/dataset.parquet"
    connection = duckdb.connect()
    try:
        summary = connection.execute(
            "SELECT count(*), count(DISTINCT period), min(period)::VARCHAR, max(period)::VARCHAR FROM read_parquet(?)",
            [str(parquet)],
        ).fetchone()
        schema = {
            name: kind
            for name, kind, *_ in connection.execute(
                "DESCRIBE SELECT * FROM read_parquet(?)", [str(parquet)]
            ).fetchall()
        }
    finally:
        connection.close()
    assert manifest.dataset_id == "insee-cpi-monthly"
    assert manifest.content_sha256 == "39e166e9ee601157f50977183bb18c46cb2b7cbe5e1f77925e829453f22680bf"
    assert summary == (367, 367, "1996-01-01", "2026-07-01")
    assert schema == {
        "period": "DATE",
        "cpi_index": "DECIMAL(12,2)",
        "monthly_change_pct": "DECIMAL(8,1)",
        "annual_change_pct": "DECIMAL(8,1)",
    }
    assert manifest.lineage["snapshot_id"].startswith("acq-cd64f5f9e5bb443c94b6fb004a534b8a-")


def test_category_build_preserves_rows_and_documents_calculated_rent(tmp_path: Path) -> None:
    manifest = _build("insee-cpi-category-analysis", tmp_path)
    parquet = tmp_path / "publish/insee-cpi-category-analysis/dataset.parquet"
    connection = duckdb.connect()
    try:
        result = connection.execute(
            """SELECT count(*), min(period)::VARCHAR, max(period)::VARCHAR,
                      count(*) FILTER (WHERE actual_rent_weight_reference_year > year(period)),
                      count(*) FILTER (
                        WHERE abs(actual_rent_pulse_contribution_pct_points
                          - round(actual_rent_weight / 10000.0 * actual_rent_annual_change_pct, 3)) > 0.0005)
               FROM read_parquet(?)""",
            [str(parquet)],
        ).fetchone()
    finally:
        connection.close()
    assert manifest.dataset_id == "insee-cpi-category-analysis"
    assert manifest.content_sha256 == "a86b88c65c79ca17dd68eb5748e82667e78ce709fbbdc06fd6cd0e4c99849fca"
    assert result == (343, "1998-01-01", "2026-07-01", 0, 0)
    indicators = {item["column"]: item for item in manifest.indicators}
    rent = indicators["actual_rent_pulse_contribution_pct_points"]
    assert rent["source"] == "Pulse calculation from INSEE series"
    assert "not an official INSEE contribution" in rent["definition"]
    assert manifest.lineage["snapshot_id"].startswith("acq-cd64f5f9e5bb443c94b6fb004a534b8a-")


def test_generated_manifest_must_equal_committed_contract(tmp_path: Path) -> None:
    manifest = _build("insee-cpi-monthly", tmp_path).to_dict()
    declaration = discover_datasets()["insee-cpi-monthly"]
    manifest["columns"][1]["description"] = "silently changed"
    with pytest.raises(ValueError, match="semantics disagree"):
        validate_dataset_manifest(manifest, declaration.contract)


def test_cli_builds_all_datasets_without_source_replay(tmp_path: Path) -> None:
    assert main(
        [
            "dataset",
            "build",
            "all",
            "--archive-root",
            str(ARCHIVE),
            "--build-root",
            str(tmp_path / "build"),
            "--publish-root",
            str(tmp_path / "publish"),
        ]
    ) == 0
    assert (tmp_path / "publish/insee-cpi-monthly/dataset.json").is_file()
    assert (tmp_path / "publish/insee-cpi-category-analysis/dataset.json").is_file()


def test_invalid_snapshot_retains_previous_dataset(tmp_path: Path) -> None:
    declaration = discover_datasets()["insee-cpi-monthly"]
    target = tmp_path / "publish/insee-cpi-monthly"
    build_dataset(declaration, archive_root=ARCHIVE, build_root=tmp_path / "build", publish_root=target)
    before = (target / "dataset.parquet").read_bytes()
    archive = tmp_path / "archive"
    shutil.copytree(ARCHIVE, archive)
    for parquet in (archive / "insee-cpi").glob("*/raw.parquet"):
        parquet.write_text("version https://git-lfs.github.com/spec/v1\n", encoding="utf-8")
    with pytest.raises(DatasetError, match="snapshot contract is invalid"):
        build_dataset(declaration, archive_root=archive, build_root=tmp_path / "bad-build", publish_root=target)
    assert (target / "dataset.parquet").read_bytes() == before


def test_neutral_dataset_package_builds_without_shared_runtime_changes(tmp_path: Path) -> None:
    archive = tmp_path / "archive"
    snapshot, _ = archive_rows(
        root=archive,
        source_id="example-source",
        acquisition_id="acq-example",
        acquired_at="2026-09-03T10:00:00Z",
        source_data_date="2026-09-01",
        source_urls=["https://example.test/data"],
        rows=[{"period": "2026-09", "value": "42"}],
        decoder_version="fixture-v1",
        licence="Open",
        attribution="Example",
    )
    package = tmp_path / "datasets/example-dataset"
    package.mkdir(parents=True)
    (package / "dataset.yaml").write_text(
        "id: example-dataset\nname: Example\nsource: example-source\nvisibility: public\n"
        "logical_table: example_dataset\ncontract: dataset-contract.yaml\n",
        encoding="utf-8",
    )
    (package / "dataset-contract.yaml").write_text(
        "contract_version: 1.0.0\nmodel: {name: example_dataset, description: Example dataset.}\n"
        "columns:\n  - {name: value, type: BIGINT, description: Example value.}\n"
        "indicators:\n  - {column: value, definition: Example value., unit: Count, source: Example, licence: Open, attribution: Example}\n",
        encoding="utf-8",
    )
    (package / "build.py").write_text(
        "from pulse.datasets import DatasetBuildResult\n"
        "import duckdb\n"
        "def build(context):\n"
        "    selected = context.snapshots[0]\n"
        "    con = duckdb.connect()\n"
        "    target = \"'\" + str(context.output_path).replace(\"'\", \"''\") + \"'\"\n"
        "    con.execute(f\"COPY (SELECT cast(\\\"value\\\" as BIGINT) as \\\"value\\\" FROM read_parquet(?)) TO {target} (FORMAT PARQUET)\", [str(selected.parquet)])\n"
        "    con.close()\n"
        "    return DatasetBuildResult(selected, {\"start\": \"2026-09-01\", \"end\": \"2026-09-01\"}, {\"state\": \"succeeded\", \"assertions\": []}, {})\n",
        encoding="utf-8",
    )
    source_package = tmp_path / "sources/example-source"
    source_package.mkdir(parents=True)
    (source_package / "source.yaml").write_text(
        "id: example-source\nname: Example source\nvisibility: public\n"
        "snapshot_contract: snapshot-contract.yaml\nacquisition: {native: example}\n"
        "fetch_cadence: monthly\nexpected_publication_advance: monthly\n"
        "licence: Open\nattribution: Example\n",
        encoding="utf-8",
    )
    (source_package / "snapshot-contract.yaml").write_text(
        "contract_version: 1.0.0\nformat: parquet\ncompatible_additions: true\n"
        "required_fields:\n  period: string\n  value: string\n",
        encoding="utf-8",
    )
    declaration = load_dataset_declaration(package / "dataset.yaml")
    manifest = build_dataset(
        declaration,
        archive_root=archive,
        build_root=tmp_path / "build",
        publish_root=tmp_path / "publish/example-dataset",
        sources_root=tmp_path / "sources",
    )
    assert snapshot.name == manifest.lineage["snapshot_id"]
    assert manifest.dataset_id == "example-dataset"


def test_shared_runtime_and_source_package_have_no_cpi_dataset_knowledge() -> None:
    forbidden = ("insee-cpi", "011814056", "actual_rent", "cpi_index")
    runtime_files = list((ROOT / "runtime/pulse").rglob("*.py"))
    for path in runtime_files:
        content = path.read_text(encoding="utf-8")
        assert not any(token in content for token in forbidden), path
    source_files = list((ROOT / "sources/insee-cpi").rglob("*"))
    assert not any(path.is_file() and "dbt" in path.parts for path in source_files)
    source_contract = (ROOT / "sources/insee-cpi/source-contract.md").read_text(encoding="utf-8")
    assert "actual_rent_annual_change_pct" not in source_contract
