-- Switzerland and New Zealand are OECD members that this monthly dataflow does
-- not carry. That gap is a known provider fact recorded as published, so
-- it is allowed here. Any OTHER member going missing is not, because it would
-- mean the membership list has drifted from what the OECD actually publishes.
{% set expected_absent = ['CHE', 'NZL'] %}
with members(reference_area_code) as (
  values {% for code in oecd_member_codes() %}('{{ code }}'){{ ", " if not loop.last }}{% endfor %}
)
select members.reference_area_code
from members
left join (
  select distinct reference_area_code from {{ ref('oecd_unemployment_comparison') }}
) as present on present.reference_area_code = members.reference_area_code
where present.reference_area_code is null
  and members.reference_area_code not in ({% for code in expected_absent %}'{{ code }}'{{ ", " if not loop.last }}{% endfor %})
