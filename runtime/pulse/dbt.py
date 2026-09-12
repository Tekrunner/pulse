"""Provider-neutral dbt-on-DuckDB execution for dataset packages."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any


def run_dbt(
    project: Path,
    *,
    output: Path,
    warehouse: Path,
    model: str,
    variables: dict[str, Any],
    timeout: int = 120,
) -> None:
    """Build one selected dbt model and its tests with a local DuckDB profile."""
    if not model or any(character not in "abcdefghijklmnopqrstuvwxyz0123456789_" for character in model):
        raise ValueError("dbt model must be a lowercase snake_case name")
    from pulse.datasets import DatasetError

    executable = str(Path(sys.executable).with_name("dbt.exe" if os.name == "nt" else "dbt"))
    environment = {key: value for key, value in os.environ.items() if not key.startswith("DBT_")}
    environment.update(
        {
            "DBT_PROFILES_DIR": str(project),
            "PULSE_DBT_DATABASE": str(warehouse),
            "DBT_SEND_ANONYMOUS_USAGE_STATS": "false",
            "DBT_LOG_PATH": str(warehouse.parent / "dbt-logs"),
            "DBT_TARGET_PATH": str(warehouse.parent / "dbt-target"),
        }
    )
    dbt_variables = {**variables, "external_location": str(output)}
    completed = subprocess.run(
        [executable, "build", "--select", "+" + model, "--vars", json.dumps(dbt_variables)],
        cwd=project,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
        timeout=timeout,
    )
    if completed.returncode:
        raise DatasetError("dbt could not materialize the declared analytical candidate")
    if not output.is_file():
        raise DatasetError("dbt external publication did not create Parquet")
