-- The grain is (period, location_id, age_grouping, age_group).
select period, location_id, age_grouping, age_group, count(*) as rows_for_key
from {{ ref('world_demography_age_structure') }}
group by period, location_id, age_grouping, age_group
having count(*) > 1
