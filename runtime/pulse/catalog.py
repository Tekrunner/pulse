"""Compile the public browser-data catalog from published dataset contracts."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from typing import Any

import yaml

from pulse.contracts.dataset import (
    ContractError,
    DatasetManifest,
    diagnostic,
    validate_dataset_manifest,
    validate_diagnostic,
)
from pulse.contracts.snapshot import validate_snapshot_manifest
from pulse.contracts.status import (
    DATASET_STAGES,
    EXPECTED_PIPELINES_SCHEMA_ID,
    EXPECTED_PIPELINES_SCHEMA_VERSION,
    SOURCE_STAGES,
    SYSTEM_STAGES,
    STATUS_SCHEMA_ID,
    STATUS_SCHEMA_VERSION,
    browser_schedule,
    display_state,
    expected_pipeline_id,
    precedence_state,
    publication_deadline,
    validate_attempt,
    validate_expected_pipelines,
    validate_status_catalog,
)
from pulse.archive import ArchiveError, reject_lfs_pointer
from pulse.datasets import DatasetError, discover_datasets
from pulse.sources import SourceDeclarationError, discover_sources


ROOT = Path(__file__).resolve().parents[2]
BROWSER_DATA_SCHEMA_ID = "pulse.browser-data"
BROWSER_DATA_SCHEMA_VERSION = "1.0.0"
REPORT_CATALOG_SCHEMA_ID = "pulse.reports"
REPORT_CATALOG_SCHEMA_VERSION = "1.0.0"
_REPORT_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
_REPORT_ROUTE = re.compile(r"^[a-z0-9][a-z0-9/-]*$")


def public_dataset_closure(reports_root: Path = ROOT / "site/reports") -> tuple[str, ...]:
    """Return the datasets explicitly reachable from public report declarations."""
    dataset_ids: set[str] = set()
    reports = 0
    for path in sorted(reports_root.glob("**/report.yml")):
        try:
            raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError) as error:
            raise ContractError(f"invalid report declaration at {path}") from error
        if not isinstance(raw, dict) or raw.get("visibility") not in {"public", "private"}:
            raise ContractError(f"report declaration visibility is invalid at {path}")
        if raw["visibility"] != "public":
            continue
        reports += 1
        declared = raw.get("datasets")
        if not isinstance(declared, list) or not declared or not all(
            isinstance(item, str) and _REPORT_ID.fullmatch(item) for item in declared
        ) or len(declared) != len(set(declared)):
            raise ContractError(f"public report datasets are invalid at {path}")
        dataset_ids.update(declared)
    if not reports or not dataset_ids:
        raise ContractError("public closure has no report-facing datasets")
    return tuple(sorted(dataset_ids))


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
    reports_root: Path = ROOT / "site/reports",
) -> dict[str, Any]:
    """Return a deterministic v1 catalog for complete, public publications only."""
    datasets: dict[str, dict[str, Any]] = {}
    tables: set[str] = set()
    try:
        declarations = discover_datasets()
    except DatasetError as error:
        raise ContractError(f"invalid committed dataset declarations: {error}") from error
    closure = public_dataset_closure(reports_root)
    expected_manifests = {
        (publish_root / "data" / dataset_id / "dataset.json").resolve()
        for dataset_id in closure
    }
    for residual in sorted((publish_root / "data").glob("**/dataset.json")):
        if residual.resolve() in expected_manifests:
            continue
        try:
            residual_id = json.loads(residual.read_text(encoding="utf-8")).get("dataset_id")
        except (OSError, json.JSONDecodeError):
            raise ContractError(f"public publication root contains an unreadable residual at {residual}")
        if residual_id in closure:
            raise ContractError(f"browser catalog has duplicate dataset identity '{residual_id}'")
        raise ContractError(f"public publication root contains dataset '{residual_id}' outside the public closure")
    for dataset_id in closure:
        declaration = declarations.get(dataset_id)
        if declaration is None:
            raise ContractError(f"public closure references undeclared dataset '{dataset_id}'")
        if declaration.visibility != "public":
            raise ContractError(f"public closure references non-public dataset '{dataset_id}'")
        manifest_path = publish_root / "data" / dataset_id / "dataset.json"
        if not manifest_path.is_file():
            raise ContractError(f"public dataset '{dataset_id}' has no complete publication")
        try:
            raw = json.loads(manifest_path.read_text(encoding="utf-8"))
            if raw.get("dataset_id") != dataset_id:
                raise ContractError("published dataset identity disagrees with its public closure")
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
        try:
            reject_lfs_pointer(parquet_path)
        except ArchiveError as error:
            raise ContractError(
                f"published dataset '{manifest.dataset_id}' is an unresolved Git LFS pointer; materialize LFS objects first"
            ) from error
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


def write_browser_catalog(
    output: Path,
    *,
    publish_root: Path,
    parquet_prefix: str = "datasets",
    reports_root: Path = ROOT / "site/reports",
) -> Path:
    catalog = compile_browser_catalog(
        publish_root, parquet_prefix=parquet_prefix, reports_root=reports_root
    )
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
        if not isinstance(raw["title"], str) or not raw["title"].strip():
            raise ContractError(f"report '{report_id}' title is invalid")
        if not isinstance(route, str) or not _REPORT_ROUTE.fullmatch(route) or ".." in Path(route).parts:
            raise ContractError("report routes must be safe nested routes")
        if raw["visibility"] not in {"public", "private"}:
            raise ContractError(f"report '{report_id}' visibility is invalid")
        if raw["visibility"] != "public":
            continue
        if report_id in reports or route in routes:
            raise ContractError("report catalog has duplicate report identity or route")
        dataset_ids = raw["datasets"]
        if not isinstance(dataset_ids, list) or not dataset_ids or len(set(dataset_ids)) != len(dataset_ids):
            raise ContractError(f"report '{report_id}' datasets are invalid")
        missing = [item for item in dataset_ids if item not in browser_catalog["datasets"]]
        if missing:
            raise ContractError(f"report '{report_id}' references unavailable datasets")
        if not all(browser_catalog["datasets"][item]["visibility"] == "public" for item in dataset_ids):
            raise ContractError(f"report '{report_id}' cannot weaken dataset visibility")
        resolved_visibility = "public"
        if not isinstance(raw["visuals"], list) or not raw["visuals"]:
            raise ContractError(f"report '{report_id}' visual slots are invalid")
        visual_ids: set[str] = set()
        for visual in raw["visuals"]:
            if not isinstance(visual, dict) or set(visual) != {"id", "contract", "dataset", "columns"}:
                raise ContractError(f"report '{report_id}' visual slot is invalid")
            if (
                not isinstance(visual["id"], str)
                or not _REPORT_ID.fullmatch(visual["id"])
                or visual["id"] in visual_ids
                or visual["dataset"] not in dataset_ids
                or not isinstance(visual["contract"], str)
                or not visual["contract"].startswith("1.")
            ):
                raise ContractError(f"report '{report_id}' visual identity or dataset is invalid")
            available = {column["name"] for column in browser_catalog["datasets"][visual["dataset"]]["schema"]}
            if (
                not isinstance(visual["columns"], list)
                or not visual["columns"]
                or len(visual["columns"]) != len(set(visual["columns"]))
                or not set(visual["columns"]) <= available
            ):
                raise ContractError(f"report '{report_id}' visual lineage is invalid")
            visual_ids.add(visual["id"])
        if not isinstance(raw["lineage"], dict) or set(raw["lineage"]) != set(dataset_ids):
            raise ContractError(f"report '{report_id}' column lineage is incomplete")
        for dataset_id, columns in raw["lineage"].items():
            available = {
                column["name"] for column in browser_catalog["datasets"][dataset_id]["schema"]
            }
            if (
                not isinstance(columns, list)
                or not columns
                or len(columns) != len(set(columns))
                or not set(columns) <= available
            ):
                raise ContractError(f"report '{report_id}' column lineage is invalid")
        exploration = raw["exploration"]
        if (
            not isinstance(exploration, dict)
            or set(exploration) != {"enabled", "default_period", "controls"}
            or not isinstance(exploration["enabled"], bool)
            or not isinstance(exploration["default_period"], str)
            or not exploration["default_period"]
            or not isinstance(exploration["controls"], list)
            or not all(isinstance(item, str) and item for item in exploration["controls"])
            or len(exploration["controls"]) != len(set(exploration["controls"]))
        ):
            raise ContractError(f"report '{report_id}' exploration declaration is invalid")
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


def _discovered(sources_root: Path | None, datasets_root: Path | None) -> tuple[dict[str, Any], dict[str, Any]]:
    try:
        sources = discover_sources(sources_root) if sources_root is not None else discover_sources()
        datasets = discover_datasets(datasets_root) if datasets_root is not None else discover_datasets()
    except (SourceDeclarationError, DatasetError) as error:
        raise ContractError(f"invalid committed pipeline declarations: {error}") from error
    return sources, datasets


def compile_expected_pipelines(
    *,
    sources_root: Path | None = None,
    datasets_root: Path | None = None,
    dataset_ids: tuple[str, ...] | None = None,
) -> dict[str, Any]:
    """Compile the catalog of pipelines that must exist, from declarations alone.

    Nothing about a *run* enters here. The catalog is the yardstick a status
    artifact is measured against, so an undeclared runtime job and a declared
    pipeline that never reported are both detectable.
    """
    sources, datasets = _discovered(sources_root, datasets_root)
    selected = set(datasets) if dataset_ids is None else set(dataset_ids)
    missing = selected - set(datasets)
    if missing:
        raise ContractError(
            "expected-pipeline selection references undeclared datasets: "
            + ", ".join(sorted(missing))
        )
    source_ids = {datasets[dataset_id].source_id for dataset_id in selected}
    pipelines: dict[str, Any] = {}
    for declaration in sources.values():
        if declaration.source_id not in source_ids:
            continue
        pipeline_id = expected_pipeline_id("source", declaration.source_id)
        pipelines[pipeline_id] = {"pipelineId": pipeline_id, "kind": "source", "name": declaration.name}
    for declaration in datasets.values():
        if declaration.dataset_id not in selected:
            continue
        pipeline_id = expected_pipeline_id("dataset", declaration.dataset_id)
        pipelines[pipeline_id] = {"pipelineId": pipeline_id, "kind": "dataset", "name": declaration.name}
    pipeline_id = expected_pipeline_id("system", "site")
    pipelines[pipeline_id] = {"pipelineId": pipeline_id, "kind": "system", "name": "Public site"}
    catalog = {
        "schemaId": EXPECTED_PIPELINES_SCHEMA_ID,
        "schemaVersion": EXPECTED_PIPELINES_SCHEMA_VERSION,
        "pipelines": dict(sorted(pipelines.items())),
    }
    return validate_expected_pipelines(catalog)


def _stage(
    name: str, state: str, attempted_at: str | None = None, failure: dict[str, Any] | None = None
) -> dict[str, Any]:
    return {"stage": name, "state": state, "attemptedAt": attempted_at, "diagnostic": failure}


def _period(day: str | None) -> dict[str, str] | None:
    return None if day is None else {"start": day, "end": day}


def _valid_until(period: dict[str, str] | None, schedule: dict[str, Any] | None) -> str | None:
    if period is None or schedule is None:
        return None
    return (
        publication_deadline(period["end"], schedule)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _source_status(declared: dict[str, Any], declaration: Any, archive_root: Path) -> dict[str, Any]:
    manifests = []
    rejected = False
    source_root = archive_root / declaration.source_id
    for path in sorted((archive_root / declaration.source_id).glob("*/snapshot.json")):
        try:
            manifests.append(validate_snapshot_manifest(_read_json(path)))
        except (OSError, json.JSONDecodeError, ValueError):
            # Upstream and filesystem text never reaches the public artifact; that
            # a snapshot was rejected is all a reader can safely be told.
            rejected = True
    latest = max(
        manifests,
        key=lambda item: (item.source_data_date or "", item.acquired_at, item.snapshot_id),
        default=None,
    )
    period = _period(latest.source_data_date) if latest is not None else None
    failure = (
        diagnostic(
            "snapshot",
            "snapshot_rejected",
            "an archived snapshot does not satisfy its committed contract; "
            "the last valid snapshot is retained",
            retryable=True,
        )
        if rejected
        else None
    )
    attempted_at = None
    try:
        if (source_root / "attempt.json").is_file():
            attempted_at = validate_attempt(_read_json(source_root / "attempt.json"))["attempted_at"]
        if (source_root / "diagnostic.json").is_file():
            recorded = validate_diagnostic(_read_json(source_root / "diagnostic.json"))
            if recorded["stage"] not in SOURCE_STAGES:
                raise ContractError(
                    f"published source '{declaration.source_id}' blames a stage outside its pipeline"
                )
            failure = recorded
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise ContractError(
            f"published source '{declaration.source_id}' has an unreadable status artifact: {error}"
        ) from error
    attempted_at = attempted_at or (latest.acquired_at if latest is not None else None)
    if latest is None and failure is None and not rejected:
        stages = [_stage(name, "not-run") for name in SOURCE_STAGES]
        attempted_at = None
    elif failure is not None:
        index = SOURCE_STAGES.index(failure["stage"])
        stages = [
            _stage(name, "succeeded", attempted_at)
            if position < index
            else _stage(name, "failed", attempted_at, failure)
            if position == index
            else _stage(name, "not-run")
            for position, name in enumerate(SOURCE_STAGES)
        ]
    else:
        stages = [
            _stage("acquire", "succeeded", attempted_at),
            _stage("snapshot", "succeeded", attempted_at),
        ]
    schedule = browser_schedule(declaration.publication_schedule)
    return {
        "pipelineId": declared["pipelineId"],
        "kind": "source",
        "name": declared["name"],
        "stages": stages,
        "state": precedence_state([item["state"] for item in stages]),
        "lastAttemptAt": attempted_at,
        "representedPeriod": period,
        "schedule": schedule,
        "latestUsableOutput": None
        if latest is None
        else {
            "artifactKind": "snapshot",
            "identity": latest.snapshot_id,
            "representedPeriod": period,
        },
        "assertions": [],
        "diagnostic": failure,
    }


def _manifest_assertions(status: Any, dataset_id: str) -> list[dict[str, Any]]:
    if not isinstance(status, dict) or not isinstance(status.get("assertions"), list):
        raise ContractError(f"published dataset '{dataset_id}' has an invalid status object")
    assertions = []
    for item in status["assertions"]:
        if not isinstance(item, dict) or not isinstance(item.get("check"), str) or not item["check"].strip():
            raise ContractError(f"published dataset '{dataset_id}' has an unnamed assertion")
        columns = item.get("affected_columns", [])
        if not isinstance(columns, list) or not all(
            isinstance(name, str) and name.strip() for name in columns
        ):
            raise ContractError(f"published dataset '{dataset_id}' has invalid assertion column lineage")
        # An assertion without columns keeps empty lineage so a reader says the
        # impact is unknown instead of silently narrowing it.
        assertions.append({"check": item["check"], "affectedColumns": list(columns)})
    return assertions


def _dataset_status(
    declared: dict[str, Any], declaration: Any, publish_root: Path, schedule: dict[str, Any]
) -> dict[str, Any]:
    directory = publish_root / "data" / declaration.dataset_id
    manifest = None
    failure = None
    attempted_at = None
    try:
        if (directory / "dataset.json").is_file():
            manifest = validate_dataset_manifest(
                _read_json(directory / "dataset.json"), declaration.contract
            )
        if (directory / "diagnostic.json").is_file():
            failure = validate_diagnostic(_read_json(directory / "diagnostic.json"))
        if (directory / "attempt.json").is_file():
            attempted_at = validate_attempt(_read_json(directory / "attempt.json"))["attempted_at"]
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise ContractError(
            f"published dataset '{declaration.dataset_id}' has an unreadable status artifact: {error}"
        ) from error
    if failure is not None:
        if failure["stage"] not in DATASET_STAGES:
            raise ContractError(
                f"published dataset '{declaration.dataset_id}' blames a stage outside its pipeline"
            )
        index = DATASET_STAGES.index(failure["stage"])
        stages = [
            _stage(name, "succeeded", attempted_at)
            if position < index
            else _stage(name, "failed", attempted_at, failure)
            if position == index
            else _stage(name, "not-run")
            for position, name in enumerate(DATASET_STAGES)
        ]
    elif manifest is not None:
        state = manifest.status.get("state") if isinstance(manifest.status, dict) else None
        if state not in {"succeeded", "suspect"}:
            raise ContractError(
                f"published dataset '{declaration.dataset_id}' may only publish succeeded or suspect; "
                "a failure is recorded as a diagnostic and staleness is derived from the clock"
            )
        stages = [
            _stage("transform", "succeeded", attempted_at),
            _stage("test", state, attempted_at),
            _stage("publish-data", "succeeded", attempted_at),
        ]
    else:
        stages = [_stage(name, "not-run") for name in DATASET_STAGES]
        attempted_at = None
    # Freshness always follows the retained dataset: a failed observation never
    # presents itself as the latest usable output.
    period = dict(manifest.represented_period) if manifest is not None else None
    return {
        "pipelineId": declared["pipelineId"],
        "kind": "dataset",
        "name": declared["name"],
        "stages": stages,
        "state": precedence_state([item["state"] for item in stages]),
        "lastAttemptAt": attempted_at,
        "representedPeriod": period,
        "schedule": schedule,
        "latestUsableOutput": None
        if manifest is None
        else {
            "artifactKind": "dataset",
            "identity": manifest.content_sha256,
            "representedPeriod": period,
        },
        "assertions": []
        if manifest is None
        else _manifest_assertions(manifest.status, declaration.dataset_id),
        "diagnostic": failure,
    }


def _reject_undeclared(root: Path, kind: str, expected: dict[str, Any], activity: str) -> None:
    if not root.is_dir():
        return
    for child in sorted(root.iterdir()):
        if child.is_dir() and f"{kind}:{child.name}" not in expected:
            raise ContractError(f"undeclared {kind} pipeline '{child.name}' is {activity}")


def compile_status_catalog(
    *,
    sources_root: Path | None = None,
    datasets_root: Path | None = None,
    archive_root: Path = ROOT / "snapshots/public",
    publish_root: Path = ROOT / "publish/public",
    generated_at: str | None = None,
    expected: dict[str, Any] | None = None,
    site_attempted_at: str | None = None,
    dataset_ids: tuple[str, ...] | None = None,
) -> dict[str, Any]:
    """Compile one status artifact for every expected source and dataset pipeline.

    Everything published here is an observation. `stale` is absent by design:
    the reader derives it from the declared schedule against its own clock, so
    an artifact frozen at build time still reports overdue data.
    """
    sources, datasets = _discovered(sources_root, datasets_root)
    catalog_expected = compile_expected_pipelines(
        sources_root=sources_root, datasets_root=datasets_root, dataset_ids=dataset_ids
    )
    if expected is not None:
        validate_expected_pipelines(expected)
        if set(expected["pipelines"]) != set(catalog_expected["pipelines"]):
            raise ContractError("expected-pipeline catalog disagrees with the committed declarations")
    _reject_undeclared(archive_root, "source", catalog_expected["pipelines"], "archiving snapshots")
    _reject_undeclared(
        publish_root / "data", "dataset", catalog_expected["pipelines"], "publishing datasets"
    )
    pipelines: dict[str, Any] = {}
    for pipeline_id, declared in catalog_expected["pipelines"].items():
        declared_id = pipeline_id.split(":", 1)[1]
        if declared["kind"] == "system":
            continue
        if declared["kind"] == "source":
            pipelines[pipeline_id] = _source_status(declared, sources[declared_id], archive_root)
            continue
        declaration = datasets[declared_id]
        source = sources.get(declaration.source_id)
        if source is None:
            raise ContractError(
                f"dataset pipeline '{pipeline_id}' references an undeclared snapshot source"
            )
        pipelines[pipeline_id] = _dataset_status(
            declared, declaration, publish_root, browser_schedule(source.publication_schedule)
        )
    site_id = expected_pipeline_id("system", "site")
    declared_site = catalog_expected["pipelines"][site_id]
    state = "succeeded" if site_attempted_at is not None else "not-run"
    stages = [
        _stage(name, state, site_attempted_at if state == "succeeded" else None)
        for name in SYSTEM_STAGES
    ]
    deadlines = [
        deadline
        for entry in pipelines.values()
        if (deadline := _valid_until(entry["representedPeriod"], entry["schedule"])) is not None
    ]
    limiting_deadline = min(deadlines) if deadlines else None
    validity_day = limiting_deadline[:10] if limiting_deadline is not None else None
    period = None if validity_day is None else {"start": validity_day, "end": validity_day}
    pipelines[site_id] = {
        "pipelineId": site_id,
        "kind": "system",
        "name": declared_site["name"],
        "stages": stages,
        "state": state,
        "lastAttemptAt": site_attempted_at,
        "representedPeriod": period,
        # For a system pipeline this existing v1 period field is a validity
        # window, not a represented data period. Its end is the earliest
        # publication deadline in the public lineage; readers apply that
        # interpretation only when kind=system and schedule is null.
        "schedule": None,
        "latestUsableOutput": None,
        "assertions": [],
        "diagnostic": None,
    }
    catalog = {
        "schemaId": STATUS_SCHEMA_ID,
        "schemaVersion": STATUS_SCHEMA_VERSION,
        "generatedAt": generated_at or _utc_now(),
        "pipelines": pipelines,
    }
    validate_status_catalog(catalog, catalog_expected)
    return catalog


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def write_status_catalog(output: Path, **options: Any) -> Path:
    catalog = compile_status_catalog(**options)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(catalog, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return output


def status_report(catalog: dict[str, Any], now: datetime) -> list[str]:
    """Render one line per expected pipeline, with staleness resolved at read time."""
    lines = []
    for pipeline_id, entry in sorted(catalog["pipelines"].items()):
        period = entry["representedPeriod"]
        lines.append(
            "  ".join(
                (
                    pipeline_id.ljust(34),
                    display_state(entry, now).ljust(9),
                    ("data through " + (period["end"] if period else "none")).ljust(26),
                    "last attempt " + (entry["lastAttemptAt"] or "none"),
                )
            )
        )
    return lines
