-- In its base year constant-dollar GDP is current-dollar GDP: the base year
-- named by the provider is the year the rescaling is anchored to. A base year
-- the table does not reach fails too.
with anchor as (
  select max(constant_usd_base_year) as base_year from {{ ref('french_gdp_dollar_decomposition') }}
)
select anchor.base_year, row.gdp_current_usd_mn, row.gdp_constant_usd_mn
from anchor
left join {{ ref('french_gdp_dollar_decomposition') }} as row on year(row.period) = anchor.base_year
where row.period is null or abs(row.gdp_constant_usd_mn / row.gdp_current_usd_mn - 1) > 0.0001
