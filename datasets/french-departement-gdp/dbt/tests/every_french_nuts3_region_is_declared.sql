-- Every French NUTS 3 region Eurostat publishes, other than the extra-regio
-- territory, is a declared departement; a NUTS revision that recodes one fails
-- the build instead of dropping it.
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}
select distinct geo
from {{ input_relation }}
where geo like 'FR___' and geo <> 'FRZZZ'
  and geo not in (select nuts3_code from {{ ref('nuts3_departements') }})
