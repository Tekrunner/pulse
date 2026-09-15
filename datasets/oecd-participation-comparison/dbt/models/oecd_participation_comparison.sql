{#
  One row per quarter, reference area and sex. Sex stays a dimension rather than
  becoming three columns, because the report reads men, women and both together
  as the same measure of the same population, and a reader switching between
  them is switching a filter rather than a metric.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('oecd-participation-rate publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}

with split as (
  select
    trim(split_part("REF_AREA: Reference area", ':', 1)) as reference_area_code,
    trim(substr("REF_AREA: Reference area", position(':' in "REF_AREA: Reference area") + 1))
      as reference_area_name,
    trim(split_part("SEX: Sex", ':', 1)) as provider_sex,
    "TIME_PERIOD: Time period" as provider_period,
    "OBS_VALUE: Observation value" as provider_value
  from {{ input_relation }}
  where regexp_matches("TIME_PERIOD: Time period", '^\d{4}-Q[1-4]$')
    and try_cast("OBS_VALUE: Observation value" as double) is not null
)
select
  make_date(
    cast(substr(provider_period, 1, 4) as integer),
    (cast(substr(provider_period, 7, 1) as integer) - 1) * 3 + 1,
    1
  ) as period,
  reference_area_code,
  reference_area_name,
  {{ oecd_area_kind('reference_area_code') }} as reference_area_kind,
  case provider_sex
    when '_T' then 'all'
    when 'M' then 'men'
    when 'F' then 'women'
  end as sex,
  cast(provider_value as decimal(10, 1)) as participation_rate_pct
from split
where provider_sex in ('_T', 'M', 'F')
order by period, reference_area_code, sex
