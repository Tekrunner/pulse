"""Source-neutral dataset creation and schema-evolution conformance."""

from __future__ import annotations

import json
import hashlib
from pathlib import Path
import shutil

import duckdb
import pytest
import yaml

from pulse.archive import archive_rows
from pulse.contracts.dataset import DATASET_SCHEMA_ID, DatasetManifest
from pulse.datasets import (
    DatasetError,
    _publish_pair,
    build_dataset,
    classify_schema_change,
    inventory_dataset_consumers,
    load_dataset_declaration,
    load_schema_change,
)
from pulse.cli import main


ROOT = Path(__file__).parents[2]
ASSET = ROOT / ".agents/skills/pulse-add-dataset/assets/dataset-package"


def _source(root: Path) -> None:
    package = root / "example-public-source"
    package.mkdir(parents=True)
    (package / "source.yaml").write_text(
        "id: example-public-source\nname: Example\nvisibility: public\n"
        "snapshot_contract: snapshot-contract.yaml\nacquisition: {url: 'https://example.test/data.csv'}\n"
        "fetch_cadence: monthly\nexpected_publication_advance: monthly\n"
        "publication_schedule: {period: monthly, expected_within_days: 15, grace_days: 7}\n"
        "licence: Open\nattribution: Example\n",
        encoding="utf-8",
    )
    (package / "snapshot-contract.yaml").write_text(
        "contract_version: 1.0.0\nformat: original-file\ncompatible_additions: true\nrequired_fields: {}\n",
        encoding="utf-8",
    )


def test_neutral_skill_fixture_decodes_original_file_with_dbt(tmp_path: Path) -> None:
    package = tmp_path / "datasets/example-dataset"
    shutil.copytree(ASSET, package)
    sources = tmp_path / "sources"
    _source(sources)
    archive = tmp_path / "snapshots"
    snapshot, _ = archive_rows(
        root=archive,
        source_id="example-public-source",
        acquisition_id="example-acquisition",
        acquired_at="2026-09-12T10:00:00Z",
        source_data_date="2026-08-01",
        source_urls=["https://example.test/data.csv"],
        rows=None,
        original_bytes=b"period,value\n2026-07,12.50\n2026-08,13.25\n",
        original_filename="observations.csv",
        decoder_version="csv-v1",
        licence="Open",
        attribution="Example",
    )
    declaration = load_dataset_declaration(package / "dataset.yaml")
    manifest = build_dataset(
        declaration,
        archive_root=archive,
        build_root=tmp_path / "build",
        publish_root=tmp_path / "publish/example-dataset",
        sources_root=sources,
    )
    assert manifest.lineage["snapshot_id"] == snapshot.name
    assert manifest.lineage["input_format"] == "original-file"
    assert manifest.questions[0]["id"] == "example-value-over-time"
    connection = duckdb.connect()
    try:
        assert connection.execute(
            "SELECT count(*), min(example_value), max(example_value) FROM read_parquet(?)",
            [str(tmp_path / "publish/example-dataset/dataset.parquet")],
        ).fetchone() == (2, 12.50, 13.25)
    finally:
        connection.close()


def test_schema_change_classification_and_conservative_inventory(tmp_path: Path) -> None:
    old = [
        {"name": "period", "type": "DATE", "description": "Period"},
        {"name": "value", "type": "BIGINT", "description": "Value"},
    ]
    additive = old + [{"name": "label", "type": "VARCHAR", "description": "Label"}]
    assert classify_schema_change(old, additive)["classification"] == "compatible-addition"
    retyped = [old[0], {**old[1], "type": "DOUBLE"}]
    assert classify_schema_change(old, retyped)["classification"] == "breaking-consumer-change"
    report = tmp_path / "site/reports/example/report.js"
    report.parent.mkdir(parents=True)
    report.write_text(
        'client.query("example-dataset", "SELECT period, value FROM example_table")',
        encoding="utf-8",
    )
    visual = tmp_path / "site/visuals/example.contract.js"
    visual.parent.mkdir(parents=True)
    visual.write_text('export const columns = ["period", "value"]', encoding="utf-8")
    inventory = inventory_dataset_consumers(
        "example-dataset", logical_table="example_table", columns=["period", "value"], root=tmp_path
    )
    indexed = {item["path"]: item for item in inventory}
    assert indexed["site/reports/example/report.js"]["kind"] == "sql-or-exploration-query"
    assert indexed["site/visuals/example.contract.js"]["kind"] == "visual-contract-or-fixture"
    assert indexed["site/visuals/example.contract.js"]["ambiguous"] is True


def test_publication_interruption_restores_coherent_previous_pair(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    target = tmp_path / "publish/example"
    target.mkdir(parents=True)
    (target / "dataset.parquet").write_bytes(b"old parquet")
    old_manifest = {"content": "old"}
    (target / "dataset.json").write_text(json.dumps(old_manifest), encoding="utf-8")
    (target / "attempt.json").write_text("{}", encoding="utf-8")
    candidate = tmp_path / "candidate.parquet"
    candidate.write_bytes(b"new parquet")
    manifest = DatasetManifest(
        DATASET_SCHEMA_ID,
        "1.0.0",
        "example",
        "source",
        "example_table",
        "public",
        "dataset.parquet",
        "a" * 64,
        {"start": "2026-01-01", "end": "2026-01-01"},
        {},
        {"name": "example_table", "description": "Example"},
        [{"name": "value", "type": "BIGINT", "description": "Value"}],
        [],
        {"state": "succeeded", "assertions": []},
    )
    original_replace = Path.replace
    interrupted = False

    def fail_candidate_swap(self: Path, destination: Path):
        nonlocal interrupted
        if self.name.startswith(".example-publish-") and not interrupted:
            interrupted = True
            raise OSError("simulated interruption")
        return original_replace(self, destination)

    monkeypatch.setattr(Path, "replace", fail_candidate_swap)
    with pytest.raises(OSError, match="simulated interruption"):
        _publish_pair(target, candidate, manifest)
    assert (target / "dataset.parquet").read_bytes() == b"old parquet"
    assert json.loads((target / "dataset.json").read_text(encoding="utf-8")) == old_manifest


def test_breaking_schema_change_requires_a_complete_plan(tmp_path: Path) -> None:
    package = tmp_path / "datasets/example-dataset"
    shutil.copytree(ASSET, package)
    declaration = load_dataset_declaration(package / "dataset.yaml")
    target = tmp_path / "publish/example-dataset"
    target.mkdir(parents=True)
    previous = DatasetManifest(
        DATASET_SCHEMA_ID,
        "1.0.0",
        "example-dataset",
        "example-public-source",
        "example_dataset",
        "public",
        "dataset.parquet",
        "a" * 64,
        {"start": "2026-01-01", "end": "2026-01-01"},
        {},
        declaration.contract.model,
        declaration.contract.columns + [{"name": "removed_value", "type": "BIGINT", "description": "Old"}],
        declaration.contract.indicators,
        {"state": "succeeded", "assertions": []},
    )
    (target / "dataset.json").write_text(json.dumps(previous.to_dict()), encoding="utf-8")
    sources = tmp_path / "sources"
    _source(sources)
    with pytest.raises(DatasetError, match="without a classified consumer-impact plan"):
        build_dataset(
            declaration,
            archive_root=tmp_path / "snapshots",
            build_root=tmp_path / "build",
            publish_root=target,
            sources_root=sources,
        )


def test_dataset_impact_cli_reports_addition_and_code_owned_consumers(
    capsys: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    published = tmp_path / "publish/insee-cpi-monthly"
    published.mkdir(parents=True)
    shutil.copy(ROOT / "publish/public/data/insee-cpi-monthly/dataset.json", published / "dataset.json")
    proposed = yaml.safe_load((ROOT / "datasets/insee-cpi-monthly/dataset-contract.yaml").read_text(encoding="utf-8"))
    proposed["contract_version"] = "1.1.0"
    proposed["columns"].append({"name": "release_note", "type": "VARCHAR", "description": "Provider release note."})
    contract = tmp_path / "proposed.yaml"
    contract.write_text(yaml.safe_dump(proposed, sort_keys=False), encoding="utf-8")
    consumer = tmp_path / "site/reports/example/report.js"
    consumer.parent.mkdir(parents=True)
    consumer.write_text(
        'client.query("insee-cpi-monthly", "SELECT period, cpi_index FROM insee_cpi_monthly")',
        encoding="utf-8",
    )
    output = tmp_path / "impact.json"
    assert main([
        "dataset", "impact", "insee-cpi-monthly", "--contract", str(contract),
        "--publish-root", str(tmp_path / "publish"), "--root", str(tmp_path), "--output", str(output),
    ]) == 0
    result = json.loads(output.read_text(encoding="utf-8"))
    assert result["classification"] == "compatible-addition"
    assert result["added"] == ["release_note"]
    assert {item["path"] for item in result["consumers"]} >= {"site/reports/example/report.js"}
    assert "pulse dataset impact wrote" in capsys.readouterr().out


def _original_fixture(tmp_path: Path) -> tuple[Path, Path, Path, Path]:
    package = tmp_path / "datasets/example-dataset"
    shutil.copytree(ASSET, package)
    sources = tmp_path / "sources"
    _source(sources)
    archive = tmp_path / "snapshots"
    archive_rows(
        root=archive, source_id="example-public-source", acquisition_id="example-first",
        acquired_at="2026-09-01T10:00:00Z", source_data_date="2026-08-01",
        source_urls=["https://example.test/data.csv"], rows=None,
        original_bytes=b"period,value\n2026-07,12.50\n2026-08,13.25\n",
        original_filename="observations.csv", decoder_version="csv-v1", licence="Open", attribution="Example",
    )
    target = tmp_path / "publish/example-dataset"
    build_dataset(
        load_dataset_declaration(package / "dataset.yaml"), archive_root=archive,
        build_root=tmp_path / "build", publish_root=target, sources_root=sources,
    )
    return package, sources, archive, target


def _write_change(package: Path, raw: dict) -> None:
    (package / "schema-change.yaml").write_text(yaml.safe_dump(raw, sort_keys=False), encoding="utf-8")
    declaration = yaml.safe_load((package / "dataset.yaml").read_text(encoding="utf-8"))
    declaration["schema_change"] = "schema-change.yaml"
    (package / "dataset.yaml").write_text(yaml.safe_dump(declaration, sort_keys=False), encoding="utf-8")


def test_complete_breaking_migration_publishes_new_type_atomically(tmp_path: Path) -> None:
    package, sources, archive, target = _original_fixture(tmp_path)
    consumer = tmp_path / "site/reports/example/report.js"
    consumer.parent.mkdir(parents=True)
    consumer.write_text('SELECT example_value FROM example_dataset', encoding="utf-8")
    visual = tmp_path / "site/visuals/example.contract.js"
    visual.parent.mkdir(parents=True)
    visual.write_text('export const consumerSchema = {example_value: "number"}', encoding="utf-8")
    contract = yaml.safe_load((package / "dataset-contract.yaml").read_text(encoding="utf-8"))
    contract["contract_version"] = "1.2.0"
    contract["columns"][1]["type"] = "DOUBLE"
    (package / "dataset-contract.yaml").write_text(yaml.safe_dump(contract, sort_keys=False), encoding="utf-8")
    model = package / "dbt/models/example_dataset.sql"
    model.write_text(model.read_text(encoding="utf-8").replace("decimal(18, 2)", "double"), encoding="utf-8")
    _write_change(package, {
        "contract_version": "1.0.0", "dataset": "example-dataset",
        "classification": "breaking-consumer-change", "previous_contract_version": "1.1.0",
        "strategy": "migration",
        "consumers": [{"path": "site/reports/example/report.js", "kind": "sql-or-exploration-query", "columns": ["example_value"], "resolution": "migrated"}],
        "adapter": None,
    })
    with pytest.raises(DatasetError, match="incomplete consumer inventory"):
        build_dataset(
            load_dataset_declaration(package / "dataset.yaml"), archive_root=archive,
            build_root=tmp_path / "incomplete-migration", publish_root=target, sources_root=sources,
        )
    plan = yaml.safe_load((package / "schema-change.yaml").read_text(encoding="utf-8"))
    plan["consumers"].append({
        "path": "site/visuals/example.contract.js", "kind": "visual-contract-or-fixture",
        "columns": ["example_value"], "resolution": "migrated",
    })
    (package / "schema-change.yaml").write_text(yaml.safe_dump(plan, sort_keys=False), encoding="utf-8")
    manifest = build_dataset(
        load_dataset_declaration(package / "dataset.yaml"), archive_root=archive,
        build_root=tmp_path / "next-build", publish_root=target, sources_root=sources,
    )
    assert manifest.schema_version == "1.2.0"
    assert manifest.adapters == []
    assert manifest.content_sha256 == hashlib.sha256((target / "dataset.parquet").read_bytes()).hexdigest()
    connection = duckdb.connect()
    try:
        assert connection.execute("DESCRIBE SELECT example_value FROM read_parquet(?)", [str(target / "dataset.parquet")]).fetchone()[1] == "DOUBLE"
        assert connection.execute("SELECT example_value FROM read_parquet(?) ORDER BY period", [str(target / "dataset.parquet")]).fetchall() == [(12.5,), (13.25,)]
    finally:
        connection.close()


def test_adapter_coexists_with_new_schema_and_requires_explicit_removal(tmp_path: Path) -> None:
    package, sources, archive, target = _original_fixture(tmp_path)
    consumer = tmp_path / "site/reports/example/report.js"
    consumer.parent.mkdir(parents=True)
    consumer.write_text('SELECT example_value FROM example_dataset_v1', encoding="utf-8")
    contract = yaml.safe_load((package / "dataset-contract.yaml").read_text(encoding="utf-8"))
    contract["contract_version"] = "1.2.0"
    contract["columns"][1]["name"] = "current_value"
    contract["indicators"][0]["column"] = "current_value"
    contract["questions"][0]["columns"] = ["period", "current_value"]
    contract["validations"][1]["columns"] = ["period", "current_value"]
    (package / "dataset-contract.yaml").write_text(yaml.safe_dump(contract, sort_keys=False), encoding="utf-8")
    model = package / "dbt/models/example_dataset.sql"
    model.write_text(model.read_text(encoding="utf-8").replace("as example_value", "as current_value"), encoding="utf-8")
    schema = package / "dbt/models/schema.yml"
    schema.write_text(schema.read_text(encoding="utf-8").replace("example_value", "current_value"), encoding="utf-8")
    adapter = {
        "version": "1.0.0", "owner": "Example report owner",
        "removal_condition": "Remove after the example report migrates to current_value.",
        "logical_table": "example_dataset_v1",
        "column_mapping": {"period": "period", "example_value": "current_value"},
    }
    _write_change(package, {
        "contract_version": "1.0.0", "dataset": "example-dataset",
        "classification": "breaking-consumer-change", "previous_contract_version": "1.1.0",
        "strategy": "adapter",
        "consumers": [{"path": "site/reports/example/report.js", "kind": "sql-or-exploration-query", "columns": ["example_value"], "resolution": "adapted"}],
        "adapter": adapter,
    })
    incomplete = yaml.safe_load((package / "schema-change.yaml").read_text(encoding="utf-8"))
    incomplete["adapter"]["column_mapping"] = {"period": "period"}
    (package / "schema-change.yaml").write_text(yaml.safe_dump(incomplete, sort_keys=False), encoding="utf-8")
    with pytest.raises(DatasetError, match="does not cover changed columns"):
        build_dataset(
            load_dataset_declaration(package / "dataset.yaml"), archive_root=archive,
            build_root=tmp_path / "incomplete-adapter", publish_root=target, sources_root=sources,
        )
    (package / "schema-change.yaml").write_text(yaml.safe_dump({
        **incomplete, "adapter": adapter,
    }, sort_keys=False), encoding="utf-8")
    declaration = load_dataset_declaration(package / "dataset.yaml")
    manifest = build_dataset(
        declaration, archive_root=archive, build_root=tmp_path / "adapter-build",
        publish_root=target, sources_root=sources,
    )
    assert manifest.adapters == [adapter]
    connection = duckdb.connect()
    try:
        parquet_sql = "'" + str(target / "dataset.parquet").replace("'", "''") + "'"
        connection.execute(f"CREATE VIEW example_dataset AS SELECT * FROM read_parquet({parquet_sql})")
        mapping = adapter["column_mapping"]
        projection = ", ".join(f'"{new}" AS "{old}"' for old, new in mapping.items())
        connection.execute(f"CREATE VIEW example_dataset_v1 AS SELECT {projection} FROM example_dataset")
        assert connection.execute("SELECT typeof(current_value), current_value FROM example_dataset ORDER BY period").fetchall() == [("DECIMAL(18,2)", 12.50), ("DECIMAL(18,2)", 13.25)]
        assert connection.execute("SELECT typeof(example_value), example_value FROM example_dataset_v1 ORDER BY period").fetchall() == [("DECIMAL(18,2)", 12.50), ("DECIMAL(18,2)", 13.25)]
    finally:
        connection.close()
    # A normal rebuild retains the adapter; deleting its plan cannot silently remove it.
    rebuilt = build_dataset(
        declaration, archive_root=archive, build_root=tmp_path / "adapter-rebuild",
        publish_root=target, sources_root=sources,
    )
    assert rebuilt.adapters == [adapter]
    dataset_yaml = yaml.safe_load((package / "dataset.yaml").read_text(encoding="utf-8"))
    dataset_yaml.pop("schema_change")
    (package / "dataset.yaml").write_text(yaml.safe_dump(dataset_yaml, sort_keys=False), encoding="utf-8")
    with pytest.raises(DatasetError, match="adapter removal requires"):
        build_dataset(
            load_dataset_declaration(package / "dataset.yaml"), archive_root=archive,
            build_root=tmp_path / "bad-removal", publish_root=target, sources_root=sources,
        )
    # Satisfying the recorded condition requires an explicit versioned migration
    # of the last consumer; that publication removes the compatibility view.
    contract = yaml.safe_load((package / "dataset-contract.yaml").read_text(encoding="utf-8"))
    contract["contract_version"] = "1.3.0"
    (package / "dataset-contract.yaml").write_text(yaml.safe_dump(contract, sort_keys=False), encoding="utf-8")
    consumer.write_text("SELECT period, current_value FROM example_dataset", encoding="utf-8")
    _write_change(package, {
        "contract_version": "1.0.0", "dataset": "example-dataset",
        "classification": "compatible-modification", "previous_contract_version": "1.2.0",
        "strategy": "migration",
        "consumers": [{"path": "site/reports/example/report.js", "kind": "sql-or-exploration-query", "columns": ["period", "current_value"], "resolution": "migrated"}],
        "adapter": None,
    })
    removed = build_dataset(
        load_dataset_declaration(package / "dataset.yaml"), archive_root=archive,
        build_root=tmp_path / "adapter-removal", publish_root=target, sources_root=sources,
    )
    assert removed.schema_version == "1.3.0"
    assert removed.adapters == []


def test_adapter_rejects_incomplete_mapping_and_empty_removal_condition(tmp_path: Path) -> None:
    raw = yaml.safe_load((ROOT / ".agents/skills/pulse-change-dataset-schema/assets/schema-change.yaml").read_text(encoding="utf-8"))
    raw["adapter"]["removal_condition"] = ""
    path = tmp_path / "schema-change.yaml"
    path.write_text(yaml.safe_dump(raw, sort_keys=False), encoding="utf-8")
    with pytest.raises(DatasetError, match="compatibility adapter is invalid"):
        load_schema_change(path, dataset_id="example-dataset")


def test_compatible_source_and_indicator_additions_preserve_existing_consumer(tmp_path: Path) -> None:
    package, sources, archive, target = _original_fixture(tmp_path)
    connection = duckdb.connect()
    try:
        before = connection.execute(
            "SELECT period::VARCHAR, example_value FROM read_parquet(?) ORDER BY period",
            [str(target / "dataset.parquet")],
        ).fetchall()
    finally:
        connection.close()
    # The original-file source adds a provider field. Explicit package decoding
    # keeps the existing analytical contract and consumer query unchanged.
    archive_rows(
        root=archive, source_id="example-public-source", acquisition_id="example-addition",
        acquired_at="2026-09-12T10:00:00Z", source_data_date="2026-09-01",
        source_urls=["https://example.test/data.csv"], rows=None,
        original_bytes=b"period,value,note\n2026-07,12.50,first\n2026-08,13.25,second\n",
        original_filename="observations.csv", decoder_version="csv-v2", licence="Open", attribution="Example",
    )
    same = build_dataset(
        load_dataset_declaration(package / "dataset.yaml"), archive_root=archive,
        build_root=tmp_path / "source-addition-build", publish_root=target, sources_root=sources,
    )
    assert [item["name"] for item in same.columns] == ["period", "example_value"]
    # Add one report-facing indicator through dbt and a classified impact plan.
    consumer = tmp_path / "site/reports/example/report.js"
    consumer.parent.mkdir(parents=True)
    consumer.write_text("SELECT period, example_value FROM example_dataset", encoding="utf-8")
    contract = yaml.safe_load((package / "dataset-contract.yaml").read_text(encoding="utf-8"))
    contract["contract_version"] = "1.2.0"
    contract["columns"].append({"name": "double_value", "type": "DECIMAL(18,2)", "description": "Twice the example value."})
    contract["indicators"].append({
        "column": "double_value", "definition": "Two times the typed example value.",
        "unit": "Example units", "source": "Pulse calculation from Example provider field value",
        "licence": "Example open licence", "attribution": "Source: Example provider.",
    })
    contract["questions"].append({
        "id": "double-value-over-time", "question": "How has twice the example value changed?",
        "derivation": "Multiply example_value by two.", "columns": ["period", "double_value"],
    })
    contract["validations"].append({
        "name": "double-value-required", "description": "Calculated values are never null.",
        "columns": ["double_value"],
    })
    (package / "dataset-contract.yaml").write_text(yaml.safe_dump(contract, sort_keys=False), encoding="utf-8")
    model = package / "dbt/models/example_dataset.sql"
    model.write_text(model.read_text(encoding="utf-8").replace(
        "value::decimal(18, 2) as example_value",
        "value::decimal(18, 2) as example_value,\n  (value::decimal(18, 2) * 2)::decimal(18, 2) as double_value",
    ), encoding="utf-8")
    schema = package / "dbt/models/schema.yml"
    schema.write_text(schema.read_text(encoding="utf-8") + "      - name: double_value\n        data_tests: [not_null]\n", encoding="utf-8")
    _write_change(package, {
        "contract_version": "1.0.0", "dataset": "example-dataset",
        "classification": "compatible-addition", "previous_contract_version": "1.1.0",
        "strategy": "migration",
        "consumers": [{"path": "site/reports/example/report.js", "kind": "sql-or-exploration-query", "columns": ["period", "example_value"], "resolution": "unaffected"}],
        "adapter": None,
    })
    added = build_dataset(
        load_dataset_declaration(package / "dataset.yaml"), archive_root=archive,
        build_root=tmp_path / "indicator-build", publish_root=target, sources_root=sources,
    )
    assert classify_schema_change(same.columns, added.columns)["classification"] == "compatible-addition"
    connection = duckdb.connect()
    try:
        after = connection.execute(
            "SELECT period::VARCHAR, example_value FROM read_parquet(?) ORDER BY period",
            [str(target / "dataset.parquet")],
        ).fetchall()
        doubled = connection.execute(
            "SELECT double_value FROM read_parquet(?) ORDER BY period",
            [str(target / "dataset.parquet")],
        ).fetchall()
    finally:
        connection.close()
    assert after == before
    assert doubled == [(25.00,), (26.50,)]


@pytest.mark.parametrize("bad_payload", [
    b"period\n2026-09\n",
    b"period,value\n2026-09,not-a-number\n",
])
def test_missing_or_incompatible_original_field_retains_last_publication(
    bad_payload: bytes, tmp_path: Path
) -> None:
    package, sources, archive, target = _original_fixture(tmp_path)
    before_parquet = (target / "dataset.parquet").read_bytes()
    before_manifest = json.loads((target / "dataset.json").read_text(encoding="utf-8"))
    archive_rows(
        root=archive, source_id="example-public-source", acquisition_id="example-bad",
        acquired_at="2026-09-12T10:00:00Z", source_data_date="2026-09-01",
        source_urls=["https://example.test/data.csv"], rows=None, original_bytes=bad_payload,
        original_filename="observations.csv", decoder_version="csv-v1", licence="Open", attribution="Example",
    )
    with pytest.raises(DatasetError):
        build_dataset(
            load_dataset_declaration(package / "dataset.yaml"), archive_root=archive,
            build_root=tmp_path / "bad-build", publish_root=target, sources_root=sources,
        )
    assert (target / "dataset.parquet").read_bytes() == before_parquet
    assert json.loads((target / "dataset.json").read_text(encoding="utf-8")) == before_manifest
