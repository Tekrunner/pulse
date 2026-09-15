-- Unlike the monthly unemployment dataflow, this quarterly one does carry
-- Switzerland and New Zealand, so every member on the list must appear. A
-- missing member here means the membership list has drifted from the provider.
with members(reference_area_code) as (
  values {% for code in oecd_member_codes() %}('{{ code }}'){{ ", " if not loop.last }}{% endfor %}
)
select members.reference_area_code
from members
left join (
  select distinct reference_area_code from {{ ref('oecd_participation_comparison') }}
) as present on present.reference_area_code = members.reference_area_code
where present.reference_area_code is null
