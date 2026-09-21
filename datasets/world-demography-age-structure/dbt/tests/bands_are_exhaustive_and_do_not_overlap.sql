-- Within a grouping the bands cover every age from zero upward with no gap and
-- no overlap, and exactly one band is open-ended at the top. Anything else
-- would make a share of the population mean something other than it says.
with bands as (
  select distinct age_grouping, age_group, age_start, age_end
  from {{ ref('world_demography_age_structure') }}
),
ordered as (
  select
    age_grouping, age_group, age_start, age_end,
    lag(age_end) over (partition by age_grouping order by age_start) as previous_end,
    count(*) filter (where age_end is null) over (partition by age_grouping) as open_ended
  from bands
)
select *
from ordered
where open_ended <> 1
   or (previous_end is null and age_start <> 0)
   or (previous_end is not null and age_start <> previous_end + 1)
