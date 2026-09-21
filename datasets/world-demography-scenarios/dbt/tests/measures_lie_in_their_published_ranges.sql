-- Physical bounds on a human population, applied to the deterministic
-- scenarios. Natural change and net migration are deliberately absent: both are
-- legitimately negative, and two published scenarios set migration to zero by
-- construction.
--
-- The probabilistic scenarios are held only to non-negativity, because the
-- edges of the provider's distribution are not themselves populations. Its
-- lower bounds round a small country's population to zero at the far end of the
-- projection and report a median age above one hundred where they do; on four
-- rows they publish a median age of exactly zero beside an ordinary population,
-- which is a placeholder rather than an age. That is the provider's published
-- tail, not a defect, and a consumer drawing a band has to expect it.
select period, location_id, scenario_id
from {{ ref('world_demography_scenarios') }}
where
  case scenario_kind
    when 'deterministic' then
      population_thousands <= 0
      or total_fertility_rate < 0 or total_fertility_rate > 15
      or life_expectancy_years <= 0 or life_expectancy_years > 120
      or median_age_years <= 0 or median_age_years > 100
    else
      population_thousands < 0
      or total_fertility_rate < 0
      or life_expectancy_years <= 0
      or median_age_years < 0
  end
