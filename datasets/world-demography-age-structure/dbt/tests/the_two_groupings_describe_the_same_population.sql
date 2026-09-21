-- The broad bands are summed from the five-year bands, so for every location
-- and year the two groupings must total the same people. A difference would
-- mean the broad bands lost or duplicated a five-year band.
with totals as (
  select period, location_id, age_grouping, sum(population_total_thousands) as people
  from {{ ref('world_demography_age_structure') }}
  group by period, location_id, age_grouping
)
select
  five_year.period, five_year.location_id, five_year.people as five_year_people, broad.people as broad_people
from totals as five_year
join totals as broad
  on broad.period = five_year.period
 and broad.location_id = five_year.location_id
 and broad.age_grouping = 'broad'
where five_year.age_grouping = 'five-year'
  -- Both sides sum the same published values, so they agree exactly rather
  -- than within a tolerance.
  and five_year.people <> broad.people
