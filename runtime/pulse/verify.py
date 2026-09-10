"""Staged workspace verification used identically by developers and CI."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
import platform
import shutil
import subprocess
import sys


class VerificationError(RuntimeError):
    """A stage failed with an actionable diagnostic."""


ROOT = Path(__file__).resolve().parents[2]
# Dataset conformance exercises two dbt builds over the full public snapshot;
# allow the reproducible suite to complete on slower CI and Firefox hosts.
SUBPROCESS_TIMEOUT_SECONDS = 600


def _run(name: str, command: list[str]) -> None:
    print(f"[{name}] {' '.join(command)}", flush=True)
    try:
        completed = subprocess.run(
            command, cwd=ROOT, text=True, check=False, timeout=SUBPROCESS_TIMEOUT_SECONDS
        )
    except subprocess.TimeoutExpired as error:
        raise VerificationError(
            f"stage '{name}' timed out after {SUBPROCESS_TIMEOUT_SECONDS} seconds; "
            "inspect the command or its prerequisites."
        ) from error
    except OSError as error:
        raise VerificationError(
            f"stage '{name}' cannot start because '{command[0]}' is unavailable or unusable: {error}; "
            "run the documented frozen installation first."
        ) from error
    if completed.returncode:
        raise VerificationError(f"stage '{name}' exited {completed.returncode}; inspect its output above.")


def _probe(name: str, command: list[str]) -> str:
    try:
        completed = subprocess.run(
            command,
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as error:
        raise VerificationError(
            f"stage 'node smoke' timed out probing {name} after {SUBPROCESS_TIMEOUT_SECONDS} seconds; "
            "reinstall the documented Node 24 toolchain."
        ) from error
    except OSError as error:
        raise VerificationError(
            f"stage 'node smoke' cannot run {name} at '{command[0]}': {error}; "
            "reinstall the documented Node 24 toolchain."
        ) from error
    if completed.returncode:
        raise VerificationError(
            f"stage 'node smoke' could not determine {name} (exit {completed.returncode}); "
            "reinstall the documented Node 24 toolchain."
        )
    return completed.stdout.strip()


def _python_smoke() -> None:
    if platform.python_implementation() != "CPython" or sys.version_info[:2] != (3, 13):
        raise VerificationError(
            "stage 'python smoke' requires CPython 3.13 (found "
            f"{platform.python_implementation()} {sys.version.split()[0]}); "
            "install CPython 3.13, then run uv sync --frozen."
        )
    _run("python smoke", [sys.executable, "-m", "pytest", "-q"])


def _node_smoke() -> None:
    npm = shutil.which("npm")
    if npm is None:
        raise VerificationError(
            "stage 'node smoke' requires Node 24/npm 11; install the documented Node prerequisite."
        )
    node = shutil.which("node")
    if node is None:
        raise VerificationError(
            "stage 'node smoke' requires Node 24; install it, then rerun npm ci."
        )
    if Path(node).parent.resolve() != Path(npm).parent.resolve():
        raise VerificationError(
            "stage 'node smoke' resolved node and npm from different installations; "
            "activate one Node 24 toolchain and rerun npm ci."
        )
    node_version = _probe("Node", [node, "--version"])
    npm_version = _probe("npm", [npm, "--version"])
    if not node_version.startswith("v24."):
        raise VerificationError(
            "stage 'node smoke' requires Node 24 (found "
            f"{node_version or 'unavailable'}); install Node 24 and rerun npm ci."
        )
    if not npm_version.startswith("11."):
        raise VerificationError(
            "stage 'node smoke' requires npm 11 bundled with Node 24 (found "
            f"{npm_version or 'unavailable'}); reinstall the documented Node 24 prerequisite."
        )
    _run("node smoke", [npm, "run", "verify"])


def _status_smoke() -> None:
    """Gate the committed pipelines against the expected-pipeline catalog.

    Imported here so verification stays usable as a plain module: the catalog
    pulls in DuckDB and dlt, which a bare `pulse verify` should not pay for
    before it has decided the stage will run.
    """
    from pulse.catalog import compile_expected_pipelines, compile_status_catalog
    from pulse.contracts.snapshot import ContractError

    print("[status contract] compile expected pipelines and status", flush=True)
    try:
        compile_status_catalog(expected=compile_expected_pipelines())
    except (ContractError, OSError) as error:
        raise VerificationError(
            f"stage 'status contract' rejected the committed pipelines: {error}; "
            "reconcile the declarations, snapshots and publications."
        ) from error


def _workflow_smoke() -> None:
    """Enforce the source workflow's writer and offline-verification boundaries."""
    try:
        workflows = [
            path
            for path in (ROOT / ".github/workflows").glob("*.yml")
            if "pulse source refresh" in path.read_text(encoding="utf-8")
        ]
    except OSError as error:
        raise VerificationError("stage 'workflow contract' could not read source workflows") from error
    if len(workflows) != 1:
        raise VerificationError("stage 'workflow contract' requires exactly one source refresh workflow")
    content = workflows[0].read_text(encoding="utf-8")
    push_command = "git" + " push origin HEAD:main"
    required = (
        'cron: "17 6 23 * *"',
        "workflow_dispatch:",
        "contents: write",
        "group: pulse-repository-writer",
        "cancel-in-progress: false",
        "ref: main",
        "lfs: false",
        'version: "0.12.1"',
        "python-version: \"3.13\"",
        "uv sync --frozen",
        "git lfs pull --include=\"snapshots/public/",
        "pulse source refresh ",
        "github.run_id",
        "continue-on-error: true",
        "pulse source stage-publication ",
        "git diff --cached --quiet",
        push_command,
        "if: always()",
    )
    missing = [token for token in required if token not in content]
    if missing:
        raise VerificationError(
            "stage 'workflow contract' rejected the INSEE workflow: missing " + ", ".join(missing)
        )
    from pulse.datasets import discover_datasets

    if any(dataset_id in content for dataset_id in discover_datasets()):
        raise VerificationError(
            "stage 'workflow contract' rejects dataset knowledge in source workflow YAML"
        )
    dataset_publication_path = "publish/public" + "/data"
    if dataset_publication_path in content:
        raise VerificationError(
            "stage 'workflow contract' rejects dataset publication paths in source workflow YAML"
        )
    if "github.run_attempt" in content:
        raise VerificationError(
            "stage 'workflow contract' requires reruns to reuse one logical identity"
        )
    forbidden_runtime_operation = "git" + " push"
    if any(
        forbidden_runtime_operation in path.read_text(encoding="utf-8")
        for path in (ROOT / "runtime/pulse").rglob("*.py")
    ):
        raise VerificationError("stage 'workflow contract' forbids runtime code from pushing")
    verify_workflow = (ROOT / ".github/workflows/verify.yml").read_text(encoding="utf-8")
    if "--live" in verify_workflow or "PULSE_LIVE_INSEE" in verify_workflow:
        raise VerificationError("stage 'workflow contract' requires pull-request verification to stay offline")


SMOKE_STAGES: tuple[Callable[[], None], ...] = (
    _status_smoke,
    _workflow_smoke,
    _python_smoke,
    _node_smoke,
)


def verify_workspace() -> None:
    for stage in SMOKE_STAGES:
        stage()
