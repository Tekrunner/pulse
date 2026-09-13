#!/usr/bin/env python3
"""Create and safely resume a digest-backed Pulse report work record."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
from typing import Any


PHASES = (
    "questions", "source-selection", "dependencies", "real-data", "design-handoff",
    "design-approval", "infrastructure", "visual-implementation", "verification", "complete",
)
ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DIGEST = re.compile(r"^[a-f0-9]{64}$")
ARTIFACT_FIELDS = {"phase", "kind", "path", "sha256"}
CANDIDATE_FIELDS = {
    "id", "authority", "coverage", "granularity", "stability", "accessMethod", "format",
    "licence", "attribution", "cadence", "publicationSchedule", "redistributionConstraints",
}


def digest(path: Path) -> str:
    if path.is_dir():
        value = hashlib.sha256()
        for child in sorted(item for item in path.rglob("*") if item.is_file()):
            value.update(child.relative_to(path).as_posix().encode())
            value.update(b"\0")
            value.update(child.read_bytes())
            value.update(b"\0")
        return value.hexdigest()
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe_path(root: Path, value: str) -> Path:
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise ValueError("artifact path must be repository-relative")
    candidate = (root / value).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"artifact path escapes repository: {value}")
    return candidate


def exact(value: Any, fields: set[str], subject: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != fields:
        raise ValueError(f"{subject} fields are not exact")
    return value


def nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def timezone_datetime(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None and parsed.utcoffset() is not None


def validate_artifact(value: Any, subject: str) -> dict[str, Any]:
    artifact = exact(value, ARTIFACT_FIELDS, subject)
    if (
        artifact["phase"] not in PHASES
        or not nonempty(artifact["kind"])
        or not nonempty(artifact["path"])
        or not isinstance(artifact["sha256"], str)
        or not DIGEST.fullmatch(artifact["sha256"])
    ):
        raise ValueError(f"{subject} is invalid")
    return artifact


def validate_record(value: Any) -> dict[str, Any]:
    record = exact(value, {
        "schemaVersion", "reportId", "phase", "discovery", "sourceDecisions",
        "dependencies", "artifacts", "approval", "visuals", "verification", "resume",
    }, "work record")
    if record["schemaVersion"] != "1.0.0" or not isinstance(record["reportId"], str) or not ID.fullmatch(record["reportId"]) or record["phase"] not in PHASES:
        raise ValueError("work record identity or version is invalid")

    discovery = exact(record["discovery"], {
        "standingQuestions", "indicators", "context", "readingBehavior",
        "privacyExpectation", "explorationNeeded",
    }, "discovery")
    if (
        not isinstance(discovery["standingQuestions"], list)
        or not isinstance(discovery["indicators"], list)
        or not all(nonempty(item) for item in discovery["indicators"])
        or not isinstance(discovery["context"], str)
        or not isinstance(discovery["readingBehavior"], str)
        or discovery["privacyExpectation"] not in {"public", "private", "undecided"}
        or discovery["explorationNeeded"] is not None
        and not isinstance(discovery["explorationNeeded"], bool)
    ):
        raise ValueError("discovery inputs are invalid")
    question_ids: set[str] = set()
    for question in discovery["standingQuestions"]:
        exact(question, {"id", "question"}, "standing question")
        if not isinstance(question["id"], str) or not ID.fullmatch(question["id"]) or question["id"] in question_ids or not nonempty(question["question"]):
            raise ValueError("standing question is invalid or duplicated")
        question_ids.add(question["id"])
    if not isinstance(record["sourceDecisions"], list):
        raise ValueError("source decisions must be a list")
    needs: set[str] = set()
    for decision in record["sourceDecisions"]:
        exact(decision, {"need", "candidates", "selected", "rationale", "defaultProvider"}, "source decision")
        if not nonempty(decision["need"]) or decision["need"] in needs or not isinstance(decision["candidates"], list) or not isinstance(decision["rationale"], str) or decision["defaultProvider"] is not False:
            raise ValueError("source decision is invalid or duplicated")
        needs.add(decision["need"])
        candidate_ids: set[str] = set()
        for candidate in decision["candidates"]:
            exact(candidate, CANDIDATE_FIELDS, "source candidate")
            if (
                not isinstance(candidate["id"], str) or not ID.fullmatch(candidate["id"])
                or candidate["id"] in candidate_ids
                or any(not nonempty(candidate[field]) for field in CANDIDATE_FIELDS - {"id"})
            ):
                raise ValueError("source candidate is incomplete or duplicated")
            candidate_ids.add(candidate["id"])
        if decision["selected"] is not None and decision["selected"] not in candidate_ids:
            raise ValueError("selected source is not one of the evaluated candidates")

    if not isinstance(record["dependencies"], list):
        raise ValueError("dependencies must be a list")
    dependencies: set[tuple[str, str]] = set()
    for dependency in record["dependencies"]:
        exact(dependency, {"kind", "id", "skill", "artifact", "verified"}, "dependency")
        expected_skill = {"source": "pulse-add-source", "dataset": "pulse-add-dataset"}.get(dependency["kind"])
        key = (dependency["kind"], dependency["id"])
        if expected_skill is None or dependency["skill"] != expected_skill or not isinstance(dependency["id"], str) or not ID.fullmatch(dependency["id"]) or key in dependencies or not isinstance(dependency["verified"], bool):
            raise ValueError("dependency is invalid or duplicated")
        artifact = dependency["artifact"]
        if artifact is None:
            if dependency["verified"]:
                raise ValueError("a verified dependency requires an artifact")
        else:
            artifact = validate_artifact(artifact, "dependency artifact")
            expected_kind = f"{dependency['kind']}-output"
            if artifact["phase"] != "dependencies" or artifact["kind"] != expected_kind:
                raise ValueError(f"dependency artifact must be dependencies/{expected_kind}")
        dependencies.add(key)

    if not isinstance(record["artifacts"], list):
        raise ValueError("artifacts must be a list")
    for artifact in record["artifacts"]:
        validate_artifact(artifact, "workflow artifact")
    if record["approval"] is not None:
        approval = validate_artifact(record["approval"], "approval artifact")
        if approval["phase"] != "design-approval" or approval["kind"] != "human-approval":
            raise ValueError("approval must be a separate human-approval artifact")

    if not isinstance(record["visuals"], list):
        raise ValueError("visuals must be a list")
    visual_ids: set[str] = set()
    for visual in record["visuals"]:
        exact(visual, {"id", "handoffSection", "implementation", "numericEvidence", "fidelityEvidence", "verified"}, "visual gate")
        if not isinstance(visual["id"], str) or not ID.fullmatch(visual["id"]) or visual["id"] in visual_ids or not nonempty(visual["handoffSection"]) or not isinstance(visual["verified"], bool):
            raise ValueError("visual gate is invalid or duplicated")
        for field in ("implementation", "numericEvidence", "fidelityEvidence"):
            if visual[field] is not None:
                artifact = validate_artifact(visual[field], f"visual {field}")
                expected_kind = {
                    "implementation": "implementation",
                    "numericEvidence": "numeric-evidence",
                    "fidelityEvidence": "fidelity-evidence",
                }[field]
                if artifact["phase"] != "visual-implementation" or artifact["kind"] != expected_kind:
                    raise ValueError(f"visual {field} must be visual-implementation/{expected_kind}")
        paths = [visual[field]["path"] for field in ("implementation", "numericEvidence", "fidelityEvidence") if visual[field] is not None]
        if len(paths) != len(set(paths)):
            raise ValueError("visual evidence artifacts must use distinct paths")
        visual_ids.add(visual["id"])

    verification = exact(record["verification"], {"commands", "complete"}, "verification")
    if not isinstance(verification["commands"], list) or not isinstance(verification["complete"], bool):
        raise ValueError("verification is invalid")
    for command in verification["commands"]:
        exact(command, {"command", "status", "evidence"}, "verification command")
        if not nonempty(command["command"]) or command["status"] not in {"pending", "passed", "failed"}:
            raise ValueError("verification command is invalid")
        if command["evidence"] is not None:
            evidence = validate_artifact(command["evidence"], "verification evidence")
            if evidence["phase"] != "verification" or evidence["kind"] != "test-evidence":
                raise ValueError("verification evidence must be verification/test-evidence")
    resume = exact(record["resume"], {"firstIncomplete", "checkedAt"}, "resume")
    if resume["firstIncomplete"] is not None and resume["firstIncomplete"] not in PHASES[:-1]:
        raise ValueError("resume phase is invalid")
    if resume["checkedAt"] is not None and not nonempty(resume["checkedAt"]):
        raise ValueError("resume timestamp is invalid")
    return record


def load(record_path: Path) -> dict[str, Any]:
    return validate_record(json.loads(record_path.read_text(encoding="utf-8")))


def all_artifacts(record: dict[str, Any]) -> list[dict[str, Any]]:
    artifacts = list(record["artifacts"])
    artifacts.extend(item["artifact"] for item in record["dependencies"] if item["artifact"] is not None)
    if record["approval"] is not None:
        artifacts.append(record["approval"])
    for visual in record["visuals"]:
        artifacts.extend(
            visual[field]
            for field in ("implementation", "numericEvidence", "fidelityEvidence")
            if visual[field] is not None
        )
    artifacts.extend(
        item["evidence"] for item in record["verification"]["commands"]
        if item["evidence"] is not None
    )
    return artifacts


def first_invalid_artifact(record: dict[str, Any], root: Path) -> str | None:
    for artifact in all_artifacts(record):
        path = safe_path(root, artifact["path"])
        if not path.exists() or digest(path) != artifact["sha256"]:
            return artifact["phase"]
    return None


def validate_approval(record: dict[str, Any], root: Path) -> bool:
    if record["approval"] is None:
        return False
    approval_path = safe_path(root, record["approval"]["path"])
    try:
        approval = exact(json.loads(approval_path.read_text(encoding="utf-8")), {
            "schemaVersion", "reportId", "handoffSha256", "approvedBy", "approvedAt",
            "permittedChanges",
        }, "human approval")
    except (OSError, json.JSONDecodeError, ValueError):
        return False
    handoffs = [item for item in record["artifacts"] if item["phase"] == "design-handoff"]
    return (
        len(handoffs) == 1
        and approval["schemaVersion"] == "1.0.0"
        and approval["reportId"] == record["reportId"]
        and approval["handoffSha256"] == handoffs[0]["sha256"]
        and nonempty(approval["approvedBy"])
        and timezone_datetime(approval["approvedAt"])
        and isinstance(approval["permittedChanges"], list)
        and all(nonempty(item) for item in approval["permittedChanges"])
    )


def first_incomplete(record: dict[str, Any], root: Path) -> str | None:
    invalid_phase = first_invalid_artifact(record, root)
    if invalid_phase:
        return invalid_phase
    discovery = record["discovery"]
    discovery_complete = (
        bool(discovery["standingQuestions"])
        and bool(discovery["indicators"])
        and nonempty(discovery["context"])
        and nonempty(discovery["readingBehavior"])
        and discovery["privacyExpectation"] in {"public", "private"}
        and isinstance(discovery["explorationNeeded"], bool)
    )
    selections_complete = bool(record["sourceDecisions"]) and all(
        bool(item["candidates"])
        and item["selected"] is not None
        and nonempty(item["rationale"])
        and item["defaultProvider"] is False
        for item in record["sourceDecisions"]
    )
    checks = (
        ("questions", discovery_complete),
        ("source-selection", selections_complete),
        ("dependencies", all(item["verified"] for item in record["dependencies"])),
        ("real-data", any(item["phase"] == "real-data" for item in record["artifacts"])),
        ("design-handoff", sum(item["phase"] == "design-handoff" for item in record["artifacts"]) == 1),
        ("design-approval", validate_approval(record, root)),
        ("infrastructure", any(item["phase"] == "infrastructure" for item in record["artifacts"])),
        ("visual-implementation", bool(record["visuals"]) and all(item["verified"] and item["implementation"] and item["numericEvidence"] and item["fidelityEvidence"] for item in record["visuals"])),
        ("verification", record["verification"]["complete"] and bool(record["verification"]["commands"]) and all(item["status"] == "passed" and item["evidence"] for item in record["verification"]["commands"])),
    )
    for phase, complete in checks:
        if not complete:
            return phase
    return None


def initial_record(report_id: str) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0.0", "reportId": report_id, "phase": "questions",
        "discovery": {"standingQuestions": [], "indicators": [], "context": "", "readingBehavior": "", "privacyExpectation": "undecided", "explorationNeeded": None},
        "sourceDecisions": [], "dependencies": [], "artifacts": [], "approval": None,
        "visuals": [], "verification": {"commands": [], "complete": False},
        "resume": {"firstIncomplete": "questions", "checkedAt": None},
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    initialize = sub.add_parser("init")
    initialize.add_argument("record", type=Path)
    initialize.add_argument("report_id")
    status = sub.add_parser("status")
    status.add_argument("record", type=Path)
    status.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()
    try:
        if args.command == "init":
            if not ID.fullmatch(args.report_id):
                raise ValueError("report ID must be lowercase kebab-case")
            if args.record.exists():
                raise ValueError("work record already exists; resume it instead")
            value = initial_record(args.report_id)
            args.record.parent.mkdir(parents=True, exist_ok=True)
            args.record.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
            print(args.record)
            return 0
        record = load(args.record)
        root = args.root.resolve()
        phase = first_incomplete(record, root)
        record["resume"] = {"firstIncomplete": phase, "checkedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")}
        record["phase"] = phase or "complete"
        args.record.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        print(phase or "complete")
        return 0
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"report workflow failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
