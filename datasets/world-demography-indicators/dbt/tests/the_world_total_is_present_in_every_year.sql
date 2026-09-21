-- The provider publishes its own world aggregate, and a consumer reading any
-- year must find it. A year in which it went missing would make the world
-- series discontinuous without anything failing.
select period
from {{ ref('world_demography_indicators') }}
group by period
having count(*) filter (where location_kind = 'world') <> 1
