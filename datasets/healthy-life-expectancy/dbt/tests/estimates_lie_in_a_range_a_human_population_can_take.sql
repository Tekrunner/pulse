-- Physical bounds, not fitted thresholds: healthy life expectancy at birth is
-- positive and cannot exceed the longest life expectancy any population has
-- recorded, let alone the upper bound used for life expectancy itself.
select period, location_code, sex, healthy_life_expectancy_years
from {{ ref('healthy_life_expectancy') }}
where healthy_life_expectancy_years <= 0 or healthy_life_expectancy_years > 100
