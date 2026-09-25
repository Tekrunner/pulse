select period, departement_code, count(*) as rows
from {{ ref('french_departement_gdp') }}
group by period, departement_code
having count(*) > 1
