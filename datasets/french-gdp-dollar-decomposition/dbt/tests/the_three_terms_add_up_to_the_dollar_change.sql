-- Real growth, deflator change and exchange-rate change, in log points, add up
-- to the change in log dollar GDP. Each is rounded to a thousandth of a point
-- and the identity holds in the provider's data to its own precision, so the
-- tolerance allows the rounding of four terms and a small residual.
select period, dollar_gdp_change_log_points,
  real_growth_log_points + deflator_change_log_points + exchange_rate_change_log_points as summed
from {{ ref('french_gdp_dollar_decomposition') }}
where dollar_gdp_change_log_points is not null
  and abs(dollar_gdp_change_log_points
    - (real_growth_log_points + deflator_change_log_points + exchange_rate_change_log_points)) > 0.1
