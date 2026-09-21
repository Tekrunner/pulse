"""Select the snapshot, run the package's dbt models and tests, summarize.

No analytical transformation lives here. The estimate boundary and the
projection horizon both come from the snapshot rather than being re-declared
beside it: the represented date of a World Population Prospects snapshot is the
last year the provider treats as estimated, and this file begins the year after
it, so the horizon is read from the candidate's own last year.
"""

import duckdb

from pulse.datasets import DatasetBuildResult, DatasetError
from pulse.dbt import run_dbt


# The provider closes the file with a 1 January stock row one year past the
# horizon. The horizon itself is a property of the revision, so it is read from
# the snapshot's own rows rather than declared here.
def _horizon(artifact: str) -> int:
    connection = duckdb.connect()
    try:
        horizon = connection.execute(
            """
            SELECT max(CAST("Time" AS INTEGER)) - 1
            FROM read_csv(?, header = true, quote = '"', escape = '"', all_varchar = true)
            """,
            [artifact],
        ).fetchone()[0]
    finally:
        connection.close()
    if horizon is None:
        raise DatasetError("snapshot carries no projected years", stage="transform")
    return int(horizon)


def build(context):
    snapshot = context.snapshots[0]
    represented = snapshot.manifest.source_data_date
    if not represented:
        raise DatasetError(
            "snapshot carries no represented date, so the estimate boundary is unknown",
            stage="transform",
        )
    boundary = int(represented[:4])
    horizon = _horizon(str(snapshot.artifact))
    run_dbt(
        context.declaration.path.parent / "dbt",
        output=context.output_path,
        warehouse=context.work_root / "warehouse.duckdb",
        model=context.declaration.logical_table,
        variables={
            "snapshot_path": str(snapshot.artifact),
            "snapshot_format": snapshot.format,
            "estimate_boundary_year": boundary,
            "projection_horizon_year": horizon,
        },
    )
    connection = duckdb.connect()
    try:
        rows, start, end, scenarios, locations = connection.execute(
            """
            SELECT
              count(*),
              min(period)::VARCHAR,
              -- The period column is the first day of a calendar year, so the
              -- represented period ends on the last day of the latest one.
              (make_date(year(max(period)), 12, 31))::VARCHAR,
              count(DISTINCT scenario_id),
              count(DISTINCT location_id)
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
            "projection_horizon_year": horizon,
            "scenarios": scenarios,
            "locations": locations,
        },
    )
