"""Typed discovery and validation for declarative Pulse reports."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re
from typing import Any, Mapping

import yaml


ROOT = Path(__file__).resolve().parents[2]
REPORT_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
REPORT_ROUTE = re.compile(r"^[a-z0-9][a-z0-9/-]*$")
COLUMN = re.compile(r"^[a-z][a-z0-9_]*$")
LEGACY_FIELDS = {
    "id", "title", "route", "visibility", "datasets", "visuals", "lineage", "exploration"
}
V1_FIELDS = LEGACY_FIELDS | {
    "contract_version", "questions", "queries", "schemas", "annotations",
    "state_topology", "change",
}
V1_FIELDS_WITHOUT_ANNOTATIONS = V1_FIELDS - {"annotations"}
REPORT_STATES = {"ready", "loading", "empty", "query-error", "engine-error"}
SLOT_STATES = REPORT_STATES | {"suspect", "stale", "schema-error", "render-error"}


class ReportError(ValueError):
    """A report declaration or annotation contract is unsafe or incomplete."""


@dataclass(frozen=True)
class ReportDeclaration:
    report_id: str
    title: str
    route: str
    visibility: str
    datasets: tuple[str, ...]
    raw: dict[str, Any]
    path: Path
    dependency_columns: Mapping[str, frozenset[str]]

    @property
    def is_legacy(self) -> bool:
        return "contract_version" not in self.raw


def _strings(value: Any, *, subject: str, identifiers: bool = False, allow_empty: bool = False) -> tuple[str, ...]:
    if (
        not isinstance(value, list) or (not value and not allow_empty)
        or any(not isinstance(item, str) or not item.strip() for item in value)
        or len(value) != len(set(value))
        or (identifiers and any(not REPORT_ID.fullmatch(item) for item in value))
    ):
        raise ReportError(f"{subject} must be a non-empty unique string list")
    return tuple(value)


def _relative_file(value: Any, *, subject: str) -> str:
    if not isinstance(value, str) or not value or Path(value).is_absolute() or ".." in Path(value).parts:
        raise ReportError(f"{subject} must be a safe report-relative path")
    return value


def _validate_exploration(value: Any) -> None:
    if (
        not isinstance(value, dict)
        or set(value) != {"enabled", "default_period", "controls"}
        or not isinstance(value["enabled"], bool)
        or not isinstance(value["default_period"], str) or not value["default_period"]
    ):
        raise ReportError("exploration declaration is invalid")
    _strings(value["controls"], subject="exploration controls")


def _validate_v1(
    raw: dict[str, Any],
    path: Path,
    datasets: tuple[str, ...],
    *,
    logical_tables: Mapping[str, str] | None,
) -> None:
    if raw["contract_version"] != "1.0.0":
        raise ReportError("report contract has an unsupported major version")
    questions = raw["questions"]
    if not isinstance(questions, list) or not questions:
        raise ReportError("questions must be a non-empty list")
    question_ids: set[str] = set()
    for item in questions:
        if (
            not isinstance(item, dict) or set(item) != {"id", "question"}
            or not isinstance(item["id"], str) or not REPORT_ID.fullmatch(item["id"])
            or item["id"] in question_ids
            or not isinstance(item["question"], str) or not item["question"].strip()
        ):
            raise ReportError("question declaration is invalid")
        question_ids.add(item["id"])

    queries = raw["queries"]
    if not isinstance(queries, list) or not queries:
        raise ReportError("queries must be a non-empty list")
    query_ids: set[str] = set()
    for item in queries:
        if not isinstance(item, dict) or set(item) != {"id", "dataset", "sql", "parameters", "columns"}:
            raise ReportError("query declaration fields are not exact")
        parameters = _strings(item["parameters"], subject="query parameters", identifiers=True, allow_empty=True)
        columns = _strings(item["columns"], subject="query columns")
        if (
            not isinstance(item["id"], str) or not REPORT_ID.fullmatch(item["id"])
            or item["id"] in query_ids or item["dataset"] not in datasets
            or not isinstance(item["sql"], str) or not item["sql"].strip()
            or item["sql"].count("?") != len(parameters)
            or any(not COLUMN.fullmatch(column) for column in columns)
        ):
            raise ReportError("query identity, dataset, SQL, parameters, or columns are invalid")
        # Reports may select only from the declared dataset and never own storage.
        lowered = item["sql"].lower()
        if any(token in lowered for token in ("read_parquet", "attach ", "install ", "load ", "http://", "https://")):
            raise ReportError("query crosses the report data-client boundary")
        if logical_tables is not None:
            table = logical_tables.get(item["dataset"])
            if table is None:
                raise ReportError(f"query references unknown dataset '{item['dataset']}'")
            referenced_tables = {
                match.group(1).strip('"').lower()
                for match in re.finditer(
                    r"\b(?:from|join)\s+([A-Za-z_][A-Za-z0-9_]*|\"[A-Za-z_][A-Za-z0-9_]*\")",
                    item["sql"],
                    re.IGNORECASE,
                )
            }
            if referenced_tables != {table.lower()}:
                raise ReportError(
                    f"query '{item['id']}' must select only declared dataset table '{table}'"
                )
        query_ids.add(item["id"])

    schemas = raw["schemas"]
    if not isinstance(schemas, dict) or not schemas:
        raise ReportError("schemas must declare each visual input")
    for schema_id, columns in schemas.items():
        if not REPORT_ID.fullmatch(schema_id) or not isinstance(columns, list) or not columns:
            raise ReportError("visual schema identity is invalid")
        names: set[str] = set()
        for column in columns:
            if (
                not isinstance(column, dict) or set(column) != {"name", "type", "nullable"}
                or not isinstance(column["name"], str) or not COLUMN.fullmatch(column["name"])
                or column["name"] in names
                or column["type"] not in {"string", "number", "integer", "boolean", "date"}
                or not isinstance(column["nullable"], bool)
            ):
                raise ReportError("visual schema column is invalid")
            names.add(column["name"])

    visual_ids: set[str] = set()
    for visual in raw["visuals"]:
        expected = {"id", "contract", "dataset", "columns", "question", "query", "schema"}
        if not isinstance(visual, dict) or set(visual) != expected:
            raise ReportError("v1 visual slot fields are not exact")
        if (
            not isinstance(visual["id"], str) or not REPORT_ID.fullmatch(visual["id"])
            or not isinstance(visual["contract"], str) or not visual["contract"].startswith("1.")
            or visual["question"] not in question_ids or visual["query"] not in query_ids
            or visual["schema"] not in schemas or visual["id"] in visual_ids
        ):
            raise ReportError("visual question, query, schema, or identity is invalid")
        query = next(item for item in queries if item["id"] == visual["query"])
        schema_columns = [item["name"] for item in schemas[visual["schema"]]]
        if visual["dataset"] != query["dataset"] or visual["columns"] != query["columns"] or visual["columns"] != schema_columns:
            raise ReportError("visual lineage must agree with its query and schema")
        visual_ids.add(visual["id"])

    if "annotations" in raw:
        annotations = raw["annotations"]
        if not isinstance(annotations, dict) or set(annotations) != {"path", "version", "query", "identity", "anchor", "dependencies"}:
            raise ReportError("annotation declaration fields are not exact")
        _relative_file(annotations["path"], subject="annotation path")
        if annotations["version"] != "1.0.0" or annotations["query"] not in query_ids:
            raise ReportError("annotation version or join query is invalid")
        identity = annotations["identity"]
        anchor = annotations["anchor"]
        query = next(item for item in queries if item["id"] == annotations["query"])
        if (
            identity != "id"
            or not isinstance(anchor, str) or not COLUMN.fullmatch(anchor)
            or anchor not in query["columns"]
        ):
            raise ReportError("annotation identity or anchor is invalid")
        dependencies = annotations["dependencies"]
        if not isinstance(dependencies, list):
            raise ReportError("annotation dependencies must be declared")
        for dependency in dependencies:
            if (
                not isinstance(dependency, dict) or set(dependency) != {"dataset", "columns"}
                or dependency["dataset"] not in datasets
            ):
                raise ReportError("annotation dependency is invalid")
            _strings(dependency["columns"], subject="annotation dependency columns")

    topology = raw["state_topology"]
    if (
        not isinstance(topology, dict) or set(topology) != {"report", "slot", "failure_scope", "retry"}
        or set(_strings(topology["report"], subject="report states")) != REPORT_STATES
        or set(_strings(topology["slot"], subject="slot states")) != SLOT_STATES
        or topology["failure_scope"] != "slot-local"
        or topology["retry"] != "safe"
    ):
        raise ReportError("state topology must preserve accessible slot-local isolation")
    change = raw["change"]
    if (
        not isinstance(change, dict) or set(change) != {"version", "summary"}
        or not isinstance(change["version"], str) or not change["version"].startswith("1.")
        or not isinstance(change["summary"], str) or not change["summary"].strip()
    ):
        raise ReportError("declared change metadata is invalid")


def load_report_declaration(
    path: Path, *, logical_tables: Mapping[str, str] | None = None
) -> ReportDeclaration:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise ReportError(f"invalid YAML declaration at {path}") from error
    if not isinstance(raw, dict) or set(raw) not in {
        frozenset(LEGACY_FIELDS),
        frozenset(V1_FIELDS),
        frozenset(V1_FIELDS_WITHOUT_ANNOTATIONS),
    }:
        raise ReportError(f"report declaration fields are not exact at {path}")
    report_id, route = raw["id"], raw["route"]
    if not isinstance(report_id, str) or not REPORT_ID.fullmatch(report_id):
        raise ReportError("report IDs must be lowercase kebab-case")
    if not isinstance(raw["title"], str) or not raw["title"].strip():
        raise ReportError(f"report '{report_id}' title is invalid")
    if not isinstance(route, str) or not REPORT_ROUTE.fullmatch(route) or ".." in Path(route).parts:
        raise ReportError("report routes must be safe nested routes")
    if raw["visibility"] not in {"public", "private"}:
        raise ReportError(f"report '{report_id}' visibility is invalid")
    datasets = _strings(raw["datasets"], subject=f"report '{report_id}' datasets", identifiers=True)
    _validate_exploration(raw["exploration"])
    if not isinstance(raw["visuals"], list) or not raw["visuals"]:
        raise ReportError(f"report '{report_id}' visual slots are invalid")
    if set(raw) == LEGACY_FIELDS:
        ids: set[str] = set()
        for visual in raw["visuals"]:
            if not isinstance(visual, dict) or set(visual) != {"id", "contract", "dataset", "columns"}:
                raise ReportError(f"report '{report_id}' visual slot is invalid")
            if (
                not isinstance(visual["id"], str) or not REPORT_ID.fullmatch(visual["id"])
                or visual["id"] in ids or visual["dataset"] not in datasets
                or not isinstance(visual["contract"], str) or not visual["contract"].startswith("1.")
            ):
                raise ReportError(f"report '{report_id}' visual identity or dataset is invalid")
            _strings(visual["columns"], subject=f"report '{report_id}' visual columns")
            ids.add(visual["id"])
    else:
        if logical_tables is None:
            from pulse.datasets import DatasetError, discover_datasets

            try:
                logical_tables = {
                    dataset_id: declaration.logical_table
                    for dataset_id, declaration in discover_datasets().items()
                }
            except DatasetError as error:
                raise ReportError(f"committed dataset discovery failed: {error}") from error
        _validate_v1(raw, path, datasets, logical_tables=logical_tables)
    lineage = raw["lineage"]
    if not isinstance(lineage, dict) or set(lineage) != set(datasets):
        raise ReportError(f"report '{report_id}' column lineage is incomplete")
    dependencies: dict[str, frozenset[str]] = {}
    for dataset_id, columns in lineage.items():
        dependencies[dataset_id] = frozenset(_strings(columns, subject=f"report '{report_id}' lineage"))
    if "annotations" in raw:
        for dependency in raw["annotations"]["dependencies"]:
            dependencies[dependency["dataset"]] = dependencies.get(dependency["dataset"], frozenset()) | frozenset(dependency["columns"])
    return ReportDeclaration(report_id, raw["title"], route, raw["visibility"], datasets, raw, path, dependencies)


def discover_reports(
    root: Path = ROOT / "site/reports", *, logical_tables: Mapping[str, str] | None = None
) -> dict[str, ReportDeclaration]:
    reports: dict[str, ReportDeclaration] = {}
    routes: set[str] = set()
    for path in sorted(root.glob("**/report.yml")):
        report = load_report_declaration(path, logical_tables=logical_tables)
        if report.report_id in reports or report.route in routes:
            raise ReportError("report catalog has duplicate report identity or route")
        reports[report.report_id] = report
        routes.add(report.route)
    if not reports:
        raise ReportError("report catalog has no declarations")
    return reports


def resolve_report_visibility(
    report: ReportDeclaration,
    *,
    dataset_visibility: Mapping[str, str],
) -> tuple[str, list[dict[str, Any]]]:
    """Resolve all declared lineage before anything can enter public closure."""
    unknown = sorted(set(report.dependency_columns) - set(dataset_visibility))
    if unknown:
        raise ReportError(
            f"report '{report.report_id}' references unknown dataset lineage: {', '.join(unknown)}"
        )
    invalid = sorted(
        dataset_id
        for dataset_id, visibility in dataset_visibility.items()
        if dataset_id in report.dependency_columns and visibility not in {"public", "private"}
    )
    if invalid:
        raise ReportError(
            f"report '{report.report_id}' has unresolved dataset visibility: {', '.join(invalid)}"
        )
    annotation_rows: list[dict[str, Any]] = []
    if "annotations" in report.raw:
        annotation_rows = load_annotations(
            report.path.parent / report.raw["annotations"]["path"],
            declaration=report.raw["annotations"],
        )
    inherited_private = any(
        dataset_visibility[dataset_id] == "private" for dataset_id in report.dependency_columns
    ) or any(row["visibility"] == "private" for row in annotation_rows)
    resolved = "private" if report.visibility == "private" or inherited_private else "public"
    return resolved, annotation_rows


def load_annotations(path: Path, *, declaration: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Validate versioned annotations without permitting presentation coordinates."""
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ReportError(f"invalid annotations at {path}") from error
    if not isinstance(value, dict) or set(value) != {"schemaVersion", "annotations"} or value["schemaVersion"] != declaration["version"]:
        raise ReportError("annotation artifact version is invalid")
    if not isinstance(value["annotations"], list):
        raise ReportError("annotation rows are invalid")
    allowed_dependencies = {
        (dependency["dataset"], column)
        for dependency in declaration.get("dependencies", [])
        for column in dependency.get("columns", [])
    }
    ids: set[str] = set()
    rows = []
    for row in value["annotations"]:
        if (
            not isinstance(row, dict)
            or set(row) != {"id", "anchor", "body", "provenance", "dependencies", "visibility"}
            or not isinstance(row["id"], str) or not REPORT_ID.fullmatch(row["id"]) or row["id"] in ids
            or not isinstance(row["anchor"], str) or not row["anchor"]
            or not isinstance(row["body"], str) or not row["body"].strip()
            or not isinstance(row["provenance"], str) or not row["provenance"].strip()
            or row["visibility"] not in {"public", "private"}
            or not isinstance(row["dependencies"], list)
            or any(
                not isinstance(dependency, dict)
                or set(dependency) != {"dataset", "column"}
                or (dependency["dataset"], dependency["column"]) not in allowed_dependencies
                for dependency in row["dependencies"]
            )
            or any(key.lower() in {"x", "y", "left", "top", "pixel", "coordinates"} for key in row)
        ):
            raise ReportError("annotation identity, anchor, provenance, or dependency is invalid")
        ids.add(row["id"])
        rows.append(row)
    return rows
