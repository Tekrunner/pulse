"""Compile the public browser-data catalog from published dataset contracts."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
from typing import Any

import yaml

from pulse.contracts.dataset import ContractError, DatasetManifest, validate_dataset_manifest
from pulse.datasets import DatasetError, discover_datasets


BROWSER_DATA_SCHEMA_ID = "pulse.browser-data"
BROWSER_DATA_SCHEMA_VERSION = "1.0.0"
REPORT_CATALOG_SCHEMA_ID = "pulse.reports"
REPORT_CATALOG_SCHEMA_VERSION = "1.0.0"
_REPORT_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
_REPORT_ROUTE = re.compile(r"^[a-z0-9][a-z0-9/-]*$")


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _entry(manifest: DatasetManifest, *, parquet: str) -> dict[str, Any]:
    return {
        "datasetId": manifest.dataset_id,
        "logicalTable": manifest.logical_table,
        "datasetContractVersion": manifest.schema_version,
        "schema": [{"name": column["name"], "type": column["type"]} for column in manifest.columns],
        "contentSha256": manifest.content_sha256,
        "representedPeriod": manifest.represented_period,
        "semanticMetadata": {"model": manifest.model, "indicators": manifest.indicators},
        "visibility": manifest.visibility,
        "parquet": parquet,
    }


def compile_browser_catalog(
    publish_root: Path,
    *,
    parquet_prefix: str = "datasets",
) -> dict[str, Any]:
    """Return a deterministic v1 catalog for complete, public publications only."""
    datasets: dict[str, dict[str, Any]] = {}
    tables: set[str] = set()
    try:
        declarations = discover_datasets()
    except DatasetError as error:
        raise ContractError(f"invalid committed dataset declarations: {error}") from error
    for manifest_path in sorted(publish_root.glob("data/**/dataset.json")):
        try:
            raw = json.loads(manifest_path.read_text(encoding="utf-8"))
            declaration = declarations.get(raw.get("dataset_id"))
            if declaration is None:
                raise ContractError("published dataset has no committed dataset declaration")
            manifest = validate_dataset_manifest(raw, declaration.contract)
            if (
                manifest.source_id != declaration.source_id
                or manifest.logical_table != declaration.logical_table
                or manifest.visibility != declaration.visibility
            ):
                raise ContractError("published dataset identity disagrees with its declaration")
        except (OSError, json.JSONDecodeError, ContractError) as error:
            raise ContractError(f"invalid published dataset contract at {manifest_path}: {error}") from error
        if manifest.visibility != "public":
            continue
        parquet_path = manifest_path.parent / manifest.parquet_path
        if not parquet_path.is_file():
            raise ContractError(f"published dataset '{manifest.dataset_id}' is missing its Parquet file")
        if _sha256(parquet_path) != manifest.content_sha256:
            raise ContractError(f"published dataset '{manifest.dataset_id}' has a Parquet hash mismatch")
        if manifest.dataset_id in datasets:
            raise ContractError(f"browser catalog has duplicate dataset identity '{manifest.dataset_id}'")
        if manifest.logical_table in tables:
            raise ContractError(f"browser catalog has duplicate logical table '{manifest.logical_table}'")
        relative = manifest_path.parent.relative_to(publish_root / "data") / manifest.parquet_path
        datasets[manifest.dataset_id] = _entry(
            manifest, parquet=(Path(parquet_prefix) / relative).as_posix()
        )
        tables.add(manifest.logical_table)
    if not datasets:
        raise ContractError("browser catalog has no complete public datasets")
    catalog = {
        "schemaId": BROWSER_DATA_SCHEMA_ID,
        "schemaVersion": BROWSER_DATA_SCHEMA_VERSION,
        "extensions": {"parquet": "parquet.duckdb_extension.wasm"},
        "datasets": datasets,
    }
    validate_browser_catalog(catalog)
    return catalog


def validate_browser_catalog(value: dict[str, Any]) -> dict[str, Any]:
    if set(value) != {"schemaId", "schemaVersion", "extensions", "datasets"}:
        raise ContractError("browser catalog fields are not exact")
    if value["schemaId"] != BROWSER_DATA_SCHEMA_ID or not str(value["schemaVersion"]).startswith("1."):
        raise ContractError("browser catalog has unsupported contract major")
    if not isinstance(value["extensions"], dict) or set(value["extensions"]) != {"parquet"}:
        raise ContractError("browser catalog extensions are invalid")
    if not isinstance(value["datasets"], dict) or not value["datasets"]:
        raise ContractError("browser catalog datasets are invalid")
    tables: set[str] = set()
    fields = {"datasetId", "logicalTable", "datasetContractVersion", "schema", "contentSha256", "representedPeriod", "semanticMetadata", "visibility", "parquet"}
    for dataset_id, entry in value["datasets"].items():
        if set(entry) != fields or entry["datasetId"] != dataset_id:
            raise ContractError("browser catalog dataset entry is invalid")
        if not str(entry["datasetContractVersion"]).startswith("1."):
            raise ContractError(f"browser catalog dataset '{dataset_id}' has unsupported contract major")
        if not isinstance(entry["logicalTable"], str) or entry["logicalTable"] in tables:
            raise ContractError("browser catalog logical tables must be unique")
        if entry["visibility"] != "public" or not isinstance(entry["parquet"], str) or entry["parquet"].startswith(("/", "http:")) or ".." in Path(entry["parquet"]).parts:
            raise ContractError("browser catalog public Parquet URL is invalid")
        if not isinstance(entry["schema"], list) or not all(isinstance(column, dict) and set(column) == {"name", "type"} for column in entry["schema"]):
            raise ContractError("browser catalog schema is invalid")
        if not isinstance(entry["contentSha256"], str) or len(entry["contentSha256"]) != 64:
            raise ContractError("browser catalog content hash is invalid")
        if not isinstance(entry["representedPeriod"], dict) or set(entry["representedPeriod"]) != {"start", "end"}:
            raise ContractError("browser catalog represented period is invalid")
        if not isinstance(entry["semanticMetadata"], dict):
            raise ContractError("browser catalog semantic metadata is invalid")
        tables.add(entry["logicalTable"])
    return value


def write_browser_catalog(output: Path, *, publish_root: Path, parquet_prefix: str = "datasets") -> Path:
    catalog = compile_browser_catalog(publish_root, parquet_prefix=parquet_prefix)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(catalog, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return output


def compile_report_catalog(
    reports_root: Path,
    *,
    browser_catalog: dict[str, Any],
) -> dict[str, Any]:
    """Compile strict report declarations with resolved visibility and stable change ids."""
    reports: dict[str, dict[str, Any]] = {}
    routes: set[str] = set()
    required = {"id", "title", "route", "visibility", "datasets", "visuals", "lineage", "exploration"}
    for path in sorted(reports_root.glob("**/report.yml")):
        try:
            raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError) as error:
            raise ContractError(f"invalid report declaration at {path}") from error
        if not isinstance(raw, dict) or set(raw) != required:
            raise ContractError(f"report declaration fields are not exact at {path}")
        report_id, route = raw["id"], raw["route"]
        if not isinstance(report_id, str) or not _REPORT_ID.fullmatch(report_id):
            raise ContractError("report IDs must be lowercase kebab-case")
        if not isinstance(route, str) or not _REPORT_ROUTE.fullmatch(route) or ".." in Path(route).parts:
            raise ContractError("report routes must be safe nested routes")
        if report_id in reports or route in routes:
            raise ContractError("report catalog has duplicate report identity or route")
        dataset_ids = raw["datasets"]
        if not isinstance(dataset_ids, list) or not dataset_ids or len(set(dataset_ids)) != len(dataset_ids):
            raise ContractError(f"report '{report_id}' datasets are invalid")
        missing = [item for item in dataset_ids if item not in browser_catalog["datasets"]]
        if missing:
            raise ContractError(f"report '{report_id}' references unavailable datasets")
        if raw["visibility"] not in {"public", "private"}:
            raise ContractError(f"report '{report_id}' visibility is invalid")
        resolved_visibility = "public" if raw["visibility"] == "public" and all(
            browser_catalog["datasets"][item]["visibility"] == "public" for item in dataset_ids
        ) else "private"
        if not isinstance(raw["visuals"], list) or not raw["visuals"]:
            raise ContractError(f"report '{report_id}' visual slots are invalid")
        visual_ids: set[str] = set()
        for visual in raw["visuals"]:
            if not isinstance(visual, dict) or set(visual) != {"id", "contract", "dataset", "columns"}:
                raise ContractError(f"report '{report_id}' visual slot is invalid")
            if visual["id"] in visual_ids or visual["dataset"] not in dataset_ids:
                raise ContractError(f"report '{report_id}' visual identity or dataset is invalid")
            available = {column["name"] for column in browser_catalog["datasets"][visual["dataset"]]["schema"]}
            if not isinstance(visual["columns"], list) or not set(visual["columns"]) <= available:
                raise ContractError(f"report '{report_id}' visual lineage is invalid")
            visual_ids.add(visual["id"])
        if not isinstance(raw["lineage"], dict) or set(raw["lineage"]) != set(dataset_ids):
            raise ContractError(f"report '{report_id}' column lineage is incomplete")
        substantive = {
            "declaration": raw,
            "datasetContent": {
                item: browser_catalog["datasets"][item]["contentSha256"] for item in sorted(dataset_ids)
            },
        }
        change = hashlib.sha256(
            json.dumps(substantive, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        reports[report_id] = {
            **raw,
            "resolvedVisibility": resolved_visibility,
            "substantiveChange": change,
        }
        routes.add(route)
    if not reports:
        raise ContractError("report catalog has no declarations")
    return {
        "schemaId": REPORT_CATALOG_SCHEMA_ID,
        "schemaVersion": REPORT_CATALOG_SCHEMA_VERSION,
        "reports": reports,
    }


def write_report_catalog(
    output: Path, *, reports_root: Path, browser_catalog: dict[str, Any]
) -> Path:
    catalog = compile_report_catalog(reports_root, browser_catalog=browser_catalog)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(catalog, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return output
