-- Every year but the first carries its change and all three terms: a null
-- would mean a series skipped a year and the decomposition would silently
-- span two.
select period
from {{ ref('french_gdp_dollar_decomposition') }}
where period > (select min(period) from {{ ref('french_gdp_dollar_decomposition') }})
  and (dollar_gdp_change_pct is null or dollar_gdp_change_log_points is null
    or real_growth_log_points is null or deflator_change_log_points is null
    or exchange_rate_change_log_points is null)
