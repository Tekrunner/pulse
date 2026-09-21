-- The grain is (period, geo_code).
select period, geo_code, count(*) as rows_for_key
from {{ ref('european_immigration_flows') }}
group by period, geo_code
having count(*) > 1
