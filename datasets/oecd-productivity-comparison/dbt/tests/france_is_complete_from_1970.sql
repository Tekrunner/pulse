-- France carries GDP at current and constant PPP, population, employment and
-- hours in every year from 1970, the start of its Productivity Database
-- history, so its decomposition has no gaps.
select period
from {{ ref('oecd_productivity_comparison') }}
where reference_area_code = 'FRA' and period >= date '1970-01-01'
  and (gdp_ppp_current_usd_mn is null or gdp_ppp_constant_2020_usd_mn is null
    or population_thousands is null or employment_thousands is null or hours_worked_mn is null)
union all
select date '1970-01-01'
where not exists (
  select 1 from {{ ref('oecd_productivity_comparison') }}
  where reference_area_code = 'FRA' and period = date '1970-01-01'
)
