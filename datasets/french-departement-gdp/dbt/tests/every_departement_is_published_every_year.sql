-- Every declared departement has a row in every year the table covers, so no
-- year is missing a departement the provider publishes. A departement the
-- provider stops publishing fails the build here rather than vanishing.
with years as (select distinct period from {{ ref('french_departement_gdp') }}),
expected as (
  select years.period, departements.departement_code
  from years cross join {{ ref('nuts3_departements') }} as departements
)
select expected.period, expected.departement_code
from expected
left join {{ ref('french_departement_gdp') }} as published using (period, departement_code)
where published.departement_code is null
