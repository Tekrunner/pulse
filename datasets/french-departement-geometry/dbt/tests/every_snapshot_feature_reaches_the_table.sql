-- This package's own completeness guarantee: every boundary the pinned IGN
-- edition published reaches the table exactly once, so the model can never drop
-- or duplicate a territory.
--
-- It deliberately does not name the territories some other dataset publishes a
-- rate for. That list belongs to french-departement-unemployment, dbt cannot
-- ref across packages, and a copy of it here would be a second source of truth
-- that drifts silently. Whether every rated territory has a shape is a property
-- of the join, so it is asserted by whatever performs that join.
{% set snapshot = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}
with published as (
  select departement_code, count(*) as rows_published
  from {{ ref('french_departement_geometry') }}
  group by departement_code
),
snapshot_features as (
  select distinct code_insee as departement_code from {{ snapshot }}
)
select
  coalesce(snapshot_features.departement_code, published.departement_code) as departement_code,
  published.rows_published
from snapshot_features
full outer join published
  on published.departement_code = snapshot_features.departement_code
where snapshot_features.departement_code is null
   or published.departement_code is null
   or published.rows_published <> 1
