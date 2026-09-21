-- Where the provider publishes an interval it must contain the estimate it
-- belongs to. Rows without an interval are not judged here; that is what the
-- companion pairing test is for.
select period, location_code, sex, healthy_life_expectancy_years, uncertainty_low_years, uncertainty_high_years
from {{ ref('healthy_life_expectancy') }}
where uncertainty_low_years is not null
  and uncertainty_high_years is not null
  and healthy_life_expectancy_years not between uncertainty_low_years and uncertainty_high_years
