{#
  One row per French departement and year of GDP at current market prices from
  Eurostat's regional accounts: in millions of euros, per inhabitant in euros,
  per inhabitant in purchasing power standards, and per inhabitant relative to
  France as a whole in the same year.

  Eurostat codes French NUTS 3 regions by NUTS code; each is one departement,
  and `nuts3_departements` declares the INSEE code of each.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('eurostat-regional-gdp publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}

with observed as (
  select geo, unit, cast(TIME_PERIOD as integer) as year,
    cast(nullif(OBS_VALUE, '') as double) as value, OBS_FLAG as flag
  from {{ input_relation }}
  where freq = 'A' and regexp_matches(TIME_PERIOD, '^\d{4}$')
    and (geo = 'FR' or geo in (select nuts3_code from {{ ref('nuts3_departements') }}))
),
pivoted as (
  select
    geo, year,
    max(case when unit = 'MIO_EUR' then value end) as gdp_eur_mn,
    max(case when unit = 'EUR_HAB' then value end) as gdp_per_inhabitant_eur,
    max(case when unit = 'PPS_EU27_2020_HAB' then value end) as gdp_per_inhabitant_pps,
    max(case when unit = 'EUR_HAB' then flag end) as flag
  from observed
  group by geo, year
),
france as (
  select year, gdp_per_inhabitant_eur as france_gdp_per_inhabitant_eur
  from pivoted
  where geo = 'FR'
)
select
  make_date(pivoted.year, 1, 1) as period,
  departements.departement_code,
  departements.nuts3_code,
  departements.nuts3_name as departement_name,
  cast(pivoted.gdp_eur_mn as decimal(14, 1)) as gdp_eur_mn,
  cast(pivoted.gdp_per_inhabitant_eur as decimal(10, 0)) as gdp_per_inhabitant_eur,
  cast(pivoted.gdp_per_inhabitant_pps as decimal(10, 0)) as gdp_per_inhabitant_pps,
  cast(france.france_gdp_per_inhabitant_eur as decimal(10, 0)) as france_gdp_per_inhabitant_eur,
  cast(100 * pivoted.gdp_per_inhabitant_eur / france.france_gdp_per_inhabitant_eur as decimal(8, 1)) as gdp_per_inhabitant_index_france,
  -- Eurostat marks provisional figures with a 'p' in the observation flag.
  coalesce(contains(pivoted.flag, 'p'), false) as is_provisional
from pivoted
join {{ ref('nuts3_departements') }} as departements on departements.nuts3_code = pivoted.geo
join france using (year)
where pivoted.gdp_per_inhabitant_eur is not null or pivoted.gdp_eur_mn is not null
order by period, departements.departement_code
