{#
  One row per reference area and year from the OECD Productivity Database,
  total economy: GDP at purchasing power parity, population, employment and
  hours worked, and the ratios that decompose GDP per inhabitant.

  Every ratio is derived here from the four published totals — GDP, total
  hours, employment and population — so that GDP per inhabitant is exactly GDP
  per hour times hours per worker times employment per inhabitant. The OECD's
  own GDP per hour equals GDP over total hours; its own average hours per
  worker does not always equal total hours over employment (the United States
  counts them on different employment bases), which is why it is not used.

  Current-PPP values compare levels across areas within a year; constant-PPP
  values, at 2020 prices and PPPs, follow one area over time.

  Labour input is screened for plausibility. On the 2026 snapshot New Zealand's
  total hours are published about fifty times too large, and its 2025
  employment likewise; Peru's hours are on a scale that yields about two hours
  a year per worker. An area-year whose hours per worker fall outside 1,000 to
  3,500, or whose employment falls outside a tenth to nine tenths of its
  population, is flagged, and its hours-based ratios are left null rather than
  published as measurements. Every other area lies between about 1,300 and
  2,400 hours and between 0.28 and 0.77 workers per inhabitant, so the screen
  has a wide margin on both sides.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('oecd-productivity-database publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}

with observed as (
  select
    split_part("REF_AREA: Reference area", ':', 1) as reference_area_code,
    trim(substr("REF_AREA: Reference area", strpos("REF_AREA: Reference area", ':') + 1)) as reference_area_name,
    split_part("MEASURE: Measure", ':', 1) as measure,
    split_part("UNIT_MEASURE: Unit of measure", ':', 1) as unit,
    split_part("PRICE_BASE: Price base", ':', 1) as price_base,
    split_part("TRANSFORMATION: Transformation", ':', 1) as transformation,
    cast("TIME_PERIOD: Time period" as integer) as year,
    cast("OBS_VALUE: Observation value" as double) as value
  from {{ input_relation }}
  where regexp_matches("TIME_PERIOD: Time period", '^\d{4}$')
    and "OBS_VALUE: Observation value" <> ''
),
pivoted as (
  select
    reference_area_code,
    any_value(reference_area_name) as reference_area_name,
    year,
    -- GDP is published in millions, population and employment in thousands,
    -- total hours in millions (UNIT_MULT 6, 3, 3, 6).
    max(case when measure = 'GDP' and unit = 'USD_PPP' and price_base = 'V' and transformation = 'N' then value end) as gdp_ppp_current,
    max(case when measure = 'GDP' and unit = 'USD_PPP' and price_base = 'LR' and transformation = 'N' then value end) as gdp_ppp_constant,
    max(case when measure = 'GDP' and unit = 'XDC' and price_base = 'LR' and transformation = 'N' then value end) as gdp_volume,
    max(case when measure = 'POP' and transformation = 'N' then value end) as population,
    max(case when measure = 'EMP' and transformation = 'N' then value end) as employment,
    max(case when measure = 'HRSTO' and transformation = 'N' then value end) as hours
  from observed
  group by reference_area_code, year
),
screened as (
  select
    *,
    case
      when hours is null or employment is null or population is null then null
      else 1000 * hours / employment between 1000 and 3500
        and employment / population between 0.1 and 0.9
    end as labour_input_is_plausible
  from pivoted
)
select
  make_date(year, 1, 1) as period,
  reference_area_code,
  reference_area_name,
  {{ oecd_area_kind('reference_area_code') }} as reference_area_kind,
  cast(gdp_ppp_current as decimal(18, 1)) as gdp_ppp_current_usd_mn,
  cast(gdp_ppp_constant as decimal(18, 1)) as gdp_ppp_constant_2020_usd_mn,
  cast(100 * (gdp_volume / lag(gdp_volume) over (partition by reference_area_code order by year) - 1) as decimal(8, 3)) as gdp_volume_growth_pct,
  cast(population as decimal(14, 1)) as population_thousands,
  cast(employment as decimal(14, 1)) as employment_thousands,
  cast(hours as decimal(14, 1)) as hours_worked_mn,
  cast(1000 * gdp_ppp_current / population as decimal(12, 1)) as gdp_per_capita_ppp_current_usd,
  cast(1000 * gdp_ppp_constant / population as decimal(12, 1)) as gdp_per_capita_ppp_constant_2020_usd,
  labour_input_is_plausible,
  cast(case when labour_input_is_plausible then gdp_ppp_current / hours end as decimal(12, 4)) as gdp_per_hour_ppp_current_usd,
  cast(case when labour_input_is_plausible then gdp_ppp_constant / hours end as decimal(12, 4)) as gdp_per_hour_ppp_constant_2020_usd,
  cast(case when labour_input_is_plausible then 1000 * hours / employment end as decimal(8, 1)) as hours_per_worker,
  cast(case when labour_input_is_plausible then employment / population end as decimal(8, 5)) as employment_per_capita
from screened
order by reference_area_code, year
