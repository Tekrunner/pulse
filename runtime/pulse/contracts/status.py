"""Strict contracts for expected pipelines, published status, and attempts.

This module owns the canonical vocabulary every other component reads: the
pipeline kinds, their stages, the five states, and the display precedence. It
deliberately owns no staleness *string*: `stale` is derived from a declared
publication schedule against the reader's clock, so a frozen artifact served
long after its build still reports overdue data. The published artifact may
therefore only carry states in `PUBLISHED_STATES`.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import re
from typing import Any

from pulse.contracts.snapshot import ContractError, utc_timestamp


EXPECTED_PIPELINES_SCHEMA_ID = "pulse.expected-pipelines"
EXPECTED_PIPELINES_SCHEMA_VERSION = "1.0.0"
STATUS_SCHEMA_ID = "pulse.status"
STATUS_SCHEMA_VERSION = "1.0.0"
ATTEMPT_SCHEMA_ID = "pulse.attempt"
ATTEMPT_SCHEMA_VERSION = "1.0.0"

SOURCE_STAGES = ("acquire", "snapshot")
DATASET_STAGES = ("transform", "test", "publish-data")
CANONICAL_STAGES = SOURCE_STAGES + DATASET_STAGES
# The repository writer is part of publication, not a user-facing pipeline, so
# `publish-data` is the last stage anyone sees. There is no site pipeline.
PIPELINE_STAGES = {"source": SOURCE_STAGES, "dataset": DATASET_STAGES}
PIPELINE_KINDS = tuple(PIPELINE_STAGES)

STATES = ("not-run", "succeeded", "suspect", "stale", "failed")
# Display precedence. `not-run` is absent on purpose: it describes a pipeline
# before any attempt rather than an outcome competing with an observed one.
STATE_PRECEDENCE = ("failed", "suspect", "stale", "succeeded")
PUBLISHED_STATES = ("not-run", "succeeded", "suspect", "failed")

SCHEDULE_PERIODS = ("monthly",)
_DECLARED_SCHEDULE_FIELDS = {"period", "expected_by_day_of_following_month", "grace_days"}
_BROWSER_SCHEDULE_FIELDS = {"period", "expectedByDayOfFollowingMonth", "graceDays"}
_PIPELINE_ID = re.compile(r"^(source|dataset):[a-z0-9][a-z0-9-]*$")
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def precedence_state(states: object) -> str:
    """Reduce stage states to one displayed pipeline state."""
    observed = list(states) if not isinstance(states, str) else [states]
    unknown = [state for state in observed if state not in STATES]
    if not observed or unknown:
        raise ContractError("pipeline state precedence requires canonical stage states")
    for state in STATE_PRECEDENCE:
        if state in observed:
            return state
    return "not-run"


def _positive_integer(value: object, field: str, *, low: int, high: int) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not low <= value <= high:
        raise ContractError(f"publication schedule {field} must be an integer between {low} and {high}")
    return value


def validate_publication_schedule(value: Any) -> dict[str, Any]:
    """Validate the declared, machine-readable schedule with an exact field set."""
    if not isinstance(value, dict) or set(value) != _DECLARED_SCHEDULE_FIELDS:
        raise ContractError("publication schedule fields are not exact")
    if value["period"] not in SCHEDULE_PERIODS:
        raise ContractError("publication schedule period is unsupported")
    # Days above 28 are not expressible in every month, so a deadline built from
    # them would silently move. Reject them instead of clamping.
    _positive_integer(value["expected_by_day_of_following_month"], "expected_by_day_of_following_month", low=1, high=28)
    _positive_integer(value["grace_days"], "grace_days", low=0, high=60)
    return value


def browser_schedule(declared: dict[str, Any]) -> dict[str, Any]:
    """Project a declared schedule into the browser-facing camelCase contract."""
    validate_publication_schedule(declared)
    return {
        "period": declared["period"],
        "expectedByDayOfFollowingMonth": declared["expected_by_day_of_following_month"],
        "graceDays": declared["grace_days"],
    }


def validate_browser_schedule(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != _BROWSER_SCHEDULE_FIELDS:
        raise ContractError("browser publication schedule fields are not exact")
    if value["period"] not in SCHEDULE_PERIODS:
        raise ContractError("browser publication schedule period is unsupported")
    _positive_integer(value["expectedByDayOfFollowingMonth"], "expectedByDayOfFollowingMonth", low=1, high=28)
    _positive_integer(value["graceDays"], "graceDays", low=0, high=60)
    return value


def publication_deadline(represented_period_end: str, schedule: dict[str, Any]) -> datetime:
    """Return the instant after which the *next* period counts as overdue.

    The deadline derives from the represented period rather than from fetch
    time: data through July is only late once the August observation has missed
    its own declared publication day plus grace.
    """
    validate_browser_schedule(schedule)
    if not isinstance(represented_period_end, str) or not _ISO_DATE.fullmatch(represented_period_end):
        raise ContractError("publication deadline requires an ISO represented period end")
    end = date.fromisoformat(represented_period_end)
    month = end.month + 2
    year, month = end.year + (month - 1) // 12, (month - 1) % 12 + 1
    due = date(year, month, schedule["expectedByDayOfFollowingMonth"]) + timedelta(
        days=schedule["graceDays"]
    )
    return datetime(due.year, due.month, due.day, tzinfo=timezone.utc)


def is_overdue(entry: dict[str, Any], now: datetime) -> bool:
    period, schedule = entry.get("representedPeriod"), entry.get("schedule")
    if not isinstance(period, dict) or not isinstance(schedule, dict):
        return False
    return now > publication_deadline(period["end"], schedule)


def display_state(entry: dict[str, Any], now: datetime) -> str:
    """Resolve the state a reader sees, deriving `stale` from the clock."""
    state = entry["state"]
    if state in {"failed", "suspect", "not-run"}:
        return state
    return "stale" if is_overdue(entry, now) else state


def expected_pipeline_id(kind: str, declared_id: str) -> str:
    if kind not in PIPELINE_KINDS:
        raise ContractError(f"unknown pipeline kind '{kind}'")
    pipeline_id = f"{kind}:{declared_id}"
    if not _PIPELINE_ID.fullmatch(pipeline_id):
        raise ContractError(f"pipeline identity '{pipeline_id}' is not lowercase kebab-case")
    return pipeline_id


def validate_expected_pipelines(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {"schemaId", "schemaVersion", "pipelines"}:
        raise ContractError("expected-pipeline catalog fields are not exact")
    if value["schemaId"] != EXPECTED_PIPELINES_SCHEMA_ID or not str(value["schemaVersion"]).startswith("1."):
        raise ContractError("expected-pipeline catalog has unsupported contract major")
    pipelines = value["pipelines"]
    if not isinstance(pipelines, dict) or not pipelines:
        raise ContractError("expected-pipeline catalog must declare at least one pipeline")
    for pipeline_id, entry in pipelines.items():
        if not isinstance(entry, dict) or set(entry) != {"pipelineId", "kind", "name"}:
            raise ContractError(f"expected pipeline '{pipeline_id}' fields are not exact")
        if entry["pipelineId"] != pipeline_id or not _PIPELINE_ID.fullmatch(str(pipeline_id)):
            raise ContractError(f"expected pipeline '{pipeline_id}' identity is invalid")
        if entry["kind"] not in PIPELINE_KINDS or not pipeline_id.startswith(entry["kind"] + ":"):
            raise ContractError(f"expected pipeline '{pipeline_id}' kind disagrees with its identity")
        if not isinstance(entry["name"], str) or not entry["name"].strip():
            raise ContractError(f"expected pipeline '{pipeline_id}' must carry a display name")
    return value


def attempt(attempted_at: str) -> dict[str, Any]:
    value = {
        "schema_id": ATTEMPT_SCHEMA_ID,
        "schema_version": ATTEMPT_SCHEMA_VERSION,
        "attempted_at": attempted_at,
    }
    return validate_attempt(value)


def validate_attempt(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {"schema_id", "schema_version", "attempted_at"}:
        raise ContractError("pipeline attempt fields are not exact")
    if value["schema_id"] != ATTEMPT_SCHEMA_ID or not str(value["schema_version"]).startswith("1."):
        raise ContractError("pipeline attempt has unsupported contract version")
    if not isinstance(value["attempted_at"], str):
        raise ContractError("pipeline attempt attempted_at must be a UTC timestamp")
    utc_timestamp(value["attempted_at"], "attempted_at")
    return value


def _validate_period(value: Any, field: str) -> None:
    if value is None:
        return
    if not isinstance(value, dict) or set(value) != {"start", "end"}:
        raise ContractError(f"{field} must be null or a start/end period")
    for key in ("start", "end"):
        if not isinstance(value[key], str) or not _ISO_DATE.fullmatch(value[key]):
            raise ContractError(f"{field} {key} must be an ISO calendar date")
    if value["start"] > value["end"]:
        raise ContractError(f"{field} start must not follow its end")


def _validate_latest_usable(value: Any) -> None:
    if value is None:
        return
    if not isinstance(value, dict) or set(value) != {"artifactKind", "identity", "representedPeriod"}:
        raise ContractError("latest usable output fields are not exact")
    if value["artifactKind"] not in {"snapshot", "dataset"}:
        raise ContractError("latest usable output artifact kind is invalid")
    if not isinstance(value["identity"], str) or not value["identity"].strip():
        raise ContractError("latest usable output must carry an artifact identity")
    _validate_period(value["representedPeriod"], "latest usable output representedPeriod")


def _validate_assertions(value: Any) -> None:
    if not isinstance(value, list):
        raise ContractError("pipeline assertions must be a list")
    for item in value:
        if not isinstance(item, dict) or set(item) != {"check", "affectedColumns"}:
            raise ContractError("pipeline assertion fields are not exact")
        if not isinstance(item["check"], str) or not item["check"].strip():
            raise ContractError("pipeline assertion must name its check")
        columns = item["affectedColumns"]
        # An empty list is meaningful: the assertion fired without column
        # precision, and readers must say the impact is unknown.
        if not isinstance(columns, list) or not all(
            isinstance(name, str) and name.strip() for name in columns
        ):
            raise ContractError("pipeline assertion affected columns are invalid")


def _validate_diagnostic_slot(value: Any, stages: tuple[str, ...], field: str) -> None:
    if value is None:
        return
    # Deferred so the diagnostic contract can own the canonical stage names
    # from here without the two contract modules importing each other eagerly.
    from pulse.contracts.dataset import validate_diagnostic

    validate_diagnostic(value)
    if value["stage"] not in stages:
        raise ContractError(f"{field} names a stage outside this pipeline kind")


def validate_status_catalog(value: Any, expected: dict[str, Any] | None = None) -> dict[str, Any]:
    """Validate a published status artifact with the exact-field-set pattern."""
    if not isinstance(value, dict) or set(value) != {
        "schemaId",
        "schemaVersion",
        "generatedAt",
        "pipelines",
    }:
        raise ContractError("status catalog fields are not exact")
    if value["schemaId"] != STATUS_SCHEMA_ID or not str(value["schemaVersion"]).startswith("1."):
        raise ContractError("status catalog has unsupported contract major")
    if not isinstance(value["generatedAt"], str):
        raise ContractError("status catalog generatedAt must be a UTC timestamp")
    utc_timestamp(value["generatedAt"], "generatedAt")
    pipelines = value["pipelines"]
    if not isinstance(pipelines, dict) or not pipelines:
        raise ContractError("status catalog must report at least one pipeline")
    for pipeline_id, entry in pipelines.items():
        _validate_status_entry(pipeline_id, entry)
    if expected is not None:
        validate_expected_pipelines(expected)
        if set(pipelines) != set(expected["pipelines"]):
            missing = sorted(set(expected["pipelines"]) - set(pipelines))
            undeclared = sorted(set(pipelines) - set(expected["pipelines"]))
            raise ContractError(
                "status catalog disagrees with the expected-pipeline catalog: "
                + "; ".join(
                    part
                    for part in (
                        "missing " + ", ".join(missing) if missing else "",
                        "undeclared " + ", ".join(undeclared) if undeclared else "",
                    )
                    if part
                )
            )
        for pipeline_id, declared in expected["pipelines"].items():
            entry = pipelines[pipeline_id]
            if entry["kind"] != declared["kind"] or entry["name"] != declared["name"]:
                raise ContractError(
                    f"status entry '{pipeline_id}' disagrees with its expected declaration"
                )
    return value


def _validate_status_entry(pipeline_id: object, entry: Any) -> None:
    fields = {
        "pipelineId",
        "kind",
        "name",
        "stages",
        "state",
        "lastAttemptAt",
        "representedPeriod",
        "schedule",
        "latestUsableOutput",
        "assertions",
        "diagnostic",
    }
    if not isinstance(entry, dict) or set(entry) != fields:
        raise ContractError(f"status entry '{pipeline_id}' fields are not exact")
    if entry["pipelineId"] != pipeline_id or not _PIPELINE_ID.fullmatch(str(pipeline_id)):
        raise ContractError(f"status entry '{pipeline_id}' identity is invalid")
    kind = entry["kind"]
    if kind not in PIPELINE_KINDS or not str(pipeline_id).startswith(kind + ":"):
        raise ContractError(f"status entry '{pipeline_id}' kind disagrees with its identity")
    if not isinstance(entry["name"], str) or not entry["name"].strip():
        raise ContractError(f"status entry '{pipeline_id}' must carry a display name")
    stages = entry["stages"]
    expected_stages = PIPELINE_STAGES[kind]
    if not isinstance(stages, list) or [item.get("stage") if isinstance(item, dict) else None for item in stages] != list(expected_stages):
        raise ContractError(
            f"status entry '{pipeline_id}' must report exactly {', '.join(expected_stages)} in order"
        )
    for stage in stages:
        if set(stage) != {"stage", "state", "attemptedAt", "diagnostic"}:
            raise ContractError(f"status stage fields are not exact in '{pipeline_id}'")
        if stage["state"] not in PUBLISHED_STATES:
            raise ContractError(
                f"status stage '{stage['stage']}' in '{pipeline_id}' carries a non-publishable state"
            )
        if stage["attemptedAt"] is not None:
            if not isinstance(stage["attemptedAt"], str):
                raise ContractError("status stage attemptedAt must be null or a UTC timestamp")
            utc_timestamp(stage["attemptedAt"], "attemptedAt")
        if stage["state"] == "not-run" and stage["attemptedAt"] is not None:
            raise ContractError("a never-run stage must not claim an attempt")
        _validate_diagnostic_slot(stage["diagnostic"], (stage["stage"],), "status stage diagnostic")
    if entry["state"] not in PUBLISHED_STATES:
        raise ContractError(f"status entry '{pipeline_id}' carries a non-publishable state")
    if entry["state"] != precedence_state([stage["state"] for stage in stages]):
        raise ContractError(
            f"status entry '{pipeline_id}' state disagrees with stage display precedence"
        )
    if entry["lastAttemptAt"] is not None:
        if not isinstance(entry["lastAttemptAt"], str):
            raise ContractError("status entry lastAttemptAt must be null or a UTC timestamp")
        utc_timestamp(entry["lastAttemptAt"], "lastAttemptAt")
    if entry["state"] == "not-run" and entry["lastAttemptAt"] is not None:
        raise ContractError(f"status entry '{pipeline_id}' claims an attempt it never made")
    _validate_period(entry["representedPeriod"], f"status entry '{pipeline_id}' representedPeriod")
    if entry["schedule"] is not None:
        validate_browser_schedule(entry["schedule"])
    _validate_latest_usable(entry["latestUsableOutput"])
    _validate_assertions(entry["assertions"])
    _validate_diagnostic_slot(entry["diagnostic"], PIPELINE_STAGES[kind], "status entry diagnostic")
