{#
  One typed row per location, reference year and sex.

  Every row the provider returns is kept. Its licence permits alteration of the
  datasets only with prior written authorization, so this model types and names
  the fields it needs and selects no subset of locations, years or sexes: the
  table's universe is the provider's own.

  The uncertainty interval stays nullable. The provider publishes an estimate
  without one on a handful of rows, and demanding an interval would discard
  estimates it does publish.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('unsupported snapshot format') }}
{% endif %}

{% set input_relation %}
  read_parquet('{{ var('snapshot_path') | replace("'", "''") }}')
{% endset %}

select
  make_date(cast("TimeDim" as integer), 1, 1) as period,
  "SpatialDim" as location_code,
  case "SpatialDimType"
    when 'COUNTRY' then 'country'
    when 'REGION' then 'region'
    when 'WORLDBANKINCOMEGROUP' then 'income-group'
    when 'GLOBAL' then 'global'
    else null
  end as location_kind,
  -- The provider identifies its countries by their alpha-3 code already, which
  -- is what lets these rows be recognised beside another provider's. Its
  -- regions, income groups and world total are its own classifications and
  -- carry no country code.
  case when "SpatialDimType" = 'COUNTRY' then "SpatialDim" else null end as iso3_code,
  case "Dim1"
    when 'SEX_BTSX' then 'total'
    when 'SEX_MLE' then 'male'
    when 'SEX_FMLE' then 'female'
    else null
  end as sex,
  cast("NumericValue" as decimal(9, 5)) as healthy_life_expectancy_years,
  cast("Low" as decimal(9, 5)) as uncertainty_low_years,
  cast("High" as decimal(9, 5)) as uncertainty_high_years
from {{ input_relation }}
order by location_code, period, sex
