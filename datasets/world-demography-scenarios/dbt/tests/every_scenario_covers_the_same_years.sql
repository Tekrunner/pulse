-- Scenarios differ in which locations and measures they carry, never in which
-- years they span. A scenario that stopped short would make a projection range
-- narrow silently at its far end.
with span as (
  select scenario_id, min(period) as first_year, max(period) as last_year
  from {{ ref('world_demography_scenarios') }}
  group by scenario_id
)
select scenario_id, first_year, last_year
from span
where first_year <> (select min(first_year) from span)
   or last_year <> (select max(last_year) from span)
