-- A location-year that published the total without both sexes would let a
-- comparison between men and women silently drop one of them.
select period, location_code, count(distinct sex) as sexes
from {{ ref('healthy_life_expectancy') }}
group by period, location_code
having count(distinct sex) <> 3
