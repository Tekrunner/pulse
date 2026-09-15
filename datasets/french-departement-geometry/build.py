"""Select a valid snapshot, run the package's dbt models and tests, summarize.

This table has no time dimension, so the represented period is taken from the
snapshot's own represented date — the reference year of the pinned IGN edition —
rather than from any column here.
"""

import duckdb

from pulse.datasets import DatasetBuildResult, DatasetError
from pulse.dbt import run_dbt


def build(context):
    snapshot = context.snapshots[0]
    if snapshot.format != "parquet":
        raise DatasetError(
            "ign-departement-boundaries publishes provider-native Parquet rows", stage="transform"
        )
    run_dbt(
        context.declaration.path.parent / "dbt",
        output=context.output_path,
        warehouse=context.work_root / "warehouse.duckdb",
        model=context.declaration.logical_table,
        variables={"snapshot_path": str(snapshot.artifact), "snapshot_format": snapshot.format},
    )
    connection = duckdb.connect()
    try:
        (rows,) = connection.execute(
            "SELECT count(*) FROM read_parquet(?)", [str(context.output_path)]
        ).fetchone()
    finally:
        connection.close()
    represented = snapshot.manifest.source_data_date
    if not rows or not represented:
        raise DatasetError("dataset candidate is empty or undated", stage="test")
    return DatasetBuildResult(
        snapshot,
        {"start": represented, "end": represented},
        {"state": "succeeded", "assertions": []},
        {"input_format": snapshot.format, "departements": rows},
    )
