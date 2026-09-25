"""Select a valid snapshot, run the package's dbt models and tests, summarize.

No analytical transformation lives here: the IDBANK-to-column map, the
annualisation, year-on-year growth and every data-quality rule are in
package-owned dbt SQL.
"""

import duckdb

from pulse.datasets import DatasetBuildResult, DatasetError
from pulse.dbt import run_dbt


def build(context):
    snapshot = context.snapshots[0]
    if snapshot.format != "parquet":
        raise DatasetError(
            "insee-quarterly-national-accounts publishes provider-native Parquet rows", stage="transform"
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
        rows, start, end = connection.execute(
            # `period` is a quarter start; the represented period ends on the last
            # day of the latest quarter, which is what the publication deadline
            # advances from.
            "SELECT count(*), min(period)::VARCHAR,"
            " last_day(max(period) + INTERVAL 2 MONTH)::VARCHAR FROM read_parquet(?)",
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
        {"input_format": snapshot.format, "quarters": rows},
    )
