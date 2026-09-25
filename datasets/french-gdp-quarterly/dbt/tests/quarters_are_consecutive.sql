-- The series is unbroken: year-on-year growth compares each quarter with the
-- row four positions earlier, which is the same quarter a year before only if
-- no quarter is missing.
select period
from (
  select period, lag(period) over (order by period) as previous
  from {{ ref('french_gdp_quarterly') }}
)
where previous is not null and period <> previous + interval 3 month
