select period, reference_area_code, count(*) as rows
from {{ ref('oecd_productivity_comparison') }}
group by period, reference_area_code
having count(*) > 1
