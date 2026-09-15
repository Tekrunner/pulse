-- The membership test covers every OECD member. Aggregates are classified
-- here too but are not members, so without this they would be the one class of
-- area that could silently disappear -- and a report comparing France to "the
-- EU" or "the OECD" would quietly render one series fewer.
with aggregates(reference_area_code) as (
  values {% for code in oecd_aggregate_codes() %}('{{ code }}'){{ ", " if not loop.last }}{% endfor %}
)
select aggregates.reference_area_code
from aggregates
left join (
  select distinct reference_area_code from {{ ref('oecd_unemployment_comparison') }}
) as present on present.reference_area_code = aggregates.reference_area_code
where present.reference_area_code is null
