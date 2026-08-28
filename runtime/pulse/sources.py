"""Discovery and validation of source-local declarations."""

from __future__ import annotations

from dataclasses import dataclass
import importlib.util
from pathlib import Path
import re
import sys
from typing import Any
from types import ModuleType

import yaml


ROOT = Path(__file__).resolve().parents[2]
_SOURCE_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class SourceDeclarationError(ValueError):
    """A source declaration cannot participate in a Pulse run."""


@dataclass(frozen=True)
class SourceDeclaration:
    source_id: str
    name: str
    visibility: str
    acquisition: dict[str, Any]
    cadence: str
    expected_publication_advance: str
    licence: str
    attribution: str
    selected_series: list[dict[str, str]]
    path: Path


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
    acquisition = raw.get("acquisition")
    urls = acquisition.get("urls") if isinstance(acquisition, dict) else None
    if not isinstance(acquisition, dict) or not isinstance(acquisition.get("method"), str) or not acquisition["method"] or not isinstance(urls, list) or not urls or not all(isinstance(url, str) and url.startswith("https://") for url in urls):
        raise SourceDeclarationError(f"{path}: acquisition requires method and HTTPS urls")
    if "token" in str(acquisition).lower() or "password" in str(acquisition).lower():
        raise SourceDeclarationError(f"{path}: credentials are forbidden in declarations")
    series = raw.get("selected_series")
    if not isinstance(series, list) or not series or not all(isinstance(item, dict) and isinstance(item.get("id"), str) and isinstance(item.get("name"), str) for item in series):
        raise SourceDeclarationError(f"{path}: selected_series must name one or more catalogue series")
    return SourceDeclaration(
        source_id=source_id, name=_required_string(raw, "name", path), visibility=raw["visibility"],
        acquisition=acquisition, cadence=_required_string(raw, "fetch_cadence", path),
        expected_publication_advance=_required_string(raw, "expected_publication_advance", path),
        licence=_required_string(raw, "licence", path), attribution=_required_string(raw, "attribution", path),
        selected_series=series, path=path,
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
    """Load a source-local adapter without requiring its kebab-case directory to import."""
    adapter_path = declaration.path.parent / "acquire.py"
    if not adapter_path.is_file():
        raise SourceDeclarationError(f"{declaration.path}: missing source-local acquire.py")
    module_name = f"pulse_source_{declaration.source_id.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(module_name, adapter_path)
    if spec is None or spec.loader is None:
        raise SourceDeclarationError(f"{adapter_path}: could not load source adapter")
    module = importlib.util.module_from_spec(spec)
    # Some adapters (including dlt resources) introspect their defining module
    # while decorators run, so it must be visible during execution.
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception as error:
        sys.modules.pop(module_name, None)
        raise SourceDeclarationError(f"{adapter_path}: source adapter could not load") from error
    return module
