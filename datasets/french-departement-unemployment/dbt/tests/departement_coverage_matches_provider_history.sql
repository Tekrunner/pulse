-- The territorial panel is not rectangular, and pretending otherwise would
-- either throw away 32 years of metropolitan history or publish a map with
-- silent holes. INSEE publishes the 96 metropolitan departements from 1982-Q1
-- and the four overseas ones only from 2014-Q1, so that is what is asserted:
-- every quarter carries all 96 metropolitan departements, and every quarter
-- from 2014-Q1 carries all 100. A design that lets a reader reach a quarter
-- before 2014 must show the overseas departements as unpublished, not as zero.
with by_quarter as (
  select
    period,
    count(*) filter (where territory_code in ('971', '972', '973', '974')) as overseas,
    count(*) filter (where territory_code not in ('971', '972', '973', '974')) as metropolitan
  from {{ ref('french_departement_unemployment') }}
  where territory_kind = 'departement'
  group by period
)
select period, metropolitan, overseas
from by_quarter
where metropolitan <> 96
   or (period >= date '2014-01-01' and overseas <> 4)
   or (period < date '2014-01-01' and overseas <> 0)
