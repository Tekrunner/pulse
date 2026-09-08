"""Offline coverage for compiled public browser catalog contracts."""

from __future__ import annotations

import json
import shutil
from copy import deepcopy
from pathlib import Path

import pytest

from pulse.catalog import compile_browser_catalog, compile_report_catalog, validate_browser_catalog
from pulse.contracts.snapshot import ContractError


ROOT = Path(__file__).parents[2]


def _publication(tmp_path: Path) -> Path:
    root = tmp_path / "publish"
    shutil.copytree(ROOT / "publish/public", root)
    return root


def test_compiles_complete_public_insee_contract_with_manifest_relative_url(tmp_path: Path) -> None:
    catalog = compile_browser_catalog(_publication(tmp_path))

    assert set(catalog["datasets"]) == {
        "insee-cpi-monthly",
        "insee-cpi-category-analysis",
    }
    entry = catalog["datasets"]["insee-cpi-monthly"]
    assert entry["logicalTable"] == "insee_cpi_monthly"
    assert entry["parquet"] == "datasets/insee-cpi-monthly/dataset.parquet"
    assert entry["representedPeriod"] == {"start": "1996-01-01", "end": "2026-07-01"}
    assert entry["visibility"] == "public"
    categories = catalog["datasets"]["insee-cpi-category-analysis"]
    assert categories["logicalTable"] == "insee_cpi_category_analysis"
    assert categories["parquet"] == "datasets/insee-cpi-category-analysis/dataset.parquet"
    assert categories["representedPeriod"] == {
        "start": "1998-01-01",
        "end": "2026-07-01",
    }
    assert {
        column["name"] for column in categories["schema"]
    } >= {
        "food_index",
        "energy_index",
        "actual_rent_index",
        "actual_rent_pulse_contribution_pct_points",
    }
    assert validate_browser_catalog(catalog) == catalog


def test_rejects_missing_or_hash_mismatched_public_parquet(tmp_path: Path) -> None:
    root = _publication(tmp_path)
    parquet = root / "data/insee-cpi-monthly/dataset.parquet"
    parquet.unlink()
    with pytest.raises(ContractError, match="missing its Parquet"):
        compile_browser_catalog(root)

    root = _publication(tmp_path / "mismatched")
    (root / "data/insee-cpi-monthly/dataset.parquet").write_bytes(b"not parquet")
    with pytest.raises(ContractError, match="hash mismatch"):
        compile_browser_catalog(root)


def test_rejects_unsupported_catalog_or_dataset_contract_major(tmp_path: Path) -> None:
    catalog = compile_browser_catalog(_publication(tmp_path))
    catalog["schemaVersion"] = "2.0.0"
    with pytest.raises(ContractError, match="unsupported contract major"):
        validate_browser_catalog(catalog)

    root = _publication(tmp_path / "dataset-major")
    manifest_path = root / "data/insee-cpi-monthly/dataset.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["schema_version"] = "2.0.0"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ContractError, match="invalid published dataset contract"):
        compile_browser_catalog(root)


def test_rejects_duplicate_dataset_identity_and_logical_table(tmp_path: Path) -> None:
    root = _publication(tmp_path)
    duplicate = root / "data/duplicate/monthly"
    duplicate.mkdir(parents=True)
    shutil.copy(root / "data/insee-cpi-monthly/dataset.parquet", duplicate / "dataset.parquet")
    shutil.copy(root / "data/insee-cpi-monthly/dataset.json", duplicate / "dataset.json")
    with pytest.raises(ContractError, match="duplicate dataset identity"):
        compile_browser_catalog(root)

    catalog = compile_browser_catalog(_publication(tmp_path / "table"))
    duplicate_entry = deepcopy(catalog["datasets"]["insee-cpi-monthly"])
    duplicate_entry["datasetId"] = "other-dataset"
    catalog["datasets"]["other-dataset"] = duplicate_entry
    with pytest.raises(ContractError, match="logical tables must be unique"):
        validate_browser_catalog(catalog)


def test_report_catalog_resolves_lineage_routes_and_stable_change(tmp_path: Path) -> None:
    browser = compile_browser_catalog(_publication(tmp_path))
    first = compile_report_catalog(ROOT / "site/reports", browser_catalog=browser)
    second = compile_report_catalog(ROOT / "site/reports", browser_catalog=browser)
    report = first["reports"]["french-consumer-prices"]
    assert report["route"] == "reports/french-consumer-prices"
    assert report["resolvedVisibility"] == "public"
    assert len(report["visuals"]) == 4
    assert report["substantiveChange"] == second["reports"]["french-consumer-prices"]["substantiveChange"]


def test_report_catalog_rejects_route_collision(tmp_path: Path) -> None:
    reports = tmp_path / "reports"
    shutil.copytree(ROOT / "site/reports/french-consumer-prices", reports / "one")
    shutil.copytree(ROOT / "site/reports/french-consumer-prices", reports / "two")
    with pytest.raises(ContractError, match="duplicate report"):
        compile_report_catalog(reports, browser_catalog=compile_browser_catalog(_publication(tmp_path)))
