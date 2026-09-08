"""Discovery and execution of independent snapshot-to-dataset packages."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile
from types import ModuleType
from typing import Any

import duckdb
import yaml

from pulse.archive import ArchiveError, reject_lfs_pointer
from pulse.contracts.dataset import (
    DATASET_SCHEMA_ID,
    DATASET_SCHEMA_VERSION,
    DatasetManifest,
    diagnostic,
    validate_dataset_manifest,
)
from pulse.contracts.snapshot import SnapshotManifest, validate_snapshot_manifest


ROOT = Path(__file__).resolve().parents[2]


_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
_TABLE = re.compile(r"^[a-z][a-z0-9_]*$")


class DatasetError(RuntimeError):
    """A dataset package or candidate violates its declared boundary."""


@dataclass(frozen=True)
class DatasetContract:
    contract_version: str
    model: dict[str, str]
    columns: list[dict[str, Any]]
    indicators: list[dict[str, Any]]


@dataclass(frozen=True)
class DatasetDeclaration:
    dataset_id: str
    name: str
    source_id: str
    visibility: str
    logical_table: str
    path: Path
    contract: DatasetContract


@dataclass(frozen=True)
class SnapshotInput:
    path: Path
    parquet: Path
    manifest: SnapshotManifest


@dataclass(frozen=True)
class DatasetBuildContext:
    declaration: DatasetDeclaration
    snapshots: tuple[SnapshotInput, ...]
    work_root: Path
    output_path: Path


@dataclass(frozen=True)
class DatasetBuildResult:
    snapshot: SnapshotInput
    represented_period: dict[str, str]
    status: dict[str, Any]
    lineage: dict[str, Any]


def _required_string(value: dict[str, Any], key: str, path: Path) -> str:
    item = value.get(key)
    if not isinstance(item, str) or not item.strip():
        raise DatasetError(f"{path}: missing required '{key}'")
    return item


def load_dataset_contract(path: Path) -> DatasetContract:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise DatasetError(f"{path}: invalid dataset contract") from error
    if not isinstance(raw, dict) or set(raw) != {
        "contract_version",
        "model",
        "columns",
        "indicators",
    }:
        raise DatasetError(f"{path}: dataset contract fields are not exact")
    if not isinstance(raw["contract_version"], str) or not raw["contract_version"].startswith("1."):
        raise DatasetError(f"{path}: unsupported dataset contract major")
    model = raw["model"]
    if not isinstance(model, dict) or set(model) != {"name", "description"} or not all(
        isinstance(item, str) and item.strip() for item in model.values()
    ):
        raise DatasetError(f"{path}: dataset model metadata is invalid")
    columns = raw["columns"]
    if not isinstance(columns, list) or not columns:
        raise DatasetError(f"{path}: dataset columns are required")
    names: set[str] = set()
    for column in columns:
        if not isinstance(column, dict) or not {"name", "type", "description"} <= set(column):
            raise DatasetError(f"{path}: every column requires name, type, and description")
        if not all(isinstance(column[key], str) and column[key].strip() for key in ("name", "type", "description")):
            raise DatasetError(f"{path}: dataset column metadata is invalid")
        if column["name"] in names:
            raise DatasetError(f"{path}: duplicate dataset column '{column['name']}'")
        names.add(column["name"])
    indicators = raw["indicators"]
    if not isinstance(indicators, list):
        raise DatasetError(f"{path}: indicators must be a list")
    indicator_columns: set[str] = set()
    required_indicator = {"column", "definition", "unit", "source", "licence", "attribution"}
    for indicator in indicators:
        if not isinstance(indicator, dict) or not required_indicator <= set(indicator):
            raise DatasetError(f"{path}: indicator semantic metadata is incomplete")
        if not all(isinstance(indicator[key], str) and indicator[key].strip() for key in required_indicator):
            raise DatasetError(f"{path}: indicator semantic metadata is invalid")
        if indicator["column"] not in names or indicator["column"] in indicator_columns:
            raise DatasetError(f"{path}: indicator column is missing or duplicated")
        indicator_columns.add(indicator["column"])
    return DatasetContract(raw["contract_version"], model, columns, indicators)


def load_dataset_declaration(path: Path) -> DatasetDeclaration:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise DatasetError(f"{path}: invalid YAML declaration") from error
    if not isinstance(raw, dict) or set(raw) != {
        "id",
        "name",
        "source",
        "visibility",
        "logical_table",
        "contract",
    }:
        raise DatasetError(f"{path}: dataset declaration fields are not exact")
    dataset_id = _required_string(raw, "id", path)
    source_id = _required_string(raw, "source", path)
    logical_table = _required_string(raw, "logical_table", path)
    if not _ID.fullmatch(dataset_id) or not _ID.fullmatch(source_id):
        raise DatasetError(f"{path}: dataset and source IDs must be lowercase kebab-case")
    if not _TABLE.fullmatch(logical_table):
        raise DatasetError(f"{path}: logical_table must be lowercase snake_case")
    if raw["visibility"] not in {"public", "private"}:
        raise DatasetError(f"{path}: visibility must be public or private")
    contract_name = _required_string(raw, "contract", path)
    if Path(contract_name).name != contract_name:
        raise DatasetError(f"{path}: contract must be a package-local filename")
    contract = load_dataset_contract(path.parent / contract_name)
    if contract.model["name"] != logical_table:
        raise DatasetError(f"{path}: model name and logical_table must agree")
    return DatasetDeclaration(
        dataset_id,
        _required_string(raw, "name", path),
        source_id,
        raw["visibility"],
        logical_table,
        path,
        contract,
    )


def discover_datasets(root: Path = ROOT / "datasets") -> dict[str, DatasetDeclaration]:
    found: dict[str, DatasetDeclaration] = {}
    tables: set[str] = set()
    for path in sorted(root.glob("*/dataset.yaml")):
        declaration = load_dataset_declaration(path)
        if declaration.dataset_id in found:
            raise DatasetError(f"duplicate dataset ID '{declaration.dataset_id}'")
        if declaration.logical_table in tables:
            raise DatasetError(f"duplicate logical table '{declaration.logical_table}'")
        if path.parent.name != declaration.dataset_id:
            raise DatasetError(f"{path}: package directory must match dataset ID")
        found[declaration.dataset_id] = declaration
        tables.add(declaration.logical_table)
    return found


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _validate_snapshot_schema(parquet: Path, contract: dict[str, Any]) -> None:
    observed = _observed_schema(parquet)
    kinds = {"string": "VARCHAR", "integer": "BIGINT", "number": "DOUBLE", "boolean": "BOOLEAN"}
    expected = {name: kinds[kind] for name, kind in contract["required_fields"].items()}
    if any(observed.get(name) != kind for name, kind in expected.items()):
        raise DatasetError("snapshot artifact disagrees with its committed source contract")
    if not contract["compatible_additions"] and observed != expected:
        raise DatasetError("snapshot artifact has additions forbidden by its source contract")


def _snapshots(
    archive_root: Path, source_id: str, snapshot_contract: dict[str, Any]
) -> tuple[SnapshotInput, ...]:
    found: list[SnapshotInput] = []
    for manifest_path in (archive_root / source_id).glob("*/snapshot.json"):
        try:
            manifest = validate_snapshot_manifest(json.loads(manifest_path.read_text(encoding="utf-8")))
            parquet = manifest_path.parent / manifest.artifacts[0]["path"]
            reject_lfs_pointer(parquet)
            if not parquet.is_file() or _sha256(parquet) != manifest.artifacts[0]["sha256"]:
                raise DatasetError("snapshot raw artifact hash does not match its manifest")
            _validate_snapshot_schema(parquet, snapshot_contract)
            found.append(SnapshotInput(manifest_path.parent, parquet, manifest))
        except (ArchiveError, OSError, ValueError) as error:
            raise DatasetError("snapshot contract is invalid; candidate rejected") from error
    if not found:
        raise DatasetError(f"no valid snapshot is available for source '{source_id}'")
    return tuple(
        sorted(
            found,
            key=lambda item: (
                item.manifest.source_data_date or "",
                item.manifest.acquired_at,
                item.path.name,
            ),
            reverse=True,
        )
    )


def _load_builder(declaration: DatasetDeclaration) -> ModuleType:
    path = declaration.path.parent / "build.py"
    if not path.is_file():
        raise DatasetError(f"{declaration.path}: missing package-local build.py")
    module_name = f"pulse_dataset_{declaration.dataset_id.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise DatasetError(f"{path}: could not load dataset builder")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    repository_path = str(ROOT)
    inserted_repository = repository_path not in sys.path
    if inserted_repository:
        sys.path.insert(0, repository_path)
    try:
        spec.loader.exec_module(module)
    except Exception as error:
        sys.modules.pop(module_name, None)
        raise DatasetError(f"{path}: dataset builder could not load") from error
    finally:
        if inserted_repository:
            sys.path.remove(repository_path)
    if not callable(getattr(module, "build", None)):
        raise DatasetError(f"{path}: builder must define callable build")
    return module


def _observed_schema(path: Path) -> dict[str, str]:
    connection = duckdb.connect()
    try:
        return {
            name: kind
            for name, kind, *_ in connection.execute(
                "DESCRIBE SELECT * FROM read_parquet(?)", [str(path)]
            ).fetchall()
        }
    finally:
        connection.close()


def _write_diagnostic(publish_root: Path, code: str, message: str) -> None:
    publish_root.parent.mkdir(parents=True, exist_ok=True)
    value = diagnostic("transform", code, message, retryable=True)
    (publish_root.parent / "diagnostic.json").write_text(
        json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def build_dataset(
    declaration: DatasetDeclaration,
    *,
    archive_root: Path = ROOT / "snapshots/public",
    build_root: Path = ROOT / "build/datasets/public",
    publish_root: Path | None = None,
    sources_root: Path = ROOT / "sources",
) -> DatasetManifest:
    """Build and atomically publish one declared dataset from snapshots only."""
    target = publish_root or ROOT / "publish/public/data" / declaration.dataset_id
    build_parent = build_root / declaration.dataset_id
    build_parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=".build-", dir=build_parent))
    candidate = work / "dataset.parquet"
    try:
        from pulse.sources import discover_sources

        source = discover_sources(sources_root).get(declaration.source_id)
        if source is None:
            raise DatasetError(
                f"dataset '{declaration.dataset_id}' references an unknown snapshot source"
            )
        if source.visibility == "private" and declaration.visibility == "public":
            raise DatasetError("a dataset cannot weaken private snapshot visibility")
        snapshots = _snapshots(
            archive_root, declaration.source_id, source.snapshot_contract
        )
        builder = _load_builder(declaration)
        result = builder.build(
            DatasetBuildContext(declaration, snapshots, work, candidate)
        )
        if not isinstance(result, DatasetBuildResult):
            raise DatasetError("dataset builder must return DatasetBuildResult")
        if result.snapshot not in snapshots:
            raise DatasetError("dataset builder selected an undeclared snapshot")
        if not candidate.is_file():
            raise DatasetError("dataset builder did not create its declared Parquet output")
        expected_schema = {item["name"]: item["type"] for item in declaration.contract.columns}
        if _observed_schema(candidate) != expected_schema:
            raise DatasetError("dataset output schema disagrees with its committed contract")
        lineage = {
            "snapshot_id": result.snapshot.manifest.snapshot_id,
            "snapshot_sha256": result.snapshot.manifest.artifacts[0]["sha256"],
            **result.lineage,
        }
        manifest = DatasetManifest(
            DATASET_SCHEMA_ID,
            DATASET_SCHEMA_VERSION,
            declaration.dataset_id,
            declaration.source_id,
            declaration.logical_table,
            declaration.visibility,
            "dataset.parquet",
            _sha256(candidate),
            result.represented_period,
            lineage,
            declaration.contract.model,
            declaration.contract.columns,
            declaration.contract.indicators,
            result.status,
        )
        validate_dataset_manifest(manifest.to_dict(), declaration.contract)
        target.mkdir(parents=True, exist_ok=True)
        candidate.replace(target / "dataset.parquet")
        (target / "dataset.json").write_text(
            json.dumps(manifest.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        return manifest
    except DatasetError as error:
        _write_diagnostic(target, "candidate_rejected", str(error))
        raise
    except Exception as error:
        sanitized = DatasetError(
            f"dataset '{declaration.dataset_id}' build failed; retained any prior usable publication"
        )
        _write_diagnostic(target, "build_failed", str(sanitized))
        raise sanitized from error
    finally:
        shutil.rmtree(work, ignore_errors=True)


def build_all_datasets(
    *,
    archive_root: Path = ROOT / "snapshots/public",
    build_root: Path = ROOT / "build/datasets/public",
    publish_root: Path = ROOT / "publish/public/data",
    sources_root: Path = ROOT / "sources",
) -> list[DatasetManifest]:
    return [
        build_dataset(
            declaration,
            archive_root=archive_root,
            build_root=build_root,
            publish_root=publish_root / declaration.dataset_id,
            sources_root=sources_root,
        )
        for declaration in discover_datasets().values()
    ]
