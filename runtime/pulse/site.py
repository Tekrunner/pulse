"""Observable site commands behind the repository-local Pulse CLI."""

from __future__ import annotations

from pathlib import Path
import shutil
import subprocess

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
