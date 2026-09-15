-- As in the monthly package, aggregates are classified but are not members, so
-- the membership test does not cover them. G7 is excluded: this quarterly
-- dataflow is known not to carry it, which is a provider fact the contract
-- records rather than a drift to catch.
{% set expected_absent = ['G7'] %}
with aggregates(reference_area_code) as (
  values {% for code in oecd_aggregate_codes() %}('{{ code }}'){{ ", " if not loop.last }}{% endfor %}
)
select aggregates.reference_area_code
from aggregates
left join (
  select distinct reference_area_code from {{ ref('oecd_participation_comparison') }}
) as present on present.reference_area_code = aggregates.reference_area_code
where present.reference_area_code is null
  and aggregates.reference_area_code not in ({% for code in expected_absent %}'{{ code }}'{{ ", " if not loop.last }}{% endfor %})
