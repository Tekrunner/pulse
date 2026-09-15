-- The grain is (period, reference_area_code).
select period, reference_area_code, count(*) as rows_for_key
from {{ ref('oecd_unemployment_comparison') }}
group by period, reference_area_code
having count(*) > 1
