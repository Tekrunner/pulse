{{ config(materialized='external', location=var('external_location'), format='parquet') }}

with typed as (
  select case when FREQ = 'M' then cast(TIME_PERIOD || '-01' as date) end as period,
    try_cast(TIME_PERIOD as integer) as reference_year, IDBANK,
    try_cast(OBS_VALUE as decimal(12,4)) as value, FREQ
  from {{ ref('stg_snapshot') }} where REF_AREA = 'FE' and UNIT_MULT = '0'
), monthly as (
  select period,
    max(case when IDBANK = '011813717' then value end)::decimal(12,2) food_index,
    max(case when IDBANK = '011813719' then value end)::decimal(8,1) food_annual_change_pct,
    max(case when IDBANK = '011813906' then value end)::decimal(12,2) services_index,
    max(case when IDBANK = '011813908' then value end)::decimal(8,1) services_annual_change_pct,
    max(case when IDBANK = '011813780' then value end)::decimal(12,2) manufactured_products_index,
    max(case when IDBANK = '011813782' then value end)::decimal(8,1) manufactured_products_annual_change_pct,
    max(case when IDBANK = '011813864' then value end)::decimal(12,2) energy_index,
    max(case when IDBANK = '011813866' then value end)::decimal(8,1) energy_annual_change_pct,
    max(case when IDBANK = '011815633' then value end)::decimal(12,2) actual_rent_index,
    max(case when IDBANK = '011813664' then value end)::decimal(8,3) food_official_contribution_pct_points,
    max(case when IDBANK = '011813665' then value end)::decimal(8,3) services_official_contribution_pct_points,
    max(case when IDBANK = '011813666' then value end)::decimal(8,3) manufactured_products_official_contribution_pct_points,
    max(case when IDBANK = '011813668' then value end)::decimal(8,3) energy_official_contribution_pct_points
  from typed where FREQ = 'M' group by period
), weights as (
  select reference_year,
    max(case when IDBANK = '011814578' then value end)::decimal(8,0) food_weight,
    max(case when IDBANK = '011814579' then value end)::decimal(8,0) services_weight,
    max(case when IDBANK = '011814496' then value end)::decimal(8,0) manufactured_products_weight,
    max(case when IDBANK = '011814509' then value end)::decimal(8,0) energy_weight,
    max(case when IDBANK = '011815638' then value end)::decimal(8,0) actual_rent_weight
  from typed where FREQ = 'A' group by reference_year
), contextual as (
select monthly.*, food_weight, food_weight_year food_weight_reference_year,
  services_weight, services_weight_year services_weight_reference_year,
  manufactured_products_weight, manufactured_products_weight_year manufactured_products_weight_reference_year,
  energy_weight, energy_weight_year energy_weight_reference_year,
  actual_rent_weight, actual_rent_weight_year actual_rent_weight_reference_year
from monthly
left join lateral (select food_weight, reference_year food_weight_year from weights where food_weight is not null and reference_year <= year(monthly.period) order by reference_year desc limit 1) food on true
left join lateral (select services_weight, reference_year services_weight_year from weights where services_weight is not null and reference_year <= year(monthly.period) order by reference_year desc limit 1) services on true
left join lateral (select manufactured_products_weight, reference_year manufactured_products_weight_year from weights where manufactured_products_weight is not null and reference_year <= year(monthly.period) order by reference_year desc limit 1) manufactured on true
left join lateral (select energy_weight, reference_year energy_weight_year from weights where energy_weight is not null and reference_year <= year(monthly.period) order by reference_year desc limit 1) energy on true
left join lateral (select actual_rent_weight, reference_year actual_rent_weight_year from weights where actual_rent_weight is not null and reference_year <= year(monthly.period) order by reference_year desc limit 1) rent on true
where food_index is not null and food_annual_change_pct is not null
  and services_index is not null and services_annual_change_pct is not null
  and manufactured_products_index is not null and manufactured_products_annual_change_pct is not null
  and energy_index is not null and energy_annual_change_pct is not null
  and actual_rent_index is not null
  and food_official_contribution_pct_points is not null
  and services_official_contribution_pct_points is not null
  and manufactured_products_official_contribution_pct_points is not null
  and energy_official_contribution_pct_points is not null
), derived as (
  select *,
    round((actual_rent_index / lag(actual_rent_index, 12) over (order by period) - 1) * 100, 1)::decimal(8,1) actual_rent_annual_change_pct
  from contextual
)
select *,
  round(actual_rent_weight / 10000.0 * actual_rent_annual_change_pct, 3)::decimal(8,3) actual_rent_pulse_contribution_pct_points
from derived
where actual_rent_annual_change_pct is not null
order by period
