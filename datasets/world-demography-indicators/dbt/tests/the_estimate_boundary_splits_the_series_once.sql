-- Each location's estimated years all precede its projected years, and both
-- kinds are present. A location whose kinds interleaved would mean the
-- snapshot's represented date no longer describes where the estimates end.
select location_id
from {{ ref('world_demography_indicators') }}
group by location_id
having
  count(*) filter (where series_kind = 'estimate') = 0
  or count(*) filter (where series_kind = 'projection') = 0
  or max(period) filter (where series_kind = 'estimate')
     >= min(period) filter (where series_kind = 'projection')
