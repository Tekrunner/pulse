"""Compile the public browser-data catalog from published dataset contracts."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from pulse.contracts.dataset import ContractError, DatasetManifest, validate_dataset_manifest


BROWSER_DATA_SCHEMA_ID = "pulse.browser-data"
BROWSER_DATA_SCHEMA_VERSION = "1.0.0"


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
    for manifest_path in sorted(publish_root.glob("data/**/dataset.json")):
        try:
            raw = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest = validate_dataset_manifest(raw)
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
