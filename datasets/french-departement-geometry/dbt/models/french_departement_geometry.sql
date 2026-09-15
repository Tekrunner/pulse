{#
  One row per departement, carrying the boundary polygon as GeoJSON text plus a
  bounding box.

  No geometry is simplified here. The generalisation was chosen at acquisition,
  where the provider's own Petite Echelle layer was taken instead of the full
  detail one, so this package has nothing left to decide. Simplifying further
  would mean inventing boundaries the provider never published, and would need a
  DuckDB spatial extension this offline build cannot load.

  The bounding box is computed rather than stored by the provider. It is not an
  analytical claim: it is the extent a map needs in order to fit a shape without
  parsing every coordinate in the browser first.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('ign-departement-boundaries publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}

with positions as (
  select
    code_insee,
    unnest(
      -- MultiPolygon nests as polygon / ring / position, so three levels of
      -- flattening reach the coordinate pairs regardless of ring count.
      flatten(flatten(cast(json_extract(geometry, '$.coordinates') as double[][][][])))
    ) as position
  from {{ input_relation }}
),
extent as (
  select
    code_insee,
    min(position[1]) as bbox_west,
    min(position[2]) as bbox_south,
    max(position[1]) as bbox_east,
    max(position[2]) as bbox_north
  from positions
  group by code_insee
)
select
  boundary.code_insee as departement_code,
  boundary.nom_officiel as departement_name,
  boundary.code_insee_de_la_region as region_code,
  cast(json_extract_string(boundary.geometry, '$.type') as varchar) as geometry_type,
  boundary.geometry as geometry_geojson,
  cast(extent.bbox_west as decimal(9, 6)) as bbox_west,
  cast(extent.bbox_south as decimal(9, 6)) as bbox_south,
  cast(extent.bbox_east as decimal(9, 6)) as bbox_east,
  cast(extent.bbox_north as decimal(9, 6)) as bbox_north
from {{ input_relation }} as boundary
join extent on extent.code_insee = boundary.code_insee
order by boundary.code_insee
