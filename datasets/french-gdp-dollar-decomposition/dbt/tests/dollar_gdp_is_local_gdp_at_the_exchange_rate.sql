-- Dollar GDP equals euro GDP divided by euros per dollar in every year. This is
-- what confirms the pre-1999 exchange rate has been converted from francs: an
-- unconverted year misses by a factor of 6.56. The provider publishes each
-- series to many significant figures, so a thousandth is ample.
select period, gdp_current_usd_mn, gdp_current_eur_mn / eur_per_usd as implied
from {{ ref('french_gdp_dollar_decomposition') }}
where abs(gdp_current_usd_mn * eur_per_usd / gdp_current_eur_mn - 1) > 0.001
