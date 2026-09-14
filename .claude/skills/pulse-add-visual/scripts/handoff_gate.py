#!/usr/bin/env python3
"""Validate and lock a complete external visual-design handoff."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "1.0.0"
REQUIRED_STATES = {
    "ready",
    "loading",
    "empty",
    "suspect",
    "stale",
    "query-error",
    "schema-incompatibility",
    "render-error",
    "shared-engine-failure",
}
REQUIRED_VIEWS = {"desktop", "narrow-smartphone-landscape", "400%-zoom-reflow"}
FILE_GROUPS = (
    "prototype",
    "decisions",
    "contracts",
    "fixtures",
    "rationale",
    "assets",
    "design_only_support",
)
KEBAB_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class HandoffError(ValueError):
    pass


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise HandoffError(f"cannot read JSON {path}: {error}") from error
    if not isinstance(value, dict):
        raise HandoffError(f"{path} must contain a JSON object")
    return value


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _canonical_digest(manifest: dict[str, Any]) -> str:
    return _digest(json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode())


def inspect_handoff(root: Path, manifest_path: Path) -> dict[str, Any]:
    root = root.resolve()
    manifest = _load_json(manifest_path)
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise HandoffError("unsupported handoff schema_version")
    report_id = manifest.get("report_id")
    visual_ids = manifest.get("visual_ids")
    if not isinstance(report_id, str) or not KEBAB_ID.fullmatch(report_id):
        raise HandoffError("report_id must be lowercase kebab-case")
    if not isinstance(visual_ids, list) or len(visual_ids) < 3 or len(set(visual_ids)) != len(visual_ids):
        raise HandoffError("at least three distinct visual_ids are required")
    if any(not isinstance(item, str) or not KEBAB_ID.fullmatch(item) for item in visual_ids):
        raise HandoffError("visual_ids must be lowercase kebab-case")
    if not REQUIRED_STATES.issubset(set(manifest.get("states", []))):
        raise HandoffError("handoff does not cover every required state")
    if not REQUIRED_VIEWS.issubset(set(manifest.get("views", []))):
        raise HandoffError("handoff does not cover desktop, narrow, and zoom/reflow views")
    if not isinstance(manifest.get("remote_assets"), list):
        raise HandoffError("remote_assets must be an explicit list")

    digests: dict[str, str] = {}
    declared_paths: set[str] = set()
    for group in FILE_GROUPS:
        values = manifest.get(group)
        if not isinstance(values, list):
            raise HandoffError(f"{group} must be a list")
        if group in {"prototype", "decisions", "contracts", "fixtures", "rationale"} and not values:
            raise HandoffError(f"{group} must not be empty")
        if group == "contracts" and len(values) < len(visual_ids):
            raise HandoffError("each visual_id needs a contract")
        for relative in values:
            if not isinstance(relative, str) or not relative or "__" in relative:
                raise HandoffError(f"{group} contains an unresolved path")
            if relative in declared_paths:
                raise HandoffError(f"handoff path is declared more than once: {relative}")
            declared_paths.add(relative)
            candidate = (root / relative).resolve()
            if candidate != root and root not in candidate.parents:
                raise HandoffError(f"handoff path escapes root: {relative}")
            if not candidate.is_file():
                raise HandoffError(f"handoff file is missing: {relative}")
            digests[relative] = _digest(candidate.read_bytes())

    expected_contracts = {f"{visual_id}.contract.js" for visual_id in visual_ids}
    declared_contracts = {Path(relative).name for relative in manifest["contracts"]}
    if declared_contracts != expected_contracts:
        raise HandoffError("each visual_id must have exactly one matching <visual-id>.contract.js")

    return {
        "schema_version": SCHEMA_VERSION,
        "report_id": report_id,
        "visual_ids": visual_ids,
        "manifest_digest": _canonical_digest(manifest),
        "file_digests": dict(sorted(digests.items())),
        "status": "complete-unapproved",
    }


def approve_handoff(
    root: Path,
    manifest_path: Path,
    approval_path: Path,
    approved_by: str,
    permitted_changes: list[str],
) -> dict[str, Any]:
    if not approved_by.strip() or "__" in approved_by:
        raise HandoffError("approved_by must identify the human approver")
    if any(not change.strip() or "__" in change for change in permitted_changes):
        raise HandoffError("permitted changes must be concrete non-empty entries")
    if len(set(permitted_changes)) != len(permitted_changes):
        raise HandoffError("permitted changes must not contain duplicates")
    if approval_path.exists():
        raise HandoffError("approval record already exists; never overwrite a locked approval")
    receipt = inspect_handoff(root, manifest_path)
    approval = {
        **receipt,
        "status": "approved",
        "approved_by": approved_by,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "permitted_changes": permitted_changes,
    }
    approval["approval_digest"] = _canonical_digest(approval)
    approval_path.write_text(json.dumps(approval, indent=2) + "\n", encoding="utf-8")
    return approval


def verify_approval(root: Path, manifest_path: Path, approval_path: Path) -> dict[str, Any]:
    current = inspect_handoff(root, manifest_path)
    approval = _load_json(approval_path)
    if approval.get("status") != "approved" or not approval.get("approved_by"):
        raise HandoffError("human approval is absent")
    approval_decision = {key: value for key, value in approval.items() if key != "approval_digest"}
    if approval.get("approval_digest") != _canonical_digest(approval_decision):
        raise HandoffError("human approval decision changed")
    for field in ("schema_version", "report_id", "visual_ids", "manifest_digest", "file_digests"):
        if approval.get(field) != current.get(field):
            raise HandoffError(f"approved handoff changed: {field}")
    return {
        **current,
        "status": "approved-locked",
        "approved_by": approval["approved_by"],
        "approval_digest": approval["approval_digest"],
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("inspect", "approve", "verify"):
        item = subparsers.add_parser(command)
        item.add_argument("--root", required=True, type=Path)
        item.add_argument("--manifest", required=True, type=Path)
        if command in {"approve", "verify"}:
            item.add_argument("--approval", required=True, type=Path)
        if command == "approve":
            item.add_argument("--approved-by", required=True)
            item.add_argument("--permit", action="append", default=[])
    return parser


def main() -> int:
    arguments = _parser().parse_args()
    try:
        if arguments.command == "inspect":
            result = inspect_handoff(arguments.root, arguments.manifest)
        elif arguments.command == "approve":
            result = approve_handoff(
                arguments.root,
                arguments.manifest,
                arguments.approval,
                arguments.approved_by,
                arguments.permit,
            )
        else:
            result = verify_approval(arguments.root, arguments.manifest, arguments.approval)
    except HandoffError as error:
        print(f"handoff gate failed: {error}")
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
