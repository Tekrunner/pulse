-- The per-inhabitant and per-hour levels derived from totals reproduce the
-- OECD's own GDP per capita and GDP per hour worked at current PPP. A
-- divergence would mean a total now feeds the wrong column. Per hour is
-- compared only where labour input passed the screen and is published.
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}
with published as (
  select
    split_part("REF_AREA: Reference area", ':', 1) as reference_area_code,
    make_date(cast("TIME_PERIOD: Time period" as integer), 1, 1) as period,
    max(case when split_part("MEASURE: Measure", ':', 1) = 'GDPPOP'
      and split_part("UNIT_MEASURE: Unit of measure", ':', 1) = 'USD_PPP_PS' then cast("OBS_VALUE: Observation value" as double) end) as per_capita,
    max(case when split_part("MEASURE: Measure", ':', 1) = 'GDPHRS'
      and split_part("UNIT_MEASURE: Unit of measure", ':', 1) = 'USD_PPP_H' then cast("OBS_VALUE: Observation value" as double) end) as per_hour
  from {{ input_relation }}
  where regexp_matches("TIME_PERIOD: Time period", '^\d{4}$') and "OBS_VALUE: Observation value" <> ''
    and split_part("PRICE_BASE: Price base", ':', 1) = 'V'
    and split_part("TRANSFORMATION: Transformation", ':', 1) = 'N'
  group by 1, 2
)
select derived.reference_area_code, derived.period
from {{ ref('oecd_productivity_comparison') }} as derived
join published using (reference_area_code, period)
where abs(derived.gdp_per_capita_ppp_current_usd / published.per_capita - 1) > 0.001
   or (derived.gdp_per_hour_ppp_current_usd is not null
       and abs(derived.gdp_per_hour_ppp_current_usd / published.per_hour - 1) > 0.001)
