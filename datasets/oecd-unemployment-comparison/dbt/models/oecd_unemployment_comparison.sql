{#
  One row per month and reference area. The provider ships each dimension as a
  single "<code>: <label>" string, so the two halves are split here; both are
  kept, because the label is the OECD's own country name and inventing an
  alternative would be inventing data.

  Reference areas are classified into member, aggregate and non-member from the
  package-owned membership list, because nothing in the response distinguishes
  a country from a computed aggregate.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('oecd-unemployment-rate publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}

with split as (
  select
    trim(split_part("REF_AREA: Reference area", ':', 1)) as reference_area_code,
    trim(substr("REF_AREA: Reference area", position(':' in "REF_AREA: Reference area") + 1))
      as reference_area_name,
    "TIME_PERIOD: Time period" as provider_period,
    "OBS_VALUE: Observation value" as provider_value
  from {{ input_relation }}
  where regexp_matches("TIME_PERIOD: Time period", '^\d{4}-(0[1-9]|1[0-2])$')
    and try_cast("OBS_VALUE: Observation value" as double) is not null
)
select
  make_date(
    cast(substr(provider_period, 1, 4) as integer),
    cast(substr(provider_period, 6, 2) as integer),
    1
  ) as period,
  reference_area_code,
  reference_area_name,
  {{ oecd_area_kind('reference_area_code') }} as reference_area_kind,
  cast(provider_value as decimal(10, 1)) as unemployment_rate_pct
from split
order by period, reference_area_code
