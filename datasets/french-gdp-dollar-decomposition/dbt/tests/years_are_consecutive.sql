-- Annual changes are taken between adjacent rows, which are adjacent years only
-- if none is missing.
select period
from (
  select period, lag(period) over (order by period) as previous
  from {{ ref('french_gdp_dollar_decomposition') }}
)
where previous is not null and period <> previous + interval 1 year
