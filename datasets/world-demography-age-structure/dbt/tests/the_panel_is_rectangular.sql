-- Every location covers the same years, and every location-year the same
-- bands, so a consumer reaching any year finds a complete age structure rather
-- than a silently shorter one.
with per_location_year as (
  select location_id, period, count(*) as bands
  from {{ ref('world_demography_age_structure') }}
  group by location_id, period
),
per_location as (
  select location_id, count(*) as years from per_location_year group by location_id
)
select location_id, period, bands
from per_location_year
where bands <> (select max(bands) from per_location_year)
   or location_id in (
     select location_id from per_location
     where years <> (select max(years) from per_location)
   )
