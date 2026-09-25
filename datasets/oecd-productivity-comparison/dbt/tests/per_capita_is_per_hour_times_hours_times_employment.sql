-- GDP per inhabitant is exactly GDP per hour times hours per worker times
-- employment per inhabitant, because all four are derived from the same
-- published totals. Each factor is rounded when stored, so the product may
-- miss by about a ten-thousandth; a thousandth is the tolerance.
select period, reference_area_code, gdp_per_capita_ppp_constant_2020_usd,
  gdp_per_hour_ppp_constant_2020_usd * hours_per_worker * employment_per_capita as product
from {{ ref('oecd_productivity_comparison') }}
where gdp_per_capita_ppp_constant_2020_usd is not null
  and gdp_per_hour_ppp_constant_2020_usd is not null
  and hours_per_worker is not null and employment_per_capita is not null
  and abs(gdp_per_hour_ppp_constant_2020_usd * hours_per_worker * employment_per_capita
    / gdp_per_capita_ppp_constant_2020_usd - 1) > 0.001
