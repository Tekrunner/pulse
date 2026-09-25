-- Departement GDP in millions of euros adds up to French GDP, extra-regio
-- territory aside. Eurostat rounds each value to a tenth of a million, and the
-- extra-regio territory is under a tenth of a percent of the total, so half a
-- percent is ample and still catches a lost or duplicated departement.
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}
with france as (
  select cast(TIME_PERIOD as integer) as year, cast(OBS_VALUE as double) as gdp
  from {{ input_relation }}
  where geo = 'FR' and unit = 'MIO_EUR' and OBS_VALUE <> ''
)
select year(published.period) as year, sum(published.gdp_eur_mn) as departements, any_value(france.gdp) as france
from {{ ref('french_departement_gdp') }} as published
join france on france.year = year(published.period)
group by year(published.period)
having abs(sum(published.gdp_eur_mn) / any_value(france.gdp) - 1) > 0.005
