{#
  One row per year of French GDP in current US dollars at market exchange rates
  and the decomposition of its annual change.

  In logs the provider's own series satisfy an identity: dollar GDP is GDP in
  current local currency divided by the local-currency price of a dollar, and
  current local-currency GDP is constant local-currency GDP times the deflator.
  So the change in log dollar GDP is exactly the sum of the change in log real
  GDP, the change in the log deflator, and minus the change in the log price of
  a dollar. Each term is expressed in log points (100 times the log change), in
  which the three add up without an interaction term.

  The local currency is the euro throughout the GDP series (francs converted at
  the irrevocable rate), but the official exchange rate is published in francs
  per dollar before 1999. It is converted here at that same rate, 6.55957 francs
  per euro, fixed by Council Regulation (EC) No 2866/98, so that every year is
  in euros per dollar.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('world-bank-wdi-gdp publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}
{% set francs_per_euro = 6.55957 %}
{% set first_euro_year = 1999 %}

with observed as (
  select "indicator.id" as indicator, "indicator.value" as indicator_name, cast(date as integer) as year, value
  from {{ input_relation }}
  where countryiso3code = 'FRA' and value is not null and regexp_matches(date, '^\d{4}$')
),
pivoted as (
  select
    year,
    max(case when indicator = 'NY.GDP.MKTP.CD' then value end) as gdp_current_usd,
    max(case when indicator = 'NY.GDP.MKTP.KD' then value end) as gdp_constant_usd,
    max(case when indicator = 'NY.GDP.MKTP.CN' then value end) as gdp_current_lcu,
    max(case when indicator = 'NY.GDP.MKTP.KN' then value end) as gdp_constant_lcu,
    max(case when indicator = 'NY.GDP.DEFL.ZS' then value end) as gdp_deflator,
    max(case when indicator = 'PA.NUS.FCRF' then value end) as lcu_per_usd
  from observed
  group by year
),
-- The provider names its constant-dollar series by its base year, "GDP
-- (constant 2015 US$)"; the year is read from that name, so a rebase that the
-- source declaration accepts carries through without an edit here.
base as (
  select max(cast(regexp_extract(indicator_name, 'constant (\d{4}) US\$', 1) as integer)) as constant_usd_base_year
  from observed
  where indicator = 'NY.GDP.MKTP.KD'
),
converted as (
  select
    *,
    case when year < {{ first_euro_year }} then lcu_per_usd / {{ francs_per_euro }} else lcu_per_usd end as eur_per_usd
  from pivoted, base
),
changes as (
  select
    *,
    100 * ln(gdp_current_usd / lag(gdp_current_usd) over (order by year)) as dollar_change,
    100 * ln(gdp_constant_lcu / lag(gdp_constant_lcu) over (order by year)) as real_change,
    100 * ln(gdp_deflator / lag(gdp_deflator) over (order by year)) as deflator_change,
    -100 * ln(eur_per_usd / lag(eur_per_usd) over (order by year)) as exchange_change
  from converted
)
select
  make_date(year, 1, 1) as period,
  cast(gdp_current_usd / 1e6 as decimal(18, 1)) as gdp_current_usd_mn,
  cast(gdp_constant_usd / 1e6 as decimal(18, 1)) as gdp_constant_usd_mn,
  constant_usd_base_year,
  cast(gdp_current_lcu / 1e6 as decimal(18, 1)) as gdp_current_eur_mn,
  cast(gdp_constant_lcu / 1e6 as decimal(18, 1)) as gdp_constant_eur_mn,
  cast(gdp_deflator as decimal(12, 4)) as gdp_deflator_index,
  cast(eur_per_usd as decimal(12, 6)) as eur_per_usd,
  cast(100 * (gdp_current_usd / lag(gdp_current_usd) over (order by year) - 1) as decimal(10, 3)) as dollar_gdp_change_pct,
  cast(dollar_change as decimal(10, 3)) as dollar_gdp_change_log_points,
  cast(real_change as decimal(10, 3)) as real_growth_log_points,
  cast(deflator_change as decimal(10, 3)) as deflator_change_log_points,
  cast(exchange_change as decimal(10, 3)) as exchange_rate_change_log_points
from changes
order by year
