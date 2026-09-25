-- The provider's quarter-on-quarter growth is the change in its chained
-- volume level. Growth is published to a tenth of a point and levels to a
-- million euros, so the recomputed change may differ by the rounding of the
-- published rate.
select period, gdp_quarterly_growth_pct, recomputed
from (
  select period, gdp_quarterly_growth_pct,
    100 * (gdp_chained_eur_mn / lag(gdp_chained_eur_mn) over (order by period) - 1) as recomputed
  from {{ ref('french_gdp_quarterly') }}
)
where recomputed is not null and abs(gdp_quarterly_growth_pct - recomputed) > 0.06
