{{ config(materialized='external', location=var('external_location'), format='parquet') }}

with typed as (
  select cast(TIME_PERIOD || '-01' as date) as period, IDBANK,
    try_cast(OBS_VALUE as decimal(12,2)) as value
  from {{ ref('stg_snapshot') }}
  where FREQ = 'M' and REF_AREA = 'FE' and UNIT_MULT = '0'
), wide as (
  select period,
    max(case when IDBANK = '011814056' then value end)::decimal(12,2) as cpi_index,
    max(case when IDBANK = '011814057' then value end)::decimal(8,1) as monthly_change_pct,
    max(case when IDBANK = '011814058' then value end)::decimal(8,1) as annual_change_pct
  from typed group by period
)
select * from wide order by period
