"""Strict public dataset and safe diagnostic contracts."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from pulse.contracts.snapshot import ContractError
from pulse.contracts.status import CANONICAL_STAGES


DATASET_SCHEMA_ID = "pulse.dataset"
DATASET_SCHEMA_VERSION = "1.0.0"
DIAGNOSTIC_SCHEMA_ID = "pulse.diagnostic"
DIAGNOSTIC_SCHEMA_VERSION = "1.0.0"


@dataclass(frozen=True)
class DatasetManifest:
    schema_id: str
    schema_version: str
    dataset_id: str
    source_id: str
    logical_table: str
    visibility: str
    parquet_path: str
    content_sha256: str
    represented_period: dict[str, str]
    lineage: dict[str, Any]
    model: dict[str, str]
    columns: list[dict[str, Any]]
    indicators: list[dict[str, Any]]
    status: dict[str, Any]
    questions: list[dict[str, Any]] = field(default_factory=list)
    temporal: dict[str, str] = field(default_factory=dict)
    validations: list[dict[str, Any]] = field(default_factory=list)
    adapters: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def validate_dataset_manifest(value: dict[str, Any], contract: Any | None = None) -> DatasetManifest:
    # Rich semantic fields are additive in v1. Older immutable publications
    # remain readable, while newly authored packages can carry the complete
    # question/derivation/temporal/validation contract.
    value = dict(value)
    value.setdefault("questions", [])
    value.setdefault("temporal", {})
    value.setdefault("validations", [])
    value.setdefault("adapters", [])
    required = set(DatasetManifest.__annotations__)
    if set(value) != required:
        raise ContractError("dataset manifest fields are not exact")
    if value["schema_id"] != DATASET_SCHEMA_ID or not str(value["schema_version"]).startswith("1."):
        raise ContractError("dataset manifest has unsupported contract version")
    if not isinstance(value["dataset_id"], str) or not value["dataset_id"] or "/" in value["dataset_id"]:
        raise ContractError("dataset manifest has invalid source-neutral dataset identity")
    if not isinstance(value["logical_table"], str) or not value["logical_table"]:
        raise ContractError("dataset manifest has invalid logical table")
    if value["visibility"] not in {"public", "private"} or not isinstance(value["content_sha256"], str) or len(value["content_sha256"]) != 64:
        raise ContractError("dataset manifest has invalid content identity")
    if set(value["represented_period"]) != {"start", "end"}:
        raise ContractError("dataset manifest represented period is invalid")
    if not isinstance(value["columns"], list) or not value["columns"]:
        raise ContractError("dataset manifest must document output columns")
    if not isinstance(value["indicators"], list):
        raise ContractError("dataset manifest indicators must be a list")
    if not isinstance(value["questions"], list) or not isinstance(value["temporal"], dict) or not isinstance(value["validations"], list) or not isinstance(value["adapters"], list):
        raise ContractError("dataset manifest semantic extensions are invalid")
    adapter_fields = {"version", "owner", "removal_condition", "logical_table", "column_mapping"}
    for adapter in value["adapters"]:
        if (
            not isinstance(adapter, dict)
            or set(adapter) != adapter_fields
            or not isinstance(adapter["version"], str)
            or not adapter["version"].startswith("1.")
            or not all(isinstance(adapter[key], str) and adapter[key].strip() for key in ("owner", "removal_condition", "logical_table"))
            or not isinstance(adapter["column_mapping"], dict)
            or not adapter["column_mapping"]
            or not all(isinstance(old, str) and old and isinstance(new, str) and new for old, new in adapter["column_mapping"].items())
        ):
            raise ContractError("dataset manifest compatibility adapter is invalid")
    if not isinstance(value["lineage"], dict) or not isinstance(value["status"], dict):
        raise ContractError("dataset manifest lineage and status must be objects")
    if contract is not None:
        if value["schema_version"] != contract.contract_version:
            raise ContractError("dataset manifest version disagrees with committed contract")
        if value["model"] != contract.model or value["columns"] != contract.columns or value["indicators"] != contract.indicators:
            raise ContractError("dataset manifest semantics disagree with committed contract")
        if value["questions"] != (contract.questions or []) or value["temporal"] != (contract.temporal or {}) or value["validations"] != (contract.validations or []):
            raise ContractError("dataset manifest semantic extensions disagree with committed contract")
    return DatasetManifest(**value)


def diagnostic(stage: str, code: str, message: str, *, retryable: bool) -> dict[str, Any]:
    """Build a safe diagnostic attributed to the canonical stage that failed."""
    value = {"schema_id": DIAGNOSTIC_SCHEMA_ID, "schema_version": DIAGNOSTIC_SCHEMA_VERSION,
             "stage": stage, "code": code, "message": message, "retryable": retryable}
    validate_diagnostic(value)
    return value


def validate_diagnostic(value: dict[str, Any]) -> dict[str, Any]:
    required = {"schema_id", "schema_version", "stage", "code", "message", "retryable"}
    if not isinstance(value, dict) or set(value) != required:
        raise ContractError("diagnostic fields are not exact")
    if value["schema_id"] != DIAGNOSTIC_SCHEMA_ID or not str(value["schema_version"]).startswith("1."):
        raise ContractError("diagnostic has unsupported contract version")
    if not all(isinstance(value[key], str) and value[key] for key in ("stage", "code", "message")):
        raise ContractError("diagnostic text fields are invalid")
    # A diagnostic that cannot be attributed to a canonical stage cannot be
    # displayed against a pipeline, so an uncanonical stage is a contract error.
    if value["stage"] not in CANONICAL_STAGES:
        raise ContractError(
            "diagnostic stage must be one of " + ", ".join(CANONICAL_STAGES)
        )
    if not isinstance(value["retryable"], bool):
        raise ContractError("diagnostic retryable must be boolean")
    return value
