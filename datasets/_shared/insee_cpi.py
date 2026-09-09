"""INSEE CPI transformation support shared by independent dataset packages."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys

import duckdb

from pulse.datasets import DatasetBuildContext, DatasetBuildResult, DatasetError, SnapshotInput


REQUIRED_FIELDS = {"IDBANK", "TITLE_FR", "TIME_PERIOD", "OBS_VALUE", "FREQ", "REF_AREA", "UNIT_MULT"}
MONTHLY_SERIES = {"011814056", "011814057", "011814058"}
CATEGORY_SERIES = {
    "011814056", "011814057", "011814058", "011813717", "011813718",
    "011813719", "011813864", "011813866", "011815633", "011814578",
    "011814509", "011815638", "011813664", "011813665", "011813666",
    "011813668", "011813906", "011813908", "011814579", "011813780",
    "011813782", "011814496",
}


def _quote(path: Path) -> str:
    return "'" + str(path).replace("'", "''") + "'"


def select_snapshot(context: DatasetBuildContext, required_series: set[str]) -> SnapshotInput:
    """Select the newest snapshot containing the package's provider-native series."""
    for snapshot in context.snapshots:
        connection = duckdb.connect()
        try:
            schema = {
                name: kind
                for name, kind, *_ in connection.execute(
                    "DESCRIBE SELECT * FROM read_parquet(?)", [str(snapshot.parquet)]
                ).fetchall()
            }
            if not REQUIRED_FIELDS <= set(schema) or any(kind != "VARCHAR" for kind in schema.values()):
                continue
            series = {
                row[0]
                for row in connection.execute(
                    "SELECT DISTINCT IDBANK FROM read_parquet(?)", [str(snapshot.parquet)]
                ).fetchall()
            }
            duplicates = connection.execute(
                """SELECT count(*) FROM (
                     SELECT IDBANK, TIME_PERIOD FROM read_parquet(?)
                     GROUP BY IDBANK, TIME_PERIOD HAVING count(*) != 1
                   )""",
                [str(snapshot.parquet)],
            ).fetchone()[0]
            invalid = connection.execute(
                "SELECT count(*) FROM read_parquet(?) WHERE REF_AREA != 'FE' OR UNIT_MULT != '0'",
                [str(snapshot.parquet)],
            ).fetchone()[0]
        finally:
            connection.close()
        if required_series <= series and not duplicates and not invalid:
            return snapshot
    raise DatasetError("no snapshot satisfies this dataset's declared INSEE input contract")


def run_dbt(project: Path, snapshot: Path, output: Path, warehouse: Path, model: str) -> None:
    executable = str(Path(sys.executable).with_name("dbt.exe" if os.name == "nt" else "dbt"))
    environment = {key: value for key, value in os.environ.items() if not key.startswith("DBT_")}
    environment.update(
        {
            "DBT_PROFILES_DIR": str(project),
            "PULSE_DBT_DATABASE": str(warehouse),
            "DBT_SEND_ANONYMOUS_USAGE_STATS": "false",
        }
    )
    variables = json.dumps({"snapshot_path": str(snapshot), "external_location": str(output)})
    completed = subprocess.run(
        [executable, "build", "--select", "+" + model, "--vars", variables],
        cwd=project,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
        timeout=120,
    )
    if completed.returncode:
        raise DatasetError("dbt could not materialize the declared analytical candidate")
    if not output.is_file():
        raise DatasetError("dbt external publication did not create Parquet")


def _periods(connection: duckdb.DuckDBPyConnection, parquet: Path) -> tuple[int, int, str, str]:
    return connection.execute(
        "SELECT count(*), count(DISTINCT period), min(period)::VARCHAR, max(period)::VARCHAR FROM read_parquet(?)",
        [str(parquet)],
    ).fetchone()


def build_monthly(context: DatasetBuildContext) -> DatasetBuildResult:
    snapshot = select_snapshot(context, MONTHLY_SERIES)
    project = context.declaration.path.parent / "dbt"
    run_dbt(project, snapshot.parquet, context.output_path, context.work_root / "warehouse.duckdb", "insee_cpi_monthly")
    connection = duckdb.connect()
    try:
        rows, distinct, start, end = _periods(connection, context.output_path)
        nulls = connection.execute(
            """SELECT count(*) FROM read_parquet(?)
               WHERE period IS NULL OR cpi_index IS NULL OR monthly_change_pct IS NULL OR annual_change_pct IS NULL""",
            [str(context.output_path)],
        ).fetchone()[0]
        gaps = connection.execute(
            """SELECT count(*) FROM (
                 SELECT period, lag(period) OVER (ORDER BY period) previous_period FROM read_parquet(?)
               ) WHERE previous_period IS NOT NULL AND period != previous_period + interval 1 month""",
            [str(context.output_path)],
        ).fetchone()[0]
        failures: list[dict[str, object]] = []
        if connection.execute(
            "SELECT count(*) FROM read_parquet(?) WHERE cpi_index <= 0 OR monthly_change_pct NOT BETWEEN -100 AND 100 OR annual_change_pct NOT BETWEEN -100 AND 100",
            [str(context.output_path)],
        ).fetchone()[0]:
            failures.append({"check": "plausibility", "affected_columns": ["cpi_index", "monthly_change_pct", "annual_change_pct"]})
        if connection.execute(
            """SELECT count(*) FROM (
                 SELECT *, round((cpi_index / lag(cpi_index) OVER (ORDER BY period) - 1) * 100, 1) recomputed
                 FROM read_parquet(?)
               ) WHERE recomputed IS NOT NULL AND abs(monthly_change_pct - recomputed) > 0.051""",
            [str(context.output_path)],
        ).fetchone()[0]:
            failures.append({"check": "provider_monthly_change", "affected_columns": ["cpi_index", "monthly_change_pct"]})
        if connection.execute(
            """SELECT count(*) FROM (
                 SELECT *, round((cpi_index / lag(cpi_index, 12) OVER (ORDER BY period) - 1) * 100, 1) recomputed
                 FROM read_parquet(?)
               ) WHERE recomputed IS NOT NULL AND abs(annual_change_pct - recomputed) > 0.051""",
            [str(context.output_path)],
        ).fetchone()[0]:
            failures.append({"check": "provider_annual_change", "affected_columns": ["cpi_index", "annual_change_pct"]})
    finally:
        connection.close()
    if rows < 24 or rows != distinct or nulls or gaps:
        raise DatasetError(
            "monthly candidate has invalid grain, nullability, or represented periods",
            stage="test",
        )
    return DatasetBuildResult(
        snapshot,
        {"start": start, "end": end},
        {"state": "suspect" if failures else "succeeded", "assertions": failures},
        {"native_fields": ["OBS_STATUS", "OBS_QUAL", "DATE_JO", "LAST_UPDATE"]},
    )


def build_category_analysis(context: DatasetBuildContext) -> DatasetBuildResult:
    snapshot = select_snapshot(context, CATEGORY_SERIES)
    project = context.declaration.path.parent / "dbt"
    run_dbt(
        project,
        snapshot.parquet,
        context.output_path,
        context.work_root / "warehouse.duckdb",
        "insee_cpi_category_analysis",
    )
    connection = duckdb.connect()
    try:
        rows, distinct, start, end = _periods(connection, context.output_path)
        column_names = [column["name"] for column in context.declaration.contract.columns]
        null_predicate = " OR ".join(f'"{name}" IS NULL' for name in column_names)
        missing, future_weights, bad_formula = connection.execute(
            f"""SELECT count(*) FILTER (WHERE {null_predicate}),
                       count(*) FILTER (WHERE food_weight_reference_year > year(period)
                         OR services_weight_reference_year > year(period)
                         OR manufactured_products_weight_reference_year > year(period)
                         OR energy_weight_reference_year > year(period)
                         OR actual_rent_weight_reference_year > year(period)),
                       count(*) FILTER (
                         WHERE abs(actual_rent_pulse_contribution_pct_points
                           - round(actual_rent_weight / 10000.0 * actual_rent_annual_change_pct, 3)) > 0.0005)
                FROM read_parquet(?)""",
            [str(context.output_path)],
        ).fetchone()
        gaps = connection.execute(
            """SELECT count(*) FROM (
                 SELECT period, lag(period) OVER (ORDER BY period) previous_period FROM read_parquet(?)
               ) WHERE previous_period IS NOT NULL AND period != previous_period + interval 1 month""",
            [str(context.output_path)],
        ).fetchone()[0]
    finally:
        connection.close()
    if rows < 24 or rows != distinct or missing:
        raise DatasetError(
            "category-analysis candidate lacks complete comparable category and annual-weight coverage",
            stage="test",
        )
    if gaps:
        raise DatasetError("category-analysis candidate periods are not contiguous", stage="test")
    if future_weights:
        raise DatasetError("category-analysis candidate uses a future annual basket weight", stage="test")
    if bad_formula:
        raise DatasetError("category-analysis rent contribution formula is invalid", stage="test")
    return DatasetBuildResult(
        snapshot,
        {"start": start, "end": end},
        {"state": "succeeded", "assertions": []},
        {"native_fields": ["OBS_STATUS", "OBS_QUAL", "DATE_JO", "LAST_UPDATE"]},
    )
