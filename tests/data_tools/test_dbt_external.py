"""Prove dbt-duckdb's external-Parquet publication behavior in a temporary fixture."""

from __future__ import annotations

import os
import json
from pathlib import Path
import shutil
import subprocess
import sys

import duckdb

import pytest


ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "tests" / "fixtures" / "dbt_external"
DBT_TIMEOUT_SECONDS = 60


def _fixture_project(tmp_path: Path) -> Path:
    project = tmp_path / "project"
    shutil.copytree(FIXTURE, project)
    return project


def _dbt(project: Path, tmp_path: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    environment = {key: value for key, value in os.environ.items() if not key.startswith("DBT_")}
    environment |= {
        "DBT_PROFILES_DIR": str(project),
        "PULSE_DBT_DATABASE": str(tmp_path / "smoke.duckdb"),
        "DBT_SEND_ANONYMOUS_USAGE_STATS": "false",
    }
    return subprocess.run(
        [_dbt_executable(), *arguments],
        cwd=project,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
        timeout=DBT_TIMEOUT_SECONDS,
    )


def _dbt_executable() -> str:
    executable_name = "dbt.exe" if os.name == "nt" else "dbt"
    return str(Path(sys.executable).with_name(executable_name))


def _external_location_vars(location: Path) -> str:
    """dbt accepts YAML; JSON is a safe YAML subset for arbitrary local paths."""
    return json.dumps({"external_location": str(location)})


def test_dbt_invocation_is_isolated_and_uses_safe_vars(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    captured: dict[str, object] = {}

    def fake_run(*arguments: object, **kwargs: object) -> subprocess.CompletedProcess[str]:
        captured["arguments"] = arguments
        captured["kwargs"] = kwargs
        return subprocess.CompletedProcess(arguments[0], 0, "", "")

    monkeypatch.setenv("DBT_TARGET", "host-specific")
    monkeypatch.setattr(subprocess, "run", fake_run)
    _dbt(tmp_path, tmp_path, "parse", "--vars", _external_location_vars(tmp_path / "a'quoted.parquet"))

    environment = captured["kwargs"]["env"]  # type: ignore[index]
    assert "DBT_TARGET" not in environment
    assert environment["DBT_SEND_ANONYMOUS_USAGE_STATS"] == "false"
    assert captured["kwargs"]["timeout"] == DBT_TIMEOUT_SECONDS  # type: ignore[index]
    assert json.loads(captured["arguments"][0][-1]) == {"external_location": str(tmp_path / "a'quoted.parquet")}  # type: ignore[index]


def _assert_success(result: subprocess.CompletedProcess[str], action: str) -> None:
    assert result.returncode == 0, f"dbt {action} failed:\n{result.stdout}\n{result.stderr}"


def test_external_parquet_model_can_be_referenced_and_tested(tmp_path: Path) -> None:
    project = _fixture_project(tmp_path)
    external_path = tmp_path / "published.parquet"
    variables = _external_location_vars(external_path)
    _assert_success(_dbt(project, tmp_path, "debug"), "debug")
    _assert_success(_dbt(project, tmp_path, "parse", "--vars", variables), "parse")
    _assert_success(
        _dbt(project, tmp_path, "build", "--select", "upstream published_external downstream", "--vars", variables),
        "build",
    )
    assert external_path.is_file(), "dbt external materialization did not write Parquet"
    _assert_success(_dbt(project, tmp_path, "test", "--select", "published_external downstream", "--vars", variables), "test")
    expected_row = [(1, "present")]
    with duckdb.connect(str(tmp_path / "smoke.duckdb"), read_only=True) as connection:
        assert connection.execute("select id, required_value from downstream").fetchall() == expected_row
        assert connection.execute("select id, required_value from read_parquet(?)", [str(external_path)]).fetchall() == expected_row


def test_invalid_not_null_fixture_fails_as_evidence(tmp_path: Path) -> None:
    project = _fixture_project(tmp_path)
    _assert_success(_dbt(project, tmp_path, "run", "--select", "invalid"), "run invalid fixture")
    result = _dbt(project, tmp_path, "test", "--select", "invalid")
    assert result.returncode != 0, "invalid not_null fixture unexpectedly passed"
    output = result.stdout + result.stderr
    assert "FAIL 1 not_null_invalid_required_value" in output
    assert "in test not_null_invalid_required_value (models/invalid_schema.yml)" in output
    assert "Got 1 result, configured to fail if != 0" in output
