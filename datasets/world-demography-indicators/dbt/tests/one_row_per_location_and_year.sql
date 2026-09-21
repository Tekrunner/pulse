-- The grain is (period, location_id).
select period, location_id, count(*) as rows_for_key
from {{ ref('world_demography_indicators') }}
group by period, location_id
having count(*) > 1
