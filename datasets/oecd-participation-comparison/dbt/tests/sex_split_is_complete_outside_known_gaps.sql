-- A participation gap cannot be drawn from a total alone, so every area is
-- expected to carry all three sex breakdowns in every quarter it reports at
-- all. Brazil carries none at any date; Croatia and the OECD aggregate carry
-- none for 2007-2010. Those are provider history, declared here as exclusions
-- rather than by naming the few areas some report happens to draw.
{% set known_gaps = ['BRA', 'HRV', 'OECD'] %}
select period, reference_area_code, count(distinct sex) as sexes
from {{ ref('oecd_participation_comparison') }}
where reference_area_code not in ({% for code in known_gaps %}'{{ code }}'{{ ", " if not loop.last }}{% endfor %})
group by period, reference_area_code
having count(distinct sex) <> 3
