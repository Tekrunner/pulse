-- Every declared OECD member and aggregate is published, so a member a reader
-- can select never silently vanishes and the list cannot drift from the
-- provider without the build saying so.
with declared as (
  select unnest([
    {%- for code in oecd_member_codes() + oecd_aggregate_codes() %}'{{ code }}'{{ ", " if not loop.last }}{% endfor -%}
  ]) as reference_area_code
)
select declared.reference_area_code
from declared
left join (select distinct reference_area_code from {{ ref('oecd_productivity_comparison') }}) as published
  using (reference_area_code)
where published.reference_area_code is null
