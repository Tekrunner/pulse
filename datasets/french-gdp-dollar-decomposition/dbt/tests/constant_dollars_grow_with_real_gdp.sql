-- Constant-dollar GDP is constant local-currency GDP rescaled to the dollar at
-- one base year, so its log change equals real growth in every year. The two
-- are published to many significant figures; a hundredth of a log point is
-- rounding.
with changes as (
  select
    period,
    100 * ln(gdp_constant_usd_mn / lag(gdp_constant_usd_mn) over (order by period)) as dollar_real_growth,
    real_growth_log_points
  from {{ ref('french_gdp_dollar_decomposition') }}
)
select * from changes
where real_growth_log_points is not null and abs(dollar_real_growth - real_growth_log_points) > 0.01
