{#
  One wide row per quarter of French GDP from the INSEE quarterly national
  accounts, base 2020, seasonally and working-day adjusted.

  The snapshot is fetched by IDBANK, so it carries no dimension saying which
  series is which; the map below re-attaches the provider's meaning against the
  French catalogue titles recorded in the source declaration.

  Two derivations are made here:
  - annualised levels are the quarterly level times four, the rate at which GDP
    would accrue over a year at that quarter's pace, and so on the same scale
    as an annual total;
  - year-on-year growth compares a quarter's chained volume with the same
    quarter a year earlier, the measure comparable with annual growth.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('insee-quarterly-national-accounts publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}

{% set series = {
  '011794860': 'gdp_chained_eur_mn',
  '011794859': 'gdp_current_eur_mn',
  '011794844': 'gdp_quarterly_growth_pct'
} %}

with observed as (
  select
    IDBANK as idbank,
    -- The first day of the quarter the observation describes.
    make_date(
      cast(substr(TIME_PERIOD, 1, 4) as integer),
      (cast(substr(TIME_PERIOD, 7, 1) as integer) - 1) * 3 + 1,
      1
    ) as period,
    cast(OBS_VALUE as double) as value
  from {{ input_relation }}
  where regexp_matches(TIME_PERIOD, '^\d{4}-Q[1-4]$')
    and IDBANK in ({% for idbank in series %}{{ "'" ~ idbank ~ "'" }}{{ ", " if not loop.last }}{% endfor %})
),
pivoted as (
  select
    period,
    {%- for idbank, column in series.items() %}
    max(case when idbank = '{{ idbank }}' then value end) as {{ column }}{{ "," if not loop.last }}
    {%- endfor %}
  from observed
  group by period
)
select
  period,
  cast(gdp_chained_eur_mn as decimal(18, 1)) as gdp_chained_eur_mn,
  cast(gdp_current_eur_mn as decimal(18, 1)) as gdp_current_eur_mn,
  cast(4 * gdp_chained_eur_mn as decimal(18, 1)) as gdp_chained_annualised_eur_mn,
  cast(4 * gdp_current_eur_mn as decimal(18, 1)) as gdp_current_annualised_eur_mn,
  cast(gdp_quarterly_growth_pct as decimal(8, 2)) as gdp_quarterly_growth_pct,
  cast(
    100 * (gdp_chained_eur_mn / lag(gdp_chained_eur_mn, 4) over (order by period) - 1)
    as decimal(8, 2)
  ) as gdp_year_on_year_growth_pct
from pivoted
order by period
