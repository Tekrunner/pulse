-- This file begins the year after the provider's estimates end, so a row at or
-- before the boundary would mean the snapshot's represented date no longer
-- describes where the estimated period stops.
select period
from {{ ref('world_demography_scenarios') }}
where extract(year from period) <= {{ var('estimate_boundary_year') }}
