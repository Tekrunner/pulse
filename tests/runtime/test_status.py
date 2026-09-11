"""Contract coverage for expected pipelines and published pipeline status.

The matrix runs over copies of the committed real publications and snapshots,
so every state, stage, precedence and deadline transition is exercised against
the same artifacts the site serves.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil

import pytest

from pulse import cli, verify
from pulse.catalog import (
    compile_expected_pipelines,
    compile_status_catalog,
    status_report,
    write_status_catalog,
)
from pulse.contracts.snapshot import ContractError
from pulse.contracts.status import (
    DATASET_STAGES,
    PUBLISHED_STATES,
    SOURCE_STAGES,
    STATE_PRECEDENCE,
    STATES,
    display_state,
    precedence_state,
    publication_deadline,
    validate_expected_pipelines,
    validate_publication_schedule,
    validate_status_catalog,
    attempt,
)
from pulse.contracts.dataset import diagnostic
from pulse.datasets import DatasetError, build_dataset, discover_datasets
from pulse.sources import SourceDeclarationError, discover_sources, load_source_declaration


ROOT = Path(__file__).parents[2]
MONTHLY = "dataset:insee-cpi-monthly"
CATEGORY = "dataset:insee-cpi-category-analysis"
SOURCE = "source:insee-cpi"
SITE = "system:site"
SCHEDULE = {"period": "monthly", "expectedByDayOfFollowingMonth": 15, "graceDays": 7}


def _archive(tmp_path: Path) -> Path:
    root = tmp_path / "snapshots"
    shutil.copytree(ROOT / "snapshots/public", root)
    return root


def _publish(tmp_path: Path) -> Path:
    root = tmp_path / "publish"
    shutil.copytree(ROOT / "publish/public", root)
    return root


def _compile(tmp_path: Path, **options: object) -> dict:
    return compile_status_catalog(
        archive_root=_archive(tmp_path), publish_root=_publish(tmp_path), **options
    )


def _rewrite_manifest(publish_root: Path, dataset_id: str, **changes: object) -> None:
    path = publish_root / "data" / dataset_id / "dataset.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest.update(changes)
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _stages(entry: dict) -> dict[str, str]:
    return {stage["stage"]: stage["state"] for stage in entry["stages"]}


def test_expected_catalog_holds_every_declared_source_and_dataset_pipeline() -> None:
    catalog = compile_expected_pipelines()

    assert set(catalog["pipelines"]) == {SOURCE, MONTHLY, CATEGORY, SITE}
    assert catalog["pipelines"][SOURCE]["kind"] == "source"
    assert catalog["pipelines"][MONTHLY]["kind"] == "dataset"
    assert catalog["pipelines"][SOURCE]["name"] == discover_sources()["insee-cpi"].name
    assert (
        catalog["pipelines"][MONTHLY]["name"] == discover_datasets()["insee-cpi-monthly"].name
    )
    assert validate_expected_pipelines(catalog) == catalog
    assert catalog["pipelines"][SITE]["kind"] == "system"


def test_public_expected_catalog_is_limited_to_explicit_dataset_closure() -> None:
    catalog = compile_expected_pipelines(dataset_ids=("insee-cpi-monthly",))

    assert set(catalog["pipelines"]) == {SOURCE, MONTHLY, SITE}


def test_committed_publication_reports_succeeded_lineage_schedule_and_usable_output(
    tmp_path: Path,
) -> None:
    catalog = _compile(tmp_path)

    assert set(catalog["pipelines"]) == {SOURCE, MONTHLY, CATEGORY, SITE}
    monthly = catalog["pipelines"][MONTHLY]
    assert _stages(monthly) == {"transform": "succeeded", "test": "succeeded", "publish-data": "succeeded"}
    assert monthly["state"] == "succeeded"
    assert monthly["representedPeriod"] == {"start": "1996-01-01", "end": "2026-07-01"}
    assert monthly["schedule"] == SCHEDULE
    assert monthly["latestUsableOutput"]["artifactKind"] == "dataset"
    assert monthly["assertions"] == []
    assert monthly["diagnostic"] is None
    assert monthly["lastAttemptAt"].endswith("Z")
    source = catalog["pipelines"][SOURCE]
    assert list(_stages(source)) == list(SOURCE_STAGES)
    assert source["latestUsableOutput"]["artifactKind"] == "snapshot"
    assert source["representedPeriod"] == {"start": "2026-08-01", "end": "2026-08-01"}
    site = catalog["pipelines"][SITE]
    assert site["state"] == "not-run"
    assert [stage["stage"] for stage in site["stages"]] == [
        "generation", "validity", "build", "deploy-site"
    ]
    # Nothing published carries a derived staleness string.
    assert all(
        entry["state"] != "stale" and all(stage["state"] != "stale" for stage in entry["stages"])
        for entry in catalog["pipelines"].values()
    )


def test_public_build_status_records_site_preparation_before_hashing(tmp_path: Path) -> None:
    timestamp = "2026-09-10T13:30:40Z"
    catalog = compile_status_catalog(
        archive_root=_archive(tmp_path),
        publish_root=_publish(tmp_path),
        generated_at=timestamp,
        site_attempted_at=timestamp,
    )

    site = catalog["pipelines"][SITE]
    assert site["state"] == "succeeded"
    assert site["lastAttemptAt"] == timestamp
    assert [stage["state"] for stage in site["stages"]] == ["succeeded"] * 4
    assert site["representedPeriod"] == {"start": "2026-09-22", "end": "2026-09-22"}
    assert site["schedule"] is None
    assert display_state(site, datetime(2026, 9, 22, tzinfo=timezone.utc)) == "succeeded"
    assert display_state(site, datetime(2026, 9, 22, 0, 0, 1, tzinfo=timezone.utc)) == "stale"


def test_first_run_is_not_run_without_a_diagnostic(tmp_path: Path) -> None:
    empty_archive = tmp_path / "snapshots"
    empty_publish = tmp_path / "publish"
    empty_archive.mkdir()
    (empty_publish / "data").mkdir(parents=True)

    catalog = compile_status_catalog(archive_root=empty_archive, publish_root=empty_publish)

    for entry in catalog["pipelines"].values():
        assert entry["state"] == "not-run"
        assert all(stage["state"] == "not-run" for stage in entry["stages"])
        assert all(stage["attemptedAt"] is None for stage in entry["stages"])
        assert entry["lastAttemptAt"] is None
        assert entry["diagnostic"] is None
        assert entry["latestUsableOutput"] is None
        assert entry["representedPeriod"] is None
    # A never-run stage stays distinguishable from a stage that succeeded.
    assert "not-run" in STATES and "not-run" not in STATE_PRECEDENCE


@pytest.mark.parametrize(
    ("columns", "expected"),
    (
        (["cpi_index", "monthly_change_pct"], ["cpi_index", "monthly_change_pct"]),
        ([], []),
    ),
)
def test_failed_assertions_are_suspect_and_keep_the_new_dataset_usable(
    tmp_path: Path, columns: list[str], expected: list[str]
) -> None:
    archive_root, publish_root = _archive(tmp_path), _publish(tmp_path)
    _rewrite_manifest(
        publish_root,
        "insee-cpi-monthly",
        status={
            "state": "suspect",
            "assertions": [{"check": "provider_monthly_change", "affected_columns": columns}],
        },
    )

    entry = compile_status_catalog(archive_root=archive_root, publish_root=publish_root)[
        "pipelines"
    ][MONTHLY]

    assert _stages(entry) == {"transform": "succeeded", "test": "suspect", "publish-data": "succeeded"}
    assert entry["state"] == "suspect"
    assert entry["assertions"] == [
        {"check": "provider_monthly_change", "affectedColumns": expected}
    ]
    # The suspect dataset is still the latest usable output.
    assert entry["latestUsableOutput"]["representedPeriod"]["end"] == "2026-07-01"
    assert entry["representedPeriod"]["end"] == "2026-07-01"


@pytest.mark.parametrize("failing", DATASET_STAGES)
def test_failed_stage_retains_the_prior_dataset_as_latest_usable(
    tmp_path: Path, failing: str
) -> None:
    archive_root, publish_root = _archive(tmp_path), _publish(tmp_path)
    (publish_root / "data/insee-cpi-monthly/diagnostic.json").write_text(
        json.dumps(
            diagnostic(
                failing,
                "candidate_rejected",
                "dataset 'insee-cpi-monthly' build failed; retained any prior usable publication",
                retryable=False,
            )
        ),
        encoding="utf-8",
    )

    entry = compile_status_catalog(archive_root=archive_root, publish_root=publish_root)[
        "pipelines"
    ][MONTHLY]

    index = DATASET_STAGES.index(failing)
    assert _stages(entry) == {
        stage: "succeeded" if position < index else "failed" if position == index else "not-run"
        for position, stage in enumerate(DATASET_STAGES)
    }
    assert entry["state"] == "failed"
    assert entry["diagnostic"]["stage"] == failing
    assert entry["diagnostic"]["retryable"] is False
    # Freshness follows the retained dataset, not the failed observation.
    assert entry["representedPeriod"]["end"] == "2026-07-01"
    assert entry["latestUsableOutput"]["representedPeriod"]["end"] == "2026-07-01"


def test_rejected_snapshot_fails_the_snapshot_stage_and_retains_the_last_valid_one(
    tmp_path: Path,
) -> None:
    archive_root = _archive(tmp_path)
    broken = next((archive_root / "insee-cpi").glob("*/snapshot.json"))
    broken.write_text('{"schema_id": "pulse.snapshot"}', encoding="utf-8")

    entry = compile_status_catalog(archive_root=archive_root, publish_root=_publish(tmp_path))[
        "pipelines"
    ][SOURCE]

    assert _stages(entry) == {"acquire": "succeeded", "snapshot": "failed"}
    assert entry["state"] == "failed"
    assert entry["diagnostic"]["stage"] == "snapshot"
    assert entry["latestUsableOutput"] is not None
    assert "schema_id" not in entry["diagnostic"]["message"]
    assert str(tmp_path) not in entry["diagnostic"]["message"]


@pytest.mark.parametrize("stage", SOURCE_STAGES)
def test_recorded_source_failure_uses_the_attempt_and_retains_usable_snapshot(
    tmp_path: Path, stage: str
) -> None:
    archive_root = _archive(tmp_path)
    source_root = archive_root / "insee-cpi"
    (source_root / "attempt.json").write_text(
        json.dumps(attempt("2026-09-09T06:17:00Z")), encoding="utf-8"
    )
    (source_root / "diagnostic.json").write_text(
        json.dumps(
            diagnostic(stage, "safe_failure", "source refresh failed safely", retryable=True)
        ),
        encoding="utf-8",
    )

    entry = compile_status_catalog(
        archive_root=archive_root, publish_root=_publish(tmp_path)
    )["pipelines"][SOURCE]

    index = SOURCE_STAGES.index(stage)
    assert _stages(entry) == {
        name: "succeeded" if position < index else "failed" if position == index else "not-run"
        for position, name in enumerate(SOURCE_STAGES)
    }
    assert entry["lastAttemptAt"] == "2026-09-09T06:17:00Z"
    assert entry["latestUsableOutput"] is not None


def test_published_diagnostics_never_leak_paths_or_upstream_text(tmp_path: Path) -> None:
    declaration = discover_datasets()["insee-cpi-monthly"]
    target = tmp_path / "publish/insee-cpi-monthly"
    archive = tmp_path / "archive"
    shutil.copytree(ROOT / "snapshots/public", archive)
    for parquet in (archive / "insee-cpi").glob("*/raw.parquet"):
        parquet.write_text("version https://git-lfs.github.com/spec/v1\n", encoding="utf-8")

    with pytest.raises(DatasetError):
        build_dataset(
            declaration, archive_root=archive, build_root=tmp_path / "build", publish_root=target
        )

    written = json.loads((target / "diagnostic.json").read_text(encoding="utf-8"))
    assert written["stage"] in DATASET_STAGES
    assert written["retryable"] is False
    assert "git-lfs" not in written["message"]
    assert str(tmp_path) not in written["message"]
    assert "Traceback" not in written["message"]
    assert json.loads((target / "attempt.json").read_text(encoding="utf-8"))["attempted_at"].endswith("Z")


def test_assertion_failures_are_attributed_to_the_test_stage(tmp_path: Path) -> None:
    error = DatasetError("candidate has invalid grain", stage="test")

    assert error.stage == "test"
    with pytest.raises(ContractError, match="canonical stage"):
        DatasetError("nowhere", stage="deploy-site")


def test_successful_publication_clears_a_previous_failure(tmp_path: Path) -> None:
    publish_root = _publish(tmp_path)
    target = publish_root / "data/insee-cpi-monthly"
    (target / "diagnostic.json").write_text(
        json.dumps(diagnostic("transform", "build_failed", "earlier failure", retryable=True)),
        encoding="utf-8",
    )
    declaration = discover_datasets()["insee-cpi-monthly"]

    build_dataset(
        declaration,
        archive_root=ROOT / "snapshots/public",
        build_root=tmp_path / "build",
        publish_root=target,
    )

    assert not (target / "diagnostic.json").exists()
    entry = compile_status_catalog(archive_root=_archive(tmp_path), publish_root=publish_root)[
        "pipelines"
    ][MONTHLY]
    assert entry["state"] == "succeeded"


@pytest.mark.parametrize(
    ("states", "expected"),
    (
        (["failed", "suspect", "succeeded"], "failed"),
        (["suspect", "stale", "succeeded"], "suspect"),
        (["stale", "succeeded"], "stale"),
        (["succeeded", "not-run"], "succeeded"),
        (["not-run", "not-run"], "not-run"),
    ),
)
def test_display_precedence_is_failed_then_suspect_then_stale_then_succeeded(
    states: list[str], expected: str
) -> None:
    assert precedence_state(states) == expected


def test_precedence_rejects_states_outside_the_canonical_vocabulary() -> None:
    with pytest.raises(ContractError, match="canonical stage states"):
        precedence_state(["degraded"])


@pytest.mark.parametrize(
    ("now", "expected"),
    (
        ("2026-09-21T23:59:59Z", "succeeded"),
        ("2026-09-22T00:00:00Z", "succeeded"),
        ("2026-09-22T00:00:01Z", "stale"),
        ("2029-01-01T00:00:00Z", "stale"),
    ),
)
def test_stale_appears_only_once_the_declared_deadline_passes(now: str, expected: str) -> None:
    entry = {
        "state": "succeeded",
        "representedPeriod": {"start": "1996-01-01", "end": "2026-07-01"},
        "schedule": SCHEDULE,
    }

    assert display_state(entry, datetime.fromisoformat(now.replace("Z", "+00:00"))) == expected
    assert publication_deadline("2026-07-01", SCHEDULE) == datetime(
        2026, 9, 22, tzinfo=timezone.utc
    )


@pytest.mark.parametrize("state", ("failed", "suspect"))
def test_a_degraded_state_outranks_an_overdue_period(state: str) -> None:
    entry = {
        "state": state,
        "representedPeriod": {"start": "2020-01-01", "end": "2020-01-01"},
        "schedule": SCHEDULE,
    }

    assert display_state(entry, datetime(2029, 1, 1, tzinfo=timezone.utc)) == state


def test_missing_schedule_or_period_can_never_be_stale() -> None:
    assert display_state({"state": "succeeded", "representedPeriod": None, "schedule": SCHEDULE}, datetime.now(timezone.utc)) == "succeeded"
    assert display_state({"state": "succeeded", "representedPeriod": {"start": "2000-01-01", "end": "2000-01-01"}, "schedule": None}, datetime.now(timezone.utc)) == "succeeded"


def test_status_artifact_rejects_a_precomputed_staleness_state(tmp_path: Path) -> None:
    catalog = _compile(tmp_path)
    catalog["pipelines"][MONTHLY]["state"] = "stale"

    assert "stale" not in PUBLISHED_STATES
    with pytest.raises(ContractError, match="non-publishable state"):
        validate_status_catalog(catalog)


def test_status_artifact_rejects_unsupported_major_and_inexact_fields(tmp_path: Path) -> None:
    compiled = _compile(tmp_path)

    catalog = deepcopy(compiled)
    catalog["schemaVersion"] = "2.0.0"
    with pytest.raises(ContractError, match="unsupported contract major"):
        validate_status_catalog(catalog)

    catalog = deepcopy(compiled)
    catalog["pipelines"][MONTHLY]["unexpected"] = True
    with pytest.raises(ContractError, match="fields are not exact"):
        validate_status_catalog(catalog)

    catalog = deepcopy(compiled)
    catalog["pipelines"][MONTHLY]["stages"].pop()
    with pytest.raises(ContractError, match="must report exactly transform, test, publish-data in order"):
        validate_status_catalog(catalog)


def test_status_entry_state_must_agree_with_stage_precedence(tmp_path: Path) -> None:
    catalog = _compile(tmp_path)
    catalog["pipelines"][MONTHLY]["stages"][1]["state"] = "suspect"

    with pytest.raises(ContractError, match="disagrees with stage display precedence"):
        validate_status_catalog(catalog)


def test_undeclared_runtime_job_fails_validation(tmp_path: Path) -> None:
    publish_root = _publish(tmp_path)
    (publish_root / "data/mystery-dataset").mkdir()
    with pytest.raises(ContractError, match="undeclared dataset pipeline 'mystery-dataset'"):
        compile_status_catalog(archive_root=_archive(tmp_path), publish_root=publish_root)

    archive_root = _archive(tmp_path / "archive")
    (archive_root / "mystery-source").mkdir()
    with pytest.raises(ContractError, match="undeclared source pipeline 'mystery-source'"):
        compile_status_catalog(archive_root=archive_root, publish_root=_publish(tmp_path / "publish"))


def test_missing_expected_entry_fails_validation(tmp_path: Path) -> None:
    catalog = _compile(tmp_path)
    expected = compile_expected_pipelines()
    del catalog["pipelines"][CATEGORY]

    with pytest.raises(ContractError, match="missing dataset:insee-cpi-category-analysis"):
        validate_status_catalog(catalog, expected)

    surplus = compile_expected_pipelines()
    surplus["pipelines"].pop(CATEGORY)
    with pytest.raises(ContractError, match="disagrees with the committed declarations"):
        _compile(tmp_path / "surplus", expected=surplus)


def test_published_dataset_may_not_publish_a_derived_or_failed_state(tmp_path: Path) -> None:
    archive_root, publish_root = _archive(tmp_path), _publish(tmp_path)
    _rewrite_manifest(publish_root, "insee-cpi-monthly", status={"state": "stale", "assertions": []})

    with pytest.raises(ContractError, match="only publish succeeded or suspect"):
        compile_status_catalog(archive_root=archive_root, publish_root=publish_root)


@pytest.mark.parametrize(
    "schedule",
    (
        None,
        {},
        {"period": "weekly", "expected_by_day_of_following_month": 15, "grace_days": 7},
        {"period": "monthly", "expected_by_day_of_following_month": 29, "grace_days": 7},
        {"period": "monthly", "expected_by_day_of_following_month": 15, "grace_days": -1},
        {"period": "monthly", "expected_by_day_of_following_month": 15},
    ),
)
def test_declared_schedule_is_validated_with_an_exact_field_set(schedule: object) -> None:
    with pytest.raises(ContractError):
        validate_publication_schedule(schedule)


def test_source_declaration_requires_a_machine_readable_schedule(tmp_path: Path) -> None:
    declaration = tmp_path / "source.yaml"
    declaration.write_text(
        "id: no-schedule\nname: No schedule\nvisibility: public\n"
        "snapshot_contract: snapshot-contract.yaml\nacquisition: {native: value}\n"
        "fetch_cadence: monthly\nexpected_publication_advance: monthly\n"
        "licence: Open\nattribution: Example\n",
        encoding="utf-8",
    )
    (tmp_path / "snapshot-contract.yaml").write_text(
        "contract_version: 1.0.0\nformat: parquet\ncompatible_additions: true\n"
        "required_fields:\n  native: string\n",
        encoding="utf-8",
    )

    with pytest.raises(SourceDeclarationError, match="publication schedule"):
        load_source_declaration(declaration)

    assert discover_sources()["insee-cpi"].publication_schedule == {
        "period": "monthly",
        "expected_by_day_of_following_month": 15,
        "grace_days": 7,
    }


def test_status_artifact_is_written_deterministically(tmp_path: Path) -> None:
    output = tmp_path / "site/status.json"
    write_status_catalog(
        output,
        archive_root=_archive(tmp_path),
        publish_root=_publish(tmp_path),
        generated_at="2026-09-09T00:00:00Z",
    )
    first = output.read_bytes()
    write_status_catalog(
        output,
        archive_root=_archive(tmp_path / "again"),
        publish_root=_publish(tmp_path / "again"),
        generated_at="2026-09-09T00:00:00Z",
    )

    assert output.read_bytes() == first
    assert validate_status_catalog(json.loads(first.decode()))


def test_cli_status_prints_every_expected_pipeline(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert (
        cli.main(
            [
                "status",
                "--archive-root",
                str(_archive(tmp_path)),
                "--publish-root",
                str(_publish(tmp_path)),
            ]
        )
        == 0
    )

    output = capsys.readouterr().out
    for pipeline_id in (SOURCE, MONTHLY, CATEGORY):
        assert pipeline_id in output
    assert "succeeded" in output


def test_cli_status_reports_a_contract_failure_with_exit_code_one(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    publish_root = _publish(tmp_path)
    (publish_root / "data/mystery-dataset").mkdir()

    assert (
        cli.main(
            ["status", "--archive-root", str(_archive(tmp_path)), "--publish-root", str(publish_root)]
        )
        == 1
    )
    assert "pulse status failed" in capsys.readouterr().err


def test_status_report_resolves_staleness_against_the_given_clock(tmp_path: Path) -> None:
    catalog = _compile(tmp_path)

    fresh = status_report(catalog, datetime(2026, 9, 9, tzinfo=timezone.utc))
    overdue = status_report(catalog, datetime(2029, 1, 1, tzinfo=timezone.utc))

    assert all("succeeded" in line for line in fresh if SITE not in line)
    assert any(line.startswith(SITE) and "not-run" in line for line in fresh)
    assert all("stale" in line for line in overdue if SITE not in line)
    assert any(line.startswith(SITE) and "not-run" in line for line in overdue)


def test_verify_registers_the_status_contract_stage() -> None:
    assert verify._status_smoke in verify.SMOKE_STAGES
    assert verify.SMOKE_STAGES.index(verify._status_smoke) == 0


def test_verify_status_stage_is_actionable_when_the_contract_breaks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "pulse.catalog.compile_status_catalog",
        lambda **_options: (_ for _ in ()).throw(ContractError("undeclared source pipeline 'ghost'")),
    )

    with pytest.raises(verify.VerificationError, match="rejected the committed pipelines"):
        verify._status_smoke()
