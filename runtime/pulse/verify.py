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
SUBPROCESS_TIMEOUT_SECONDS = 60


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


SMOKE_STAGES: tuple[Callable[[], None], ...] = (_python_smoke, _node_smoke)


def verify_workspace() -> None:
    for stage in SMOKE_STAGES:
        stage()
