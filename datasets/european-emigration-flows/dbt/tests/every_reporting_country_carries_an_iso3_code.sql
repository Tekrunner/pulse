-- The alpha-3 code is what lets a reporting country be recognised beside
-- another provider's rows. The mapping is declared in this package, so a code
-- the provider adds arrives unmapped and fails here rather than being invented.
select distinct geo_code, geo_kind, iso3_code
from {{ ref('european_emigration_flows') }}
where (geo_kind = 'country') = (iso3_code is null)
