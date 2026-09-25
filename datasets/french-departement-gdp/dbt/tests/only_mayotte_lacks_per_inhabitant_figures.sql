-- Eurostat publishes GDP per inhabitant for every departement in every year
-- except Mayotte (976) before 2014: its GDP in euros starts in 2000, its
-- per-inhabitant figures only in 2014. Any other gap is a provider change a
-- reader needs to hear about, so it fails the build.
select period, departement_code
from {{ ref('french_departement_gdp') }}
where (gdp_per_inhabitant_eur is null or gdp_per_inhabitant_pps is null or gdp_per_inhabitant_index_france is null)
  and not (departement_code = '976' and period < date '2014-01-01')
