-- The grain is (period, location_code, sex).
select period, location_code, sex, count(*) as rows_for_key
from {{ ref('healthy_life_expectancy') }}
group by period, location_code, sex
having count(*) > 1
