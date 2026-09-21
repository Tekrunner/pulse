-- A null here must mean "this scenario does not carry this measure", never
-- "this measure is missing for some of its rows". Anything in between would
-- let a consumer draw a line that stops without saying so.
with coverage as (
  select
    scenario_id,
    count(*) as rows_for_scenario,
    count(population_thousands) as population,
    count(population_growth_rate_pct) as growth,
    count(natural_change_thousands) as natural_change,
    count(net_migration_thousands) as net_migration,
    count(total_fertility_rate) as fertility,
    count(life_expectancy_years) as longevity,
    count(median_age_years) as median_age
  from {{ ref('world_demography_scenarios') }}
  group by scenario_id
)
select *
from coverage
where population not in (0, rows_for_scenario)
   or growth not in (0, rows_for_scenario)
   or natural_change not in (0, rows_for_scenario)
   or net_migration not in (0, rows_for_scenario)
   or fertility not in (0, rows_for_scenario)
   or longevity not in (0, rows_for_scenario)
   or median_age not in (0, rows_for_scenario)
