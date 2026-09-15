-- The grain is (period, reference_area_code, sex).
select period, reference_area_code, sex, count(*) as rows_for_key
from {{ ref('oecd_participation_comparison') }}
group by period, reference_area_code, sex
having count(*) > 1
