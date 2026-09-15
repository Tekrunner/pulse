-- The grain is (period, territory_code). dbt's built-in unique test covers one
-- column, so the compound key is asserted here.
select period, territory_code, count(*) as rows_for_key
from {{ ref('french_departement_unemployment') }}
group by period, territory_code
having count(*) > 1
