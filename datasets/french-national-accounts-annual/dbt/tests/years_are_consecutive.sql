-- The accounts are an unbroken annual series: a missing year would silently
-- turn a one-year change into a two-year one for any consumer differencing it.
select period
from (
  select period, lag(period) over (order by period) as previous
  from {{ ref('french_national_accounts_annual') }}
)
where previous is not null and period <> previous + interval 1 year
