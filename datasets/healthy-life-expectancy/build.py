"""Select the snapshot, run the package's dbt models and tests, summarize.

No analytical transformation lives here: typing, the location and sex
vocabularies and every data-quality question are expressed in the package's own
dbt SQL.
"""

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
        rows, start, end, locations, countries, with_interval = connection.execute(
            """
            SELECT
              count(*),
              min(period)::VARCHAR,
              -- The period column is the first day of a reference year, so the
              -- represented period ends on the last day of the latest one.
              (make_date(year(max(period)), 12, 31))::VARCHAR,
              count(DISTINCT location_code),
              count(DISTINCT location_code) FILTER (WHERE location_kind = 'country'),
              count(uncertainty_low_years)
            FROM read_parquet(?)
            """,
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
        {
            "input_format": snapshot.format,
            "locations": locations,
            "countries": countries,
            "observations_with_an_uncertainty_interval": with_interval,
        },
    )
