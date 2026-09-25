-- The labour-input screen exists for two known provider inconsistencies. If
-- any other area starts failing it, the provider has changed something that a
-- reader of the table needs to hear about, so the build fails rather than
-- quietly blanking another country's ratios.
select distinct reference_area_code
from {{ ref('oecd_productivity_comparison') }}
where labour_input_is_plausible = false
  and reference_area_code not in ('NZL', 'PER')
