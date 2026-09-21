-- The provider's own accounting: natural change is births minus deaths. This
-- holds exactly at the precision it publishes, so the tolerance below is half
-- of the last published digit rather than a fitted allowance.
select period, location_id, natural_change_thousands, births_thousands, deaths_thousands
from {{ ref('world_demography_indicators') }}
where abs(natural_change_thousands - (births_thousands - deaths_thousands)) > 0.0005
