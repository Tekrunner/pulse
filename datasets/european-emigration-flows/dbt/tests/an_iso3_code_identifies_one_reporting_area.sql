-- Two reporting areas sharing an alpha-3 code would silently merge when a
-- consumer lines this table up with another provider's.
select iso3_code, count(distinct geo_code) as areas
from {{ ref('european_emigration_flows') }}
where iso3_code is not null
group by iso3_code
having count(distinct geo_code) > 1
