-- Countries and areas carry an ISO 3166-1 alpha-3 code, which is what lets a
-- consumer line them up with another provider's rows. The world total has none
-- because the provider publishes none, and that is the only permitted gap.
select distinct location_id, location_kind, iso3_code
from {{ ref('world_demography_age_structure') }}
where (location_kind = 'country') = (iso3_code is null)
