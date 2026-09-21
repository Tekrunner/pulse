-- The provider already identifies its countries by alpha-3 code, which is what
-- lets these rows be recognised beside another provider's. Its regions, income
-- groups and world total are its own classifications and carry none.
select distinct location_code, location_kind, iso3_code
from {{ ref('healthy_life_expectancy') }}
where (location_kind = 'country') = (iso3_code is null)
