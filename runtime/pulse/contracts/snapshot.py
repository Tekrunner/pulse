"""Strict contract for immutable source snapshots."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
import re
from typing import Any


SNAPSHOT_SCHEMA_ID = "pulse.snapshot"
SNAPSHOT_SCHEMA_VERSION = "1.0.0"
_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class ContractError(ValueError):
    """A Pulse contract is incomplete or incompatible."""


@dataclass(frozen=True)
class SnapshotManifest:
    schema_id: str
    schema_version: str
    source_id: str
    acquisition_id: str
    snapshot_id: str
    acquired_at: str
    source_data_date: str | None
    source_urls: list[str]
    artifacts: list[dict[str, str]]
    observed_schema_sha256: str
    decoder_version: str
    tool_versions: dict[str, str]
    licence: str
    attribution: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def utc_timestamp(value: str, field: str) -> None:
    """Reject anything but a UTC ISO-8601 timestamp ending in Z."""
    if not value.endswith("Z"):
        raise ContractError(f"{field} must be a UTC ISO-8601 timestamp ending in Z")
    try:
        datetime.fromisoformat(value.removesuffix("Z") + "+00:00")
    except ValueError as error:
        raise ContractError(f"{field} must be a UTC ISO-8601 timestamp") from error


def validate_snapshot_manifest(value: dict[str, Any]) -> SnapshotManifest:
    required = set(SnapshotManifest.__annotations__)
    unknown = set(value) - required
    missing = required - set(value)
    if missing or unknown:
        parts = []
        if missing:
            parts.append("missing " + ", ".join(sorted(missing)))
        if unknown:
            parts.append("unknown " + ", ".join(sorted(unknown)))
        raise ContractError("snapshot manifest has " + "; ".join(parts))
    if value["schema_id"] != SNAPSHOT_SCHEMA_ID:
        raise ContractError("snapshot manifest has unsupported schema ID")
    if value["schema_version"].split(".", 1)[0] != "1":
        raise ContractError("snapshot manifest has unsupported major version")
    for field in ("source_id", "acquisition_id"):
        if not isinstance(value[field], str) or not _ID.fullmatch(value[field]):
            raise ContractError(f"snapshot manifest {field} must be lowercase kebab-case")
    if not isinstance(value["snapshot_id"], str) or not value["snapshot_id"].startswith(value["acquisition_id"] + "-"):
        raise ContractError("snapshot manifest snapshot_id must derive from acquisition_id")
    utc_timestamp(value["acquired_at"], "acquired_at")
    if value["source_data_date"] is not None:
        if not isinstance(value["source_data_date"], str):
            raise ContractError("source_data_date must be an ISO date or null")
        try:
            datetime.fromisoformat(value["source_data_date"] + "T00:00:00+00:00")
        except ValueError as error:
            raise ContractError("source_data_date must be an ISO date or null") from error
    if not value["source_urls"] or not all(isinstance(url, str) and url.startswith("https://") for url in value["source_urls"]):
        raise ContractError("snapshot manifest source_urls must contain HTTPS URLs")
    if not isinstance(value["artifacts"], list) or len(value["artifacts"]) != 1:
        raise ContractError("snapshot manifest must identify exactly one raw artifact")
    artifact = value["artifacts"][0]
    if set(artifact) != {"path", "sha256"} or artifact["path"] != "raw.parquet" or not _SHA256.fullmatch(artifact["sha256"]):
        raise ContractError("snapshot manifest raw artifact is invalid")
    if not _SHA256.fullmatch(value["observed_schema_sha256"]):
        raise ContractError("snapshot manifest observed_schema_sha256 must be SHA-256")
    for field in ("decoder_version", "licence", "attribution"):
        if not isinstance(value[field], str) or not value[field].strip():
            raise ContractError(f"snapshot manifest {field} must be non-empty")
    if not isinstance(value["tool_versions"], dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in value["tool_versions"].items()):
        raise ContractError("snapshot manifest tool_versions must be a string map")
    return SnapshotManifest(**value)
