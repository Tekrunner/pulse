"""Discovery, validation, and execution contracts for acquisition packages."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import importlib.util
from pathlib import Path
import re
import sys
from types import ModuleType
from typing import Any

import yaml

from pulse.contracts.snapshot import ContractError
from pulse.contracts.status import validate_publication_schedule


ROOT = Path(__file__).resolve().parents[2]
_SOURCE_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class SourceDeclarationError(ValueError):
    """A source declaration cannot participate in a Pulse run."""


class SourceAcquisitionError(ValueError):
    """A sanitized adapter failure with an explicit retry classification."""

    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


@dataclass(frozen=True)
class SourceDeclaration:
    source_id: str
    name: str
    visibility: str
    configuration: dict[str, Any]
    cadence: str
    expected_publication_advance: str
    publication_schedule: dict[str, Any]
    licence: str
    attribution: str
    snapshot_contract: dict[str, Any]
    path: Path


@dataclass(frozen=True)
class AdapterAcquisition:
    """Source-neutral output handed from an adapter to immutable archival."""

    rows: list[dict[str, Any]]
    source_data_date: str | None
    source_urls: list[str]
    decoder_version: str


def _required_string(data: dict[str, Any], key: str, path: Path) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise SourceDeclarationError(f"{path}: missing required '{key}'")
    return value


def _load_snapshot_contract(path: Path) -> dict[str, Any]:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise SourceDeclarationError(f"{path}: invalid snapshot contract") from error
    if not isinstance(raw, dict) or set(raw) != {
        "contract_version",
        "format",
        "required_fields",
        "compatible_additions",
    }:
        raise SourceDeclarationError(f"{path}: snapshot contract fields are not exact")
    if not isinstance(raw["contract_version"], str) or not raw["contract_version"].startswith("1."):
        raise SourceDeclarationError(f"{path}: unsupported snapshot contract major")
    if raw["format"] != "parquet" or not isinstance(raw["compatible_additions"], bool):
        raise SourceDeclarationError(f"{path}: snapshot format or addition policy is invalid")
    fields = raw["required_fields"]
    if not isinstance(fields, dict) or not fields or not all(
        isinstance(name, str) and name and kind in {"string", "integer", "number", "boolean"}
        for name, kind in fields.items()
    ):
        raise SourceDeclarationError(f"{path}: required snapshot fields are invalid")
    return raw


def _load_publication_schedule(raw: dict[str, Any], path: Path) -> dict[str, Any]:
    """Validate the declared, machine-readable schedule beside its prose cadence.

    The prose fields stay: they say what a reader needs to know. This adds the
    part a machine needs, so an overdue period is computable rather than
    inferred from English.
    """
    try:
        return validate_publication_schedule(raw.get("publication_schedule"))
    except ContractError as error:
        raise SourceDeclarationError(f"{path}: {error}") from error


def load_source_declaration(path: Path) -> SourceDeclaration:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise SourceDeclarationError(f"{path}: invalid YAML declaration") from error
    if not isinstance(raw, dict):
        raise SourceDeclarationError(f"{path}: declaration must be a mapping")
    source_id = _required_string(raw, "id", path)
    if not _SOURCE_ID.fullmatch(source_id):
        raise SourceDeclarationError(f"{path}: id must be lowercase kebab-case")
    if raw.get("visibility") not in {"public", "private"}:
        raise SourceDeclarationError(f"{path}: visibility must be public or private")
    configuration = raw.get("acquisition")
    if not isinstance(configuration, dict) or not configuration:
        raise SourceDeclarationError(f"{path}: acquisition must be a non-empty provider configuration")
    lowered_configuration = str(configuration).lower()
    if "token" in lowered_configuration or "password" in lowered_configuration:
        raise SourceDeclarationError(f"{path}: credentials are forbidden in declarations")
    contract_name = _required_string(raw, "snapshot_contract", path)
    if Path(contract_name).name != contract_name:
        raise SourceDeclarationError(f"{path}: snapshot_contract must be a package-local filename")
    return SourceDeclaration(
        source_id=source_id,
        name=_required_string(raw, "name", path),
        visibility=raw["visibility"],
        configuration=configuration,
        cadence=_required_string(raw, "fetch_cadence", path),
        expected_publication_advance=_required_string(raw, "expected_publication_advance", path),
        publication_schedule=_load_publication_schedule(raw, path),
        licence=_required_string(raw, "licence", path),
        attribution=_required_string(raw, "attribution", path),
        snapshot_contract=_load_snapshot_contract(path.parent / contract_name),
        path=path,
    )


def discover_sources(root: Path = ROOT / "sources") -> dict[str, SourceDeclaration]:
    found: dict[str, SourceDeclaration] = {}
    for path in sorted(root.glob("*/source.yaml")):
        declaration = load_source_declaration(path)
        if declaration.source_id in found:
            raise SourceDeclarationError(f"duplicate source ID '{declaration.source_id}'")
        found[declaration.source_id] = declaration
    return found


def load_source_adapter(declaration: SourceDeclaration) -> ModuleType:
    """Load and validate a package-local acquisition adapter without a registry."""
    adapter_path = declaration.path.parent / "acquire.py"
    if not adapter_path.is_file():
        raise SourceDeclarationError(f"{declaration.path}: missing package-local acquire.py")
    module_name = f"pulse_source_{declaration.source_id.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(module_name, adapter_path)
    if spec is None or spec.loader is None:
        raise SourceDeclarationError(f"{adapter_path}: could not load source adapter")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception as error:
        sys.modules.pop(module_name, None)
        raise SourceDeclarationError(f"{adapter_path}: source adapter could not load") from error
    if not callable(getattr(module, "acquire", None)):
        raise SourceDeclarationError(f"{adapter_path}: adapter must define callable acquire")
    return module


def acquire_from_adapter(
    declaration: SourceDeclaration, *, fixture: Path | None, live: bool
) -> AdapterAcquisition:
    """Invoke any conforming adapter and validate its source-neutral result."""
    adapter = load_source_adapter(declaration)
    try:
        result = adapter.acquire(declaration.configuration, fixture=fixture, live=live)
    except ValueError:
        raise
    except Exception as error:
        raise SourceDeclarationError("source adapter acquisition failed") from error
    if not isinstance(result, AdapterAcquisition):
        raise SourceDeclarationError(
            f"{declaration.path.parent / 'acquire.py'}: acquire must return AdapterAcquisition"
        )
    if not result.rows or not all(isinstance(row, dict) and row for row in result.rows):
        raise SourceDeclarationError("source adapter returned no faithful object rows")
    if not all(
        isinstance(key, str) and bool(key.strip())
        for row in result.rows
        for key in row
    ):
        raise SourceDeclarationError("source adapter row field names must be non-empty strings")
    if result.source_data_date is not None:
        if not isinstance(result.source_data_date, str) or not _ISO_DATE.fullmatch(
            result.source_data_date
        ):
            raise SourceDeclarationError("source adapter source_data_date must be an ISO calendar date or null")
        try:
            date.fromisoformat(result.source_data_date)
        except ValueError as error:
            raise SourceDeclarationError(
                "source adapter source_data_date must be an ISO calendar date or null"
            ) from error
    if (
        not result.source_urls
        or not all(isinstance(url, str) and url.startswith("https://") for url in result.source_urls)
    ):
        raise SourceDeclarationError("source adapter returned invalid HTTPS provenance URLs")
    if not isinstance(result.decoder_version, str) or not result.decoder_version.strip():
        raise SourceDeclarationError("source adapter returned an invalid decoder version")
    required = declaration.snapshot_contract["required_fields"]
    python_types = {
        "string": str,
        "integer": int,
        "number": (int, float),
        "boolean": bool,
    }
    for row in result.rows:
        missing = set(required) - set(row)
        if missing:
            raise SourceDeclarationError(
                "source adapter output is missing snapshot fields: " + ", ".join(sorted(missing))
            )
        for field, kind in required.items():
            if not isinstance(row[field], python_types[kind]):
                raise SourceDeclarationError(
                    f"source adapter field '{field}' violates the snapshot contract"
                )
        if not declaration.snapshot_contract["compatible_additions"] and set(row) != set(required):
            raise SourceDeclarationError("source adapter output has undeclared snapshot fields")
    return result
