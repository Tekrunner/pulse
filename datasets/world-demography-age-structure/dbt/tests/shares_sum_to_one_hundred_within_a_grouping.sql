-- Each grouping's bands are exhaustive, so their shares account for the whole
-- population. The tolerance is the rounding of the published share itself, half
-- of the last digit on each band, scaled by how many bands a grouping has.
select period, location_id, age_grouping, sum(share_of_population_pct) as total_share
from {{ ref('world_demography_age_structure') }}
group by period, location_id, age_grouping
having abs(sum(share_of_population_pct) - 100)
       > case when age_grouping = 'broad' then 0.00015 else 0.00105 end
