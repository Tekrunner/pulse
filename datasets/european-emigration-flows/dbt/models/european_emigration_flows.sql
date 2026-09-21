{#
  One typed row per reporting country and reference year.

  The snapshot holds the provider's own SDMX rows, so the work here is typing
  them and giving each reporting country an alpha-3 code it can be recognised
  by. The provider's suppressed observations stay null: an absent count is not
  a zero, and writing one would invent a year in which nobody left.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('unsupported snapshot format') }}
{% endif %}

{% set input_relation %}
  read_parquet('{{ var('snapshot_path') | replace("'", "''") }}')
{% endset %}

select
  make_date(cast("TIME_PERIOD" as integer), 1, 1) as period,
  "geo" as geo_code,
  {{ eurostat_iso3('"geo"') }} as iso3_code,
  {{ eurostat_geo_kind('"geo"') }} as geo_kind,
  cast(nullif("OBS_VALUE", '') as bigint) as emigration_persons,
  nullif("OBS_FLAG", '') as observation_flag
from {{ input_relation }}
order by geo_code, period
