"""Select the snapshot, run the package's dbt models and tests, summarize.

No analytical transformation lives here. The one value this builder derives is
the estimate boundary, and it derives it from the snapshot's own manifest
rather than re-declaring it: the represented date of a World Population
Prospects snapshot is the last year the provider treats as estimated, so the
boundary travels with the snapshot instead of drifting beside it.
"""

import duckdb

from pulse.datasets import DatasetBuildResult, DatasetError
from pulse.dbt import run_dbt


def build(context):
    snapshot = context.snapshots[0]
    represented = snapshot.manifest.source_data_date
    if not represented:
        raise DatasetError(
            "snapshot carries no represented date, so the estimate boundary is unknown",
            stage="transform",
        )
    boundary = int(represented[:4])
    run_dbt(
        context.declaration.path.parent / "dbt",
        output=context.output_path,
        warehouse=context.work_root / "warehouse.duckdb",
        model=context.declaration.logical_table,
        variables={
            "snapshot_path": str(snapshot.artifact),
            "snapshot_format": snapshot.format,
            "estimate_boundary_year": boundary,
        },
    )
    connection = duckdb.connect()
    try:
        rows, start, end, locations, five_year_bands, broad_bands = connection.execute(
            """
            SELECT
              count(*),
              min(period)::VARCHAR,
              -- The period column is the first day of a calendar year, so the
              -- represented period ends on the last day of the latest one.
              (make_date(year(max(period)), 12, 31))::VARCHAR,
              count(DISTINCT location_id),
              count(DISTINCT age_group) FILTER (WHERE age_grouping = 'five-year'),
              count(DISTINCT age_group) FILTER (WHERE age_grouping = 'broad')
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
            "estimate_boundary_year": boundary,
            "locations": locations,
            "five_year_bands": five_year_bands,
            "broad_bands": broad_bands,
        },
    )
