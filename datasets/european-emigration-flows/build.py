"""Select the snapshot, run the package's dbt models and tests, summarize.

No analytical transformation lives here: typing, the reporting-area mapping and
every data-quality question are expressed in the package's own dbt SQL.
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
        rows, start, end, areas, countries, published = connection.execute(
            """
            SELECT
              count(*),
              min(period)::VARCHAR,
              -- The period column is the first day of a reference year, so the
              -- represented period ends on the last day of the latest one. A
              -- table reported as ending on 1 January would be judged against
              -- the deadline of the year before the one it actually holds.
              (make_date(year(max(period)), 12, 31))::VARCHAR,
              count(DISTINCT geo_code),
              count(DISTINCT geo_code) FILTER (WHERE geo_kind = 'country'),
              count(emigration_persons)
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
            "reporting_areas": areas,
            "reporting_countries": countries,
            "published_observations": published,
        },
    )
