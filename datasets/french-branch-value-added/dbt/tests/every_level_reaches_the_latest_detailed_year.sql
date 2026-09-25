-- The table is never empty, and each level reaches as far as the provider
-- publishes it: A10 and A38 to the latest year of total value added, A88 to
-- the latest year every maintained industry series reaches, which INSEE
-- publishes a year behind the total.
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}
with value_added as (
  select * from {{ input_relation }}
  where OPERATION = 'B1G' and PRIX_REF = 'VAL' and CNA_TYPE_EMP is null
),
industries as (
  select IDBANK, max(cast(TIME_PERIOD as integer)) as latest
  from value_added
  where CNA_ACTIVITE like 'A88-%' and LAST_UPDATE = (select max(LAST_UPDATE) from value_added)
  group by IDBANK
),
expected as (
  select 'A10' as level, max(cast(TIME_PERIOD as integer)) as latest from value_added where CNA_ACTIVITE = 'NNTOTAL'
  union all
  select 'A38', max(cast(TIME_PERIOD as integer)) from value_added where CNA_ACTIVITE = 'NNTOTAL'
  union all
  select 'A88', min(latest) from industries
),
published as (
  select level, max(year(period)) as latest
  from {{ ref('french_branch_value_added') }}
  group by level
)
select expected.level, expected.latest as expected_latest, published.latest as published_latest
from expected
left join published using (level)
where published.latest is distinct from expected.latest
