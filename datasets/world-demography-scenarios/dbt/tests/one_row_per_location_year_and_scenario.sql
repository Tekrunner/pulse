-- The grain is (period, location_id, scenario_id).
select period, location_id, scenario_id, count(*) as rows_for_key
from {{ ref('world_demography_scenarios') }}
group by period, location_id, scenario_id
having count(*) > 1
