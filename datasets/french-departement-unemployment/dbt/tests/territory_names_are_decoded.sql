-- The name is parsed out of the provider title. If INSEE changes that title
-- format the regex yields an empty string, which must fail loudly rather than
-- publish a map of blank labels.
select territory_code, territory_name
from {{ ref('french_departement_unemployment') }}
where territory_name is null or length(trim(territory_name)) = 0
