select period, location_id, age_grouping, age_group
from {{ ref('world_demography_age_structure') }}
where population_male_thousands < 0
   or population_female_thousands < 0
   or population_total_thousands < 0
