"""Focused behavior tests for the repository-local verification API."""

from __future__ import annotations

from pathlib import Path
import subprocess

import pytest

from pulse import cli, verify


def test_registered_smoke_stages_run_in_order(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(verify, "SMOKE_STAGES", (lambda: calls.append("python"), lambda: calls.append("node")))

    verify.verify_workspace()

    assert calls == ["python", "node"]


def test_repository_profile_omits_the_frontend_suite(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(
        verify,
        "REPOSITORY_STAGES",
        (lambda: calls.append("contracts"), lambda: calls.append("python")),
    )

    verify.verify_repository()

    assert calls == ["contracts", "python"]


def test_skill_mirror_gate_precedes_full_language_suites() -> None:
    assert verify.SMOKE_STAGES.index(verify._skill_mirror_smoke) < verify.SMOKE_STAGES.index(
        verify._python_smoke
    )
    assert verify.SMOKE_STAGES.index(verify._skill_mirror_smoke) < verify.SMOKE_STAGES.index(
        verify._node_smoke
    )


@pytest.mark.parametrize(
    ("failure", "expected"),
    (
        (FileNotFoundError("missing"), "cannot start"),
        (OSError("permission denied"), "cannot start"),
        (subprocess.TimeoutExpired(["tool"], 60), "timed out"),
    ),
)
def test_subprocess_start_failures_are_actionable(
    monkeypatch: pytest.MonkeyPatch, failure: BaseException, expected: str
) -> None:
    def fail(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        raise failure

    monkeypatch.setattr(verify.subprocess, "run", fail)

    with pytest.raises(verify.VerificationError, match=expected):
        verify._run("fixture stage", ["tool"])


def test_both_full_suites_run_on_the_longer_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    """Both suites grow with the repository, not with the machine.

    The Python suite rebuilds every dataset package and the frontend suite
    runs every browser specification in two engines, so a budget sized for the
    short stages is outgrown as soon as datasets or reports are added, and the
    resulting failure reads as a broken toolchain.
    """
    observed: list[tuple[str, int]] = []

    def record(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        observed.append((command[-1], int(kwargs["timeout"])))
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(verify.subprocess, "run", record)
    verify._python_smoke()
    verify._run("status contract", ["tool", "status"])

    assert observed == [
        ("-q", verify.SUITE_TIMEOUT_SECONDS),
        ("status", verify.SUBPROCESS_TIMEOUT_SECONDS),
    ]
    assert verify.SUITE_TIMEOUT_SECONDS > verify.SUBPROCESS_TIMEOUT_SECONDS


def test_nonzero_subprocess_is_actionable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        verify.subprocess,
        "run",
        lambda *_args, **_kwargs: subprocess.CompletedProcess(["tool"], 7),
    )

    with pytest.raises(verify.VerificationError, match="fixture stage.*exited 7"):
        verify._run("fixture stage", ["tool"])


@pytest.mark.parametrize(
    ("failure", "expected"),
    (
        (subprocess.TimeoutExpired(["node", "--version"], 60), "timed out probing Node"),
        (OSError("permission denied"), "cannot run Node"),
    ),
)
def test_version_probe_failures_are_actionable(
    monkeypatch: pytest.MonkeyPatch, failure: BaseException, expected: str
) -> None:
    def fail(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        raise failure

    monkeypatch.setattr(verify.subprocess, "run", fail)

    with pytest.raises(verify.VerificationError, match=expected):
        verify._probe("Node", ["node", "--version"])


def test_nonzero_version_probe_is_actionable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        verify.subprocess,
        "run",
        lambda *_args, **_kwargs: subprocess.CompletedProcess(["node", "--version"], 2),
    )

    with pytest.raises(verify.VerificationError, match="could not determine Node"):
        verify._probe("Node", ["node", "--version"])


def test_cli_reports_verification_failure_with_exit_code_one(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    def fail() -> None:
        raise verify.VerificationError("stage 'node smoke' timed out")

    monkeypatch.setattr(cli, "verify_workspace", fail)

    assert cli.main(["verify"]) == 1
    assert "pulse verify failed: stage 'node smoke' timed out" in capsys.readouterr().err


def test_cli_routes_repository_only_verification(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(cli, "verify_repository", lambda: calls.append("repository"))
    monkeypatch.setattr(cli, "verify_workspace", lambda: calls.append("workspace"))

    assert cli.main(["verify", "--repository-only"]) == 0
    assert calls == ["repository"]


@pytest.mark.parametrize("action", ("build", "serve"))
def test_cli_routes_site_commands_through_one_api(monkeypatch: pytest.MonkeyPatch, action: str) -> None:
    calls: list[str] = []
    monkeypatch.setattr(cli, "run_site", calls.append)

    assert cli.main(["site", action]) == 0
    assert calls == [action]


def test_incompatible_python_is_rejected_before_running_stage(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(verify.sys, "version_info", (3, 12))
    monkeypatch.setattr(verify, "_run", lambda *_args: pytest.fail("stage must not run"))

    with pytest.raises(verify.VerificationError, match="requires CPython 3.13"):
        verify._python_smoke()


def test_non_cpython_is_rejected_before_running_stage(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(verify.platform, "python_implementation", lambda: "PyPy")
    monkeypatch.setattr(verify, "_run", lambda *_args: pytest.fail("stage must not run"))

    with pytest.raises(verify.VerificationError, match="requires CPython 3.13"):
        verify._python_smoke()


def test_incompatible_node_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(verify.shutil, "which", lambda name: f"/tool/bin/{name}")
    monkeypatch.setattr(verify, "_probe", lambda name, _command: "v22.0.0" if name == "Node" else "11.0.0")
    monkeypatch.setattr(verify, "_run", lambda *_args: pytest.fail("stage must not run"))

    with pytest.raises(verify.VerificationError, match="requires Node 24"):
        verify._node_smoke()


def test_incompatible_npm_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(verify.shutil, "which", lambda name: f"/tool/bin/{name}")
    monkeypatch.setattr(verify, "_probe", lambda name, _command: "v24.0.0" if name == "Node" else "10.0.0")
    monkeypatch.setattr(verify, "_run", lambda *_args: pytest.fail("stage must not run"))

    with pytest.raises(verify.VerificationError, match="requires npm 11"):
        verify._node_smoke()


def test_node_smoke_runs_the_explicit_frontend_suite(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, list[str], int]] = []
    monkeypatch.setattr(verify.shutil, "which", lambda name: f"/tool/bin/{name}")
    monkeypatch.setattr(
        verify,
        "_probe",
        lambda name, _command: "v24.0.0" if name == "Node" else "11.0.0",
    )
    monkeypatch.setattr(
        verify,
        "_run",
        lambda name, command, **kwargs: calls.append((name, command, int(kwargs["timeout"]))),
    )

    verify._node_smoke()

    assert calls == [
        ("node smoke", ["/tool/bin/npm", "run", "verify:frontend"], verify.SUITE_TIMEOUT_SECONDS)
    ]


def test_skill_mirror_smoke_uses_project_interpreter(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, list[str]]] = []
    monkeypatch.setattr(verify, "_run", lambda name, command: calls.append((name, command)))

    verify._skill_mirror_smoke()

    assert calls == [
        (
            "skill mirrors",
            [verify.sys.executable, str(verify.ROOT / "scripts" / "sync_agent_skills.py"), "--check"],
        )
    ]


def test_mismatched_node_and_npm_installations_are_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(verify.shutil, "which", lambda name: f"/{name}-installation/bin/{name}")

    with pytest.raises(verify.VerificationError, match="different installations"):
        verify._node_smoke()


def test_missing_npm_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(verify.shutil, "which", lambda _name: None)

    with pytest.raises(verify.VerificationError, match="requires Node 24/npm 11"):
        verify._node_smoke()
