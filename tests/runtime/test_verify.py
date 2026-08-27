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


def test_mismatched_node_and_npm_installations_are_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(verify.shutil, "which", lambda name: f"/{name}-installation/bin/{name}")

    with pytest.raises(verify.VerificationError, match="different installations"):
        verify._node_smoke()


def test_missing_npm_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(verify.shutil, "which", lambda _name: None)

    with pytest.raises(verify.VerificationError, match="requires Node 24/npm 11"):
        verify._node_smoke()
