"""Discovery, validation, and execution contracts for source-local adapters."""

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


ROOT = Path(__file__).resolve().parents[2]
_SOURCE_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class SourceDeclarationError(ValueError):
    """A source declaration cannot participate in a Pulse run."""


@dataclass(frozen=True)
class SourceDeclaration:
    source_id: str
    name: str
    visibility: str
    configuration: dict[str, Any]
    cadence: str
    expected_publication_advance: str
    licence: str
    attribution: str
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
    return SourceDeclaration(
        source_id=source_id,
        name=_required_string(raw, "name", path),
        visibility=raw["visibility"],
        configuration=configuration,
        cadence=_required_string(raw, "fetch_cadence", path),
        expected_publication_advance=_required_string(raw, "expected_publication_advance", path),
        licence=_required_string(raw, "licence", path),
        attribution=_required_string(raw, "attribution", path),
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
    """Load and validate a source-local adapter without a central registry."""
    adapter_path = declaration.path.parent / "acquire.py"
    if not adapter_path.is_file():
        raise SourceDeclarationError(f"{declaration.path}: missing source-local acquire.py")
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
    return result
