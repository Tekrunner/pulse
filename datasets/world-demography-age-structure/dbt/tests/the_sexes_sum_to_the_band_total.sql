-- The provider rounds each column independently to three decimals of a
-- thousand, so the tolerance is half of the last published digit on each of the
-- two addends rather than a fitted allowance. Broad bands sum twenty-one such
-- roundings, so the allowance scales with the number of bands combined.
select period, location_id, age_grouping, age_group
from {{ ref('world_demography_age_structure') }}
where abs(population_male_thousands + population_female_thousands - population_total_thousands)
      > case when age_grouping = 'broad' then 0.021 else 0.001 end
