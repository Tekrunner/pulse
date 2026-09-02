"""Strict public dataset and safe diagnostic contracts."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from pulse.contracts.snapshot import ContractError


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

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def validate_dataset_manifest(value: dict[str, Any]) -> DatasetManifest:
    required = set(DatasetManifest.__annotations__)
    if set(value) != required:
        raise ContractError("dataset manifest fields are not exact")
    if value["schema_id"] != DATASET_SCHEMA_ID or not str(value["schema_version"]).startswith("1."):
        raise ContractError("dataset manifest has unsupported contract version")
    shapes = {
        "insee-cpi/monthly": ("insee_cpi_monthly", {"period", "cpi_index", "monthly_change_pct", "annual_change_pct"}, 3),
        "insee-cpi/category-analysis": ("insee_cpi_category_analysis", {"period", "food_index", "food_annual_change_pct", "energy_index", "energy_annual_change_pct", "actual_rent_index", "actual_rent_annual_change_pct", "food_weight", "food_weight_reference_year", "energy_weight", "energy_weight_reference_year", "actual_rent_weight", "actual_rent_weight_reference_year", "food_official_contribution_pct_points", "services_official_contribution_pct_points", "manufactured_products_official_contribution_pct_points", "energy_official_contribution_pct_points", "actual_rent_pulse_contribution_pct_points"}, 17),
    }
    shape = shapes.get(value["dataset_id"])
    if shape is None or value["logical_table"] != shape[0]:
        raise ContractError("dataset manifest has invalid dataset identity or table")
    if value["visibility"] != "public" or not isinstance(value["content_sha256"], str) or len(value["content_sha256"]) != 64:
        raise ContractError("dataset manifest has invalid public content identity")
    if set(value["represented_period"]) != {"start", "end"}:
        raise ContractError("dataset manifest represented period is invalid")
    if not isinstance(value["columns"], list) or {c.get("name") for c in value["columns"]} != shape[1]:
        raise ContractError("dataset manifest must document all output columns")
    if not isinstance(value["indicators"], list) or len(value["indicators"]) != shape[2]:
        raise ContractError("dataset manifest must document all indicators")
    if not isinstance(value["lineage"], dict) or not isinstance(value["status"], dict):
        raise ContractError("dataset manifest lineage and status must be objects")
    return DatasetManifest(**value)


def diagnostic(stage: str, code: str, message: str, *, retryable: bool) -> dict[str, Any]:
    value = {"schema_id": DIAGNOSTIC_SCHEMA_ID, "schema_version": DIAGNOSTIC_SCHEMA_VERSION,
             "stage": stage, "code": code, "message": message, "retryable": retryable}
    validate_diagnostic(value)
    return value


def validate_diagnostic(value: dict[str, Any]) -> dict[str, Any]:
    required = {"schema_id", "schema_version", "stage", "code", "message", "retryable"}
    if set(value) != required:
        raise ContractError("diagnostic fields are not exact")
    if value["schema_id"] != DIAGNOSTIC_SCHEMA_ID or not str(value["schema_version"]).startswith("1."):
        raise ContractError("diagnostic has unsupported contract version")
    if not all(isinstance(value[key], str) and value[key] for key in ("stage", "code", "message")):
        raise ContractError("diagnostic text fields are invalid")
    if not isinstance(value["retryable"], bool):
        raise ContractError("diagnostic retryable must be boolean")
    return value
