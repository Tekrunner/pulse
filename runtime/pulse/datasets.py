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

from pulse.archive import ArchiveError, reject_lfs_pointer, utc_now
from pulse.contracts.dataset import (
    DATASET_SCHEMA_ID,
    DatasetManifest,
    diagnostic,
    validate_dataset_manifest,
)
from pulse.contracts.snapshot import ContractError, SnapshotManifest, validate_snapshot_manifest
from pulse.contracts.status import DATASET_STAGES, attempt


ROOT = Path(__file__).resolve().parents[2]


_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
_TABLE = re.compile(r"^[a-z][a-z0-9_]*$")


class DatasetError(RuntimeError):
    """A dataset package or candidate violates its declared boundary.

    Every failure carries the canonical dataset stage it belongs to, so a
    published diagnostic names the stage that actually failed instead of
    attributing every failure to the transform.
    """

    def __init__(self, message: str, *, stage: str = "transform") -> None:
        super().__init__(message)
        if stage not in DATASET_STAGES:
            raise ContractError(f"dataset failures must name a canonical stage, not '{stage}'")
        self.stage = stage


@dataclass(frozen=True)
class DatasetContract:
    contract_version: str
    model: dict[str, str]
    columns: list[dict[str, Any]]
    indicators: list[dict[str, Any]]
    questions: list[dict[str, Any]] | None = None
    temporal: dict[str, str] | None = None
    validations: list[dict[str, Any]] | None = None


@dataclass(frozen=True)
class DatasetDeclaration:
    dataset_id: str
    name: str
    source_id: str
    visibility: str
    logical_table: str
    path: Path
    contract: DatasetContract
    schema_change: dict[str, Any] | None = None


@dataclass(frozen=True)
class SnapshotInput:
    path: Path
    parquet: Path
    manifest: SnapshotManifest

    @property
    def artifact(self) -> Path:
        """The immutable provider artifact, whether Parquet or an original file.

        ``parquet`` remains as a compatibility alias for existing v1 builders.
        New packages must use this source-neutral name and inspect ``format``.
        """
        return self.parquet

    @property
    def format(self) -> str:
        return self.manifest.format


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
    legacy_fields = {
        "contract_version",
        "model",
        "columns",
        "indicators",
    }
    enhanced_fields = legacy_fields | {"questions", "temporal", "validations"}
    if not isinstance(raw, dict) or set(raw) not in {frozenset(legacy_fields), frozenset(enhanced_fields)}:
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
    questions = raw.get("questions")
    temporal = raw.get("temporal")
    validations = raw.get("validations")
    if questions is not None:
        if (
            not isinstance(questions, list)
            or not questions
            or not all(
                isinstance(item, dict)
                and set(item) == {"id", "question", "derivation", "columns"}
                and all(isinstance(item[key], str) and item[key].strip() for key in ("id", "question", "derivation"))
                and isinstance(item["columns"], list)
                and bool(item["columns"])
                and len(item["columns"]) == len(set(item["columns"]))
                and set(item["columns"]) <= names
                for item in questions
            )
            or len({item["id"] for item in questions}) != len(questions)
        ):
            raise DatasetError(f"{path}: machine-readable questions are invalid")
        if not isinstance(temporal, dict) or set(temporal) != {"grain", "period_column", "meaning"}:
            raise DatasetError(f"{path}: temporal meaning is incomplete")
        if not all(isinstance(value, str) and value.strip() for value in temporal.values()) or temporal["period_column"] not in names:
            raise DatasetError(f"{path}: temporal meaning is invalid")
        if (
            not isinstance(validations, list)
            or not validations
            or not all(
                isinstance(item, dict)
                and set(item) == {"name", "description", "columns"}
                and isinstance(item["name"], str)
                and bool(item["name"].strip())
                and isinstance(item["description"], str)
                and bool(item["description"].strip())
                and isinstance(item["columns"], list)
                and bool(item["columns"])
                and set(item["columns"]) <= names
                for item in validations
            )
        ):
            raise DatasetError(f"{path}: validation rules are invalid")
    return DatasetContract(raw["contract_version"], model, columns, indicators, questions, temporal, validations)


def load_dataset_declaration(path: Path) -> DatasetDeclaration:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise DatasetError(f"{path}: invalid YAML declaration") from error
    required_fields = {
        "id",
        "name",
        "source",
        "visibility",
        "logical_table",
        "contract",
    }
    if not isinstance(raw, dict) or set(raw) not in {frozenset(required_fields), frozenset(required_fields | {"schema_change"})}:
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
    schema_change = None
    if "schema_change" in raw:
        change_name = _required_string(raw, "schema_change", path)
        if Path(change_name).name != change_name:
            raise DatasetError(f"{path}: schema_change must be a package-local filename")
        schema_change = load_schema_change(path.parent / change_name, dataset_id=dataset_id)
    return DatasetDeclaration(
        dataset_id,
        _required_string(raw, "name", path),
        source_id,
        raw["visibility"],
        logical_table,
        path,
        contract,
        schema_change,
    )


def classify_schema_change(
    previous_columns: list[dict[str, Any]], proposed_columns: list[dict[str, Any]]
) -> dict[str, Any]:
    """Classify a contract edit without guessing whether consumers are safe."""
    previous = {item["name"]: item for item in previous_columns}
    proposed = {item["name"]: item for item in proposed_columns}
    added = sorted(proposed.keys() - previous.keys())
    removed = sorted(previous.keys() - proposed.keys())
    retyped = sorted(
        name for name in previous.keys() & proposed.keys()
        if previous[name].get("type") != proposed[name].get("type")
    )
    modified = sorted(
        name for name in previous.keys() & proposed.keys()
        if previous[name] != proposed[name] and name not in retyped
    )
    if removed or retyped:
        classification = "breaking-consumer-change"
    elif modified:
        classification = "compatible-modification"
    else:
        classification = "compatible-addition"
    return {
        "classification": classification,
        "added": added,
        "removed": removed,
        "retyped": retyped,
        "modified": modified,
    }


def inventory_dataset_consumers(
    dataset_id: str,
    *,
    logical_table: str,
    columns: list[str],
    root: Path = ROOT,
) -> list[dict[str, Any]]:
    """Conservatively find declared and code-owned dataset consumers.

    Results are evidence for human classification. Ambiguous textual matches
    are intentionally retained: overlooking a SQL or JavaScript consumer is
    more dangerous than reviewing a false positive.
    """
    ignored = {".git", ".venv", "node_modules", "build", "dist", "__pycache__"}
    suffixes = {".yml", ".yaml", ".js", ".mjs", ".py", ".json", ".md", ".sql"}
    found: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix not in suffixes or ignored & set(path.parts):
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            continue
        dataset_match = dataset_id in content or logical_table in content
        referenced = sorted(name for name in columns if re.search(rf"(?<![A-Za-z0-9_]){re.escape(name)}(?![A-Za-z0-9_])", content))
        if not dataset_match and not referenced:
            continue
        relative = path.relative_to(root).as_posix()
        if path.name == "annotations.json" and "reports" in path.parts:
            kind = "report-annotation-dependency"
        elif path.name == "report.yml":
            kind = "report-declaration"
        elif "visuals" in path.parts and ("contract" in path.name or "fixture" in path.name):
            kind = "visual-contract-or-fixture"
        elif path.suffix == ".sql" or re.search(r"\b(?:SELECT|FROM|JOIN)\b", content, re.IGNORECASE):
            kind = "sql-or-exploration-query"
        elif "test" in path.name or "tests" in path.parts:
            kind = "test"
        elif "catalog" in path.name or "publish" in path.parts:
            kind = "catalog-or-generated-consumer"
        else:
            kind = "code-owned-consumer"
        found.append({
            "path": relative,
            "kind": kind,
            "columns": referenced,
            "ambiguous": not dataset_match,
        })
    return found


def load_schema_change(path: Path, *, dataset_id: str) -> dict[str, Any]:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise DatasetError(f"{path}: invalid schema-change declaration") from error
    fields = {"contract_version", "dataset", "classification", "previous_contract_version", "strategy", "consumers", "adapter"}
    if not isinstance(raw, dict) or set(raw) != fields:
        raise DatasetError(f"{path}: schema-change fields are not exact")
    if raw["contract_version"] != "1.0.0" or raw["dataset"] != dataset_id:
        raise DatasetError(f"{path}: schema-change identity or contract version is invalid")
    if raw["classification"] not in {"compatible-addition", "compatible-modification", "breaking-consumer-change"}:
        raise DatasetError(f"{path}: schema-change classification is invalid")
    if not isinstance(raw["previous_contract_version"], str) or not raw["previous_contract_version"].startswith("1."):
        raise DatasetError(f"{path}: previous contract version is invalid")
    if raw["strategy"] not in {"migration", "adapter"} or not isinstance(raw["consumers"], list):
        raise DatasetError(f"{path}: schema-change strategy or consumer inventory is invalid")
    consumer_fields = {"path", "kind", "columns", "resolution"}
    for consumer in raw["consumers"]:
        if (
            not isinstance(consumer, dict) or set(consumer) != consumer_fields
            or not isinstance(consumer["path"], str) or not consumer["path"]
            or Path(consumer["path"]).is_absolute() or ".." in Path(consumer["path"]).parts
            or not isinstance(consumer["kind"], str) or not consumer["kind"]
            or not isinstance(consumer["columns"], list)
            or consumer["resolution"] not in {"unaffected", "migrated", "adapted"}
        ):
            raise DatasetError(f"{path}: schema-change consumer inventory is invalid")
    adapter = raw["adapter"]
    if raw["strategy"] == "migration":
        if adapter is not None:
            raise DatasetError(f"{path}: migration must not declare an adapter")
    else:
        adapter_fields = {"version", "owner", "removal_condition", "logical_table", "column_mapping"}
        if (
            not isinstance(adapter, dict) or set(adapter) != adapter_fields
            or not isinstance(adapter["version"], str) or not adapter["version"].startswith("1.")
            or not all(isinstance(adapter[key], str) and adapter[key].strip() for key in ("owner", "removal_condition", "logical_table"))
            or not _TABLE.fullmatch(adapter["logical_table"])
            or not isinstance(adapter["column_mapping"], dict) or not adapter["column_mapping"]
            or not all(_TABLE.fullmatch(old) and _TABLE.fullmatch(new) for old, new in adapter["column_mapping"].items())
        ):
            raise DatasetError(f"{path}: compatibility adapter is invalid")
        if any(item["resolution"] == "migrated" for item in raw["consumers"]):
            raise DatasetError(f"{path}: adapter plan has inconsistent consumer resolutions")
    return raw


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
            artifact = manifest_path.parent / manifest.artifacts[0]["path"]
            reject_lfs_pointer(artifact)
            if not artifact.is_file() or _sha256(artifact) != manifest.artifacts[0]["sha256"]:
                raise DatasetError("snapshot raw artifact hash does not match its manifest")
            if manifest.format != snapshot_contract["format"]:
                raise DatasetError("snapshot artifact format disagrees with its committed source contract")
            if manifest.format == "parquet":
                _validate_snapshot_schema(artifact, snapshot_contract)
            found.append(SnapshotInput(manifest_path.parent, artifact, manifest))
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


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _write_diagnostic(target: Path, code: str, message: str, *, stage: str, retryable: bool) -> None:
    """Record one sanitized diagnostic beside the pipeline it belongs to.

    Per-pipeline on purpose: a diagnostic shared across a publication root
    cannot say which dataset failed, and status has to attribute a failure to
    exactly one expected pipeline.
    """
    _write_json(target / "diagnostic.json", diagnostic(stage, code, message, retryable=retryable))


def _publish_pair(target: Path, candidate: Path, manifest: DatasetManifest) -> None:
    """Replace a dataset directory as one recoverable publication unit.

    Both files are complete and fsynced in a sibling directory before the old
    directory is moved. If either rename is interrupted, the previous usable
    directory is restored. Readers therefore never observe a mixed old/new
    manifest and Parquet pair.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    staged = Path(tempfile.mkdtemp(prefix=f".{target.name}-publish-", dir=target.parent))
    backup = target.parent / f".{target.name}-previous"
    had_target = target.exists()
    try:
        shutil.copyfile(candidate, staged / "dataset.parquet")
        _write_json(staged / "dataset.json", manifest.to_dict())
        attempt_path = target / "attempt.json"
        if attempt_path.is_file():
            shutil.copyfile(attempt_path, staged / "attempt.json")
        for path in (staged / "dataset.parquet", staged / "dataset.json"):
            with path.open("rb") as handle:
                import os
                os.fsync(handle.fileno())
        if backup.exists():
            shutil.rmtree(backup)
        if had_target:
            target.replace(backup)
        try:
            staged.replace(target)
        except OSError:
            if had_target and backup.exists() and not target.exists():
                backup.replace(target)
            raise
        if backup.exists():
            shutil.rmtree(backup)
    finally:
        if staged.exists():
            shutil.rmtree(staged)


def _validated_evolution(declaration: DatasetDeclaration, target: Path) -> list[dict[str, Any]]:
    previous_path = target / "dataset.json"
    if not previous_path.is_file():
        return []
    try:
        previous = validate_dataset_manifest(json.loads(previous_path.read_text(encoding="utf-8")))
    except (ContractError, OSError, json.JSONDecodeError) as error:
        raise DatasetError("existing dataset publication has an invalid contract", stage="publish-data") from error
    change = classify_schema_change(previous.columns, declaration.contract.columns)
    changed = any(change[key] for key in ("added", "removed", "retyped", "modified"))
    if not changed:
        if previous.adapters:
            plan = declaration.schema_change
            if plan is not None and plan["strategy"] == "adapter" and [plan["adapter"]] == previous.adapters:
                return previous.adapters
            if (
                plan is None
                or plan["strategy"] != "migration"
                or plan["classification"] != "compatible-modification"
                or plan["previous_contract_version"] != previous.schema_version
                or declaration.contract.contract_version == previous.schema_version
                or not plan["consumers"]
                or any(item["resolution"] != "migrated" for item in plan["consumers"])
            ):
                raise DatasetError(
                    "compatibility adapter removal requires an explicit completed migration plan",
                    stage="publish-data",
                )
        return []
    plan = declaration.schema_change
    if plan is None:
        raise DatasetError("dataset schema changed without a classified consumer-impact plan", stage="publish-data")
    if plan["previous_contract_version"] != previous.schema_version or plan["classification"] != change["classification"]:
        raise DatasetError("schema-change plan disagrees with the published contract", stage="publish-data")
    if declaration.contract.contract_version == previous.schema_version:
        raise DatasetError("a schema change must advance the dataset contract version", stage="publish-data")
    if change["classification"] == "breaking-consumer-change":
        if not plan["consumers"]:
            raise DatasetError("breaking schema change has no complete consumer inventory", stage="publish-data")
        package_root = declaration.path.parent.parent
        repository_root = package_root.parent if package_root.name == "datasets" else ROOT
        evidence = inventory_dataset_consumers(
            declaration.dataset_id,
            logical_table=previous.logical_table,
            columns=sorted(set(change["removed"]) | set(change["retyped"])),
            root=repository_root,
        )
        own_package = declaration.path.parent.relative_to(repository_root).as_posix() + "/"
        required_paths = {
            item["path"] for item in evidence
            if not item["path"].startswith(own_package)
            and not item["path"].startswith(("publish/", "build/", "snapshots/"))
        }
        declared_paths = {item["path"] for item in plan["consumers"]}
        if not required_paths <= declared_paths:
            raise DatasetError("breaking schema change has an incomplete consumer inventory", stage="publish-data")
        if plan["strategy"] == "migration" and any(item["resolution"] != "migrated" for item in plan["consumers"]):
            raise DatasetError("breaking migration leaves an affected consumer unresolved", stage="publish-data")
        if plan["strategy"] == "adapter":
            if any(item["resolution"] != "adapted" for item in plan["consumers"]):
                raise DatasetError("breaking adapter leaves an affected consumer unresolved", stage="publish-data")
            mapping = plan["adapter"]["column_mapping"]
            required_old = set(change["removed"]) | set(change["retyped"])
            if not required_old <= set(mapping) or not set(mapping.values()) <= {item["name"] for item in declaration.contract.columns}:
                raise DatasetError("compatibility adapter does not cover changed columns", stage="publish-data")
    return [plan["adapter"]] if plan["strategy"] == "adapter" else []


def build_dataset(
    declaration: DatasetDeclaration,
    *,
    archive_root: Path = ROOT / "snapshots/public",
    build_root: Path = ROOT / "build/datasets/public",
    publish_root: Path | None = None,
    sources_root: Path = ROOT / "sources",
    attempted_at: str | None = None,
) -> DatasetManifest:
    """Build and atomically publish one declared dataset from snapshots only."""
    target = publish_root or ROOT / "publish/public/data" / declaration.dataset_id
    build_parent = build_root / declaration.dataset_id
    build_parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=".build-", dir=build_parent))
    candidate = work / "dataset.parquet"
    # Record the attempt before anything can fail. A dataset build has no other
    # trace of when it ran, and status must report a last attempt even when the
    # attempt produced nothing publishable.
    _write_json(target / "attempt.json", attempt(attempted_at or utc_now()))
    try:
        from pulse.sources import discover_sources

        source = discover_sources(sources_root).get(declaration.source_id)
        if source is None:
            raise DatasetError(
                f"dataset '{declaration.dataset_id}' references an unknown snapshot source"
            )
        if source.visibility == "private" and declaration.visibility == "public":
            raise DatasetError("a dataset cannot weaken private snapshot visibility")
        adapters = _validated_evolution(declaration, target)
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
            declaration.contract.contract_version,
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
            declaration.contract.questions or [],
            declaration.contract.temporal or {},
            declaration.contract.validations or [],
            adapters,
        )
        try:
            validate_dataset_manifest(manifest.to_dict(), declaration.contract)
        except ContractError as error:
            raise DatasetError(
                f"dataset '{declaration.dataset_id}' manifest disagrees with its committed contract",
                stage="publish-data",
            ) from error
        try:
            _publish_pair(target, candidate, manifest)
        except OSError as error:
            raise DatasetError(
                f"dataset '{declaration.dataset_id}' could not be published atomically",
                stage="publish-data",
            ) from error
        return manifest
    except DatasetError as error:
        # A rejected candidate is deterministic for the same inputs: retrying it
        # unchanged cannot succeed, so it is not advertised as retryable.
        _write_diagnostic(
            target, "candidate_rejected", str(error), stage=error.stage, retryable=False
        )
        raise
    except Exception as error:
        sanitized = DatasetError(
            f"dataset '{declaration.dataset_id}' build failed; retained any prior usable publication"
        )
        _write_diagnostic(
            target, "build_failed", str(sanitized), stage=sanitized.stage, retryable=True
        )
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
