"""Neutral snapshot-to-dataset orchestration; analytical work stays in dbt."""

import duckdb

from pulse.datasets import DatasetBuildResult, DatasetError
from pulse.dbt import run_dbt


def build(context):
    snapshot = context.snapshots[0]
    run_dbt(
        context.declaration.path.parent / "dbt",
        output=context.output_path,
        warehouse=context.work_root / "warehouse.duckdb",
        model=context.declaration.logical_table,
        variables={"snapshot_path": str(snapshot.artifact), "snapshot_format": snapshot.format},
    )
    connection = duckdb.connect()
    try:
        rows, start, end = connection.execute(
            "SELECT count(*), min(period)::VARCHAR, max(period)::VARCHAR FROM read_parquet(?)",
            [str(context.output_path)],
        ).fetchone()
    finally:
        connection.close()
    if not rows or start is None or end is None:
        raise DatasetError("dataset candidate is empty", stage="test")
    return DatasetBuildResult(
        snapshot,
        {"start": start, "end": end},
        {"state": "succeeded", "assertions": []},
        {"input_format": snapshot.format},
    )
