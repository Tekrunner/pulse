"""Contracts for a faithful, disposable landing artifact."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from pulse.contracts.snapshot import ContractError


LANDING_SCHEMA_ID = "pulse.landing"
LANDING_SCHEMA_VERSION = "1.0.0"


@dataclass(frozen=True)
class LandingManifest:
    schema_id: str
    schema_version: str
    source_id: str
    snapshot_id: str
    snapshot_sha256: str
    parquet_path: str
    parquet_sha256: str
    row_count: int
    observed_schema: dict[str, str]
    compatible_additions: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def validate_landing_manifest(value: dict[str, Any]) -> LandingManifest:
    required = set(LandingManifest.__annotations__)
    if set(value) != required:
        raise ContractError("landing manifest fields are not exact")
    if value["schema_id"] != LANDING_SCHEMA_ID or not str(value["schema_version"]).startswith("1."):
        raise ContractError("landing manifest has unsupported contract version")
    for key in ("source_id", "snapshot_id", "snapshot_sha256", "parquet_path", "parquet_sha256"):
        if not isinstance(value[key], str) or not value[key]:
            raise ContractError(f"landing manifest {key} must be non-empty")
    if not isinstance(value["row_count"], int) or value["row_count"] <= 0:
        raise ContractError("landing manifest row_count must be positive")
    if not isinstance(value["observed_schema"], dict) or not all(
        isinstance(k, str) and isinstance(v, str) for k, v in value["observed_schema"].items()
    ):
        raise ContractError("landing manifest observed_schema must be a string map")
    if not isinstance(value["compatible_additions"], list) or not all(isinstance(v, str) for v in value["compatible_additions"]):
        raise ContractError("landing manifest compatible_additions must be strings")
    return LandingManifest(**value)
