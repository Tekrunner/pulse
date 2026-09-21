-- Every location covers the same years, so a consumer that reaches any year
-- finds every location rather than a silently shorter list.
with per_location as (
  select location_id, count(*) as years
  from {{ ref('world_demography_indicators') }}
  group by location_id
)
select location_id, years
from per_location
where years <> (select max(years) from per_location)
