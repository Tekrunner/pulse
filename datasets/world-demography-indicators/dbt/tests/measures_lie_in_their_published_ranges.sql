-- Physical bounds on a human population, not fitted thresholds. Population
-- change, natural change and net migration are deliberately absent: each may
-- legitimately be negative, and the provider publishes single-year falls as
-- steep as seventy per cent where a war or an expulsion moved people.
select period, location_id
from {{ ref('world_demography_indicators') }}
where
  population_thousands <= 0
  or births_thousands < 0
  or deaths_thousands < 0
  or total_fertility_rate < 0 or total_fertility_rate > 15
  or life_expectancy_years <= 0 or life_expectancy_years > 120
  or life_expectancy_male_years <= 0 or life_expectancy_male_years > 120
  or life_expectancy_female_years <= 0 or life_expectancy_female_years > 120
  or median_age_years <= 0 or median_age_years > 100
