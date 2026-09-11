"""Observable site commands behind the repository-local Pulse CLI."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import sys

from pulse.verify import ROOT, VerificationError


def run_site(action: str) -> None:
    npm = shutil.which("npm")
    if npm is None:
        raise VerificationError("site commands require the locked Node 24/npm 11 workspace")
    script = {"build": "build", "serve": "serve"}[action]
    command = [npm, "run", script]
    try:
        completed = subprocess.run(command, cwd=Path(ROOT), check=False)
    except OSError as error:
        raise VerificationError(f"site {action} could not start npm: {error}") from error
    if completed.returncode:
        raise VerificationError(f"site {action} exited {completed.returncode}; inspect npm output above")


def _minimal_environment() -> dict[str, str]:
    """Environment for a public build: tool lookup and temporary storage only."""
    allowed = ("PATH", "TMPDIR", "TMP", "TEMP", "SystemRoot", "COMSPEC", "PATHEXT")
    environment = {name: os.environ[name] for name in allowed if name in os.environ}
    environment.update(
        {
            "LANG": "C.UTF-8",
            "LC_ALL": "C.UTF-8",
            "NO_COLOR": "1",
            "PULSE_PYTHON": sys.executable,
        }
    )
    return environment


def run_public_site_build(
    *, archive_root: Path, publish_root: Path, output: Path, generated_at: str
) -> None:
    node = shutil.which("node")
    if node is None:
        raise VerificationError("public site build requires the locked Node 24/npm 11 workspace")
    command = [
        node,
        str(ROOT / "scripts/build-site.mjs"),
        "--archive-root", str(archive_root),
        "--publish-root", str(publish_root),
        "--output", str(output),
        "--generated-at", generated_at,
        "--public",
    ]
    try:
        completed = subprocess.run(
            command,
            cwd=ROOT,
            env=_minimal_environment(),
            check=False,
        )
    except OSError as error:
        raise VerificationError(f"public site build could not start Node: {error}") from error
    if completed.returncode:
        raise VerificationError(
            f"public site build exited {completed.returncode}; retained the prior site artifact"
        )
