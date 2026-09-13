"""Report workflow contract, annotation, and privacy conformance."""

from __future__ import annotations

import json
from pathlib import Path
import shutil
from types import SimpleNamespace

import pytest

from pulse import catalog
from pulse.reports import (
    ReportError,
    discover_reports,
    load_annotations,
    load_report_declaration,
    resolve_report_visibility,
)


ROOT = Path(__file__).parents[2]


def test_design_free_template_declares_questions_queries_schemas_and_states(tmp_path: Path) -> None:
    package = tmp_path / "synthetic-report"
    shutil.copytree(ROOT / "site/workflows/add-report/template", package)

    report = load_report_declaration(
        package / "report.yml", logical_tables={"synthetic-dataset": "synthetic_table"}
    )

    assert report.report_id == "synthetic-report"
    assert report.raw["visuals"][0]["question"] == "primary-question"
    assert report.raw["visuals"][0]["query"] == "primary-query"
    assert report.raw["state_topology"]["failure_scope"] == "slot-local"
    assert "synthetic-dataset" in report.dependency_columns


def test_v1_report_without_annotations_is_valid(tmp_path: Path) -> None:
    package = tmp_path / "synthetic-report"
    shutil.copytree(ROOT / "site/workflows/add-report/template", package)
    declaration = (package / "report.yml").read_text(encoding="utf-8")
    start = declaration.index("annotations:\n")
    end = declaration.index("state_topology:\n")
    (package / "report.yml").write_text(
        declaration[:start] + declaration[end:], encoding="utf-8"
    )

    report = load_report_declaration(
        package / "report.yml", logical_tables={"synthetic-dataset": "synthetic_table"}
    )
    assert "annotations" not in report.raw


def test_annotation_contract_rejects_coordinates_and_invalid_anchor(tmp_path: Path) -> None:
    declaration = {
        "version": "1.0.0", "identity": "id", "anchor": "period",
        "path": "annotations.json", "query": "primary-query", "dependencies": [],
    }
    artifact = json.loads((ROOT / "site/workflows/add-report/template/annotations.json").read_text())
    artifact["annotations"][0]["x"] = 100
    path = tmp_path / "annotations.json"
    path.write_text(json.dumps(artifact), encoding="utf-8")

    with pytest.raises(ReportError, match="identity, anchor, provenance, or dependency"):
        load_annotations(path, declaration=declaration)


def test_discovery_validates_private_declarations_before_public_filtering(tmp_path: Path) -> None:
    package = tmp_path / "private-report"
    shutil.copytree(ROOT / "site/workflows/add-report/template", package)
    declaration = (package / "report.yml").read_text(encoding="utf-8")
    (package / "report.yml").write_text(declaration.replace("id: synthetic-report", "id: INVALID"), encoding="utf-8")

    with pytest.raises(ReportError, match="lowercase kebab-case"):
        discover_reports(tmp_path)


def test_query_cannot_own_storage_access(tmp_path: Path) -> None:
    package = tmp_path / "synthetic-report"
    shutil.copytree(ROOT / "site/workflows/add-report/template", package)
    declaration = (package / "report.yml").read_text(encoding="utf-8")
    declaration = declaration.replace(
        "FROM synthetic_table WHERE",
        "FROM read_parquet('private.parquet') WHERE",
    )
    (package / "report.yml").write_text(declaration, encoding="utf-8")

    with pytest.raises(ReportError, match="data-client boundary"):
        load_report_declaration(
            package / "report.yml", logical_tables={"synthetic-dataset": "synthetic_table"}
        )


@pytest.mark.parametrize(
    ("old", "new", "message"),
    [
        ("id: primary-visual", "id: INVALID", "visual question, query, schema, or identity"),
        ("contract: 1.0.0", "contract: 2.0.0", "visual question, query, schema, or identity"),
        ("identity: id", "identity: event_id", "annotation identity or anchor"),
        ("anchor: period", "anchor: missing_column", "annotation identity or anchor"),
    ],
)
def test_rejects_invalid_visual_and_annotation_identity(
    tmp_path: Path, old: str, new: str, message: str
) -> None:
    package = tmp_path / "synthetic-report"
    shutil.copytree(ROOT / "site/workflows/add-report/template", package)
    declaration = (package / "report.yml").read_text(encoding="utf-8").replace(old, new, 1)
    (package / "report.yml").write_text(declaration, encoding="utf-8")

    with pytest.raises(ReportError, match=message):
        load_report_declaration(
            package / "report.yml", logical_tables={"synthetic-dataset": "synthetic_table"}
        )


def test_query_may_select_only_the_declared_dataset_table(tmp_path: Path) -> None:
    package = tmp_path / "synthetic-report"
    shutil.copytree(ROOT / "site/workflows/add-report/template", package)
    declaration = (package / "report.yml").read_text(encoding="utf-8")
    declaration = declaration.replace("FROM synthetic_table", "FROM other_table")
    (package / "report.yml").write_text(declaration, encoding="utf-8")

    with pytest.raises(ReportError, match="must select only declared dataset table"):
        load_report_declaration(
            package / "report.yml", logical_tables={"synthetic-dataset": "synthetic_table"}
        )


def test_visibility_resolves_private_and_unknown_lineage_fails_closed(tmp_path: Path) -> None:
    package = tmp_path / "synthetic-report"
    shutil.copytree(ROOT / "site/workflows/add-report/template", package)
    declaration = (package / "report.yml").read_text(encoding="utf-8")
    (package / "report.yml").write_text(
        declaration.replace("visibility: private", "visibility: public"), encoding="utf-8"
    )
    report = load_report_declaration(
        package / "report.yml", logical_tables={"synthetic-dataset": "synthetic_table"}
    )

    resolved, rows = resolve_report_visibility(
        report, dataset_visibility={"synthetic-dataset": "public"}
    )
    assert resolved == "private"
    assert rows[0]["visibility"] == "private"
    with pytest.raises(ReportError, match="unknown dataset lineage"):
        resolve_report_visibility(report, dataset_visibility={})

    artifact = json.loads((package / "annotations.json").read_text(encoding="utf-8"))
    artifact["annotations"][0]["visibility"] = "public"
    (package / "annotations.json").write_text(json.dumps(artifact), encoding="utf-8")
    (package / "report.yml").write_text(declaration, encoding="utf-8")
    explicitly_private = load_report_declaration(
        package / "report.yml", logical_tables={"synthetic-dataset": "synthetic_table"}
    )
    resolved, _ = resolve_report_visibility(
        explicitly_private, dataset_visibility={"synthetic-dataset": "public"}
    )
    assert resolved == "private"

    (package / "report.yml").write_text(
        declaration.replace("visibility: private", "visibility: public"), encoding="utf-8"
    )
    requested_public = load_report_declaration(
        package / "report.yml", logical_tables={"synthetic-dataset": "synthetic_table"}
    )
    resolved, _ = resolve_report_visibility(
        requested_public, dataset_visibility={"synthetic-dataset": "private"}
    )
    assert resolved == "private"


def test_annotation_private_report_is_absent_from_public_closure_and_catalog(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    reports = tmp_path / "reports"
    private_package = reports / "annotation-private"
    shutil.copytree(ROOT / "site/workflows/add-report/template", private_package)
    private_yaml = (private_package / "report.yml").read_text(encoding="utf-8")
    private_yaml = private_yaml.replace("visibility: private", "visibility: public")
    (private_package / "report.yml").write_text(private_yaml, encoding="utf-8")
    public_package = reports / "public-report"
    public_package.mkdir()
    (public_package / "report.yml").write_text(
        """id: public-report
title: Public report
route: reports/public-report
visibility: public
datasets: [public-dataset]
visuals:
  - {id: public-visual, contract: 1.0.0, dataset: public-dataset, columns: [value]}
lineage: {public-dataset: [value]}
exploration: {enabled: false, default_period: all, controls: [represented-period]}
""",
        encoding="utf-8",
    )
    declarations = {
        "synthetic-dataset": SimpleNamespace(
            logical_table="synthetic_table", visibility="public",
            contract=SimpleNamespace(columns=[{"name": "period"}, {"name": "value"}]),
        ),
        "public-dataset": SimpleNamespace(
            logical_table="public_table", visibility="public",
            contract=SimpleNamespace(columns=[{"name": "value"}]),
        ),
    }
    monkeypatch.setattr(catalog, "discover_datasets", lambda: declarations)
    browser = {
        "datasets": {
            "public-dataset": {
                "visibility": "public",
                "schema": [{"name": "value", "type": "number"}],
                "contentSha256": "0" * 64,
            }
        }
    }

    assert catalog.public_dataset_closure(reports) == ("public-dataset",)
    compiled = catalog.compile_report_catalog(reports, browser_catalog=browser)
    assert set(compiled["reports"]) == {"public-report"}

    public_path = public_package / "report.yml"
    public_path.write_text(
        public_path.read_text(encoding="utf-8").replace("[value]", "[missing]"),
        encoding="utf-8",
    )
    with pytest.raises(catalog.ContractError, match="unknown column lineage"):
        catalog.public_dataset_closure(reports)


def test_copied_neutral_template_compiles_synthetic_public_catalog_and_route(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    reports = tmp_path / "reports"
    package = reports / "synthetic-report"
    shutil.copytree(ROOT / "site/workflows/add-report/template", package)
    report_yaml = (package / "report.yml").read_text(encoding="utf-8")
    (package / "report.yml").write_text(
        report_yaml.replace("visibility: private", "visibility: public"), encoding="utf-8"
    )
    annotations = json.loads((package / "annotations.json").read_text(encoding="utf-8"))
    annotations["annotations"][0]["visibility"] = "public"
    (package / "annotations.json").write_text(json.dumps(annotations), encoding="utf-8")
    declaration = SimpleNamespace(
        logical_table="synthetic_table", visibility="public",
        contract=SimpleNamespace(columns=[{"name": "period"}, {"name": "value"}]),
    )
    monkeypatch.setattr(catalog, "discover_datasets", lambda: {"synthetic-dataset": declaration})
    browser = catalog.validate_browser_catalog({
        "schemaId": "pulse.browser-data", "schemaVersion": "1.0.0",
        "extensions": {"parquet": "parquet.duckdb_extension.wasm"},
        "datasets": {"synthetic-dataset": {
            "datasetId": "synthetic-dataset", "logicalTable": "synthetic_table",
            "datasetContractVersion": "1.0.0",
            "schema": [{"name": "period", "type": "date"}, {"name": "value", "type": "number"}],
            "contentSha256": "a" * 64,
            "representedPeriod": {"start": "2025-01-01", "end": "2025-01-01"},
            "semanticMetadata": {"questions": [], "indicators": []},
            "visibility": "public", "parquet": "datasets/synthetic-dataset/dataset.parquet",
        }},
    })

    assert catalog.public_dataset_closure(reports) == ("synthetic-dataset",)
    compiled = catalog.compile_report_catalog(reports, browser_catalog=browser)
    assert compiled["reports"]["synthetic-report"]["route"] == "reports/synthetic-report"
    assert compiled["reports"]["synthetic-report"]["annotations"]["path"] == "annotations.json"
    assert "insee" not in "".join(
        path.read_text(encoding="utf-8").lower()
        for path in package.iterdir() if path.is_file()
    )
