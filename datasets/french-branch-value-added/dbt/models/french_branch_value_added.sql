{#
  One row per year and branch at three nested levels of INSEE's nomenclature
  of activities: A10, A38 and A88. Each branch takes its value from the series
  INSEE maintains for it (`french_branch_value_added_resolved`).

  A level is published for a year only when every branch of that level has a
  value, so shares at a level always cover the whole economy: A10 from 1949,
  A38 from the first year all its branches are published, A88 from the first year
  all its published industries are.

  INSEE does not publish some A88 industries separately (printing, basic metals,
  security activities, coal and metal-ore mining, household own-account
  production). For each A38 branch missing any of its industries, one residual
  row carries the parent's value less that of its published industries, so the
  A88 level still adds up to A38. A residual is derived at current prices only:
  chained volumes do not subtract.
#}

with nomenclature as (
  select * from {{ ref('branch_nomenclature') }}
),
resolved as (
  select * from {{ ref('french_branch_value_added_resolved') }}
),
total as (
  select period, value as total_value_added
  from resolved
  where basis = 'current'
    and signature = (select string_agg(a88_code, ' ' order by a88_code) from nomenclature)
),
branches as (
  -- Every branch at the three published levels, with its parents and the A88
  -- industries it covers.
  select 'A10' as level, a10_code as branch_code, any_value(a10_label) as branch_label,
    null::varchar as parent_code, a10_code, null::varchar as a38_code,
    string_agg(a88_code, ' ' order by a88_code) as signature
  from nomenclature group by a10_code
  union all
  select 'A38', a38_code, any_value(a38_label), any_value(a10_code), any_value(a10_code), a38_code,
    string_agg(a88_code, ' ' order by a88_code)
  from nomenclature group by a38_code
  union all
  select 'A88', a88_code, a88_label, a38_code, a10_code, a38_code, a88_code
  from nomenclature
),
valued as (
  select
    branches.level, branches.branch_code, branches.branch_label, branches.parent_code,
    branches.a10_code, branches.a38_code, false as is_residual,
    current_prices.period,
    current_prices.value as value_added_current_eur_mn,
    chained.value as value_added_chained_2020_eur_mn
  from branches
  join resolved as current_prices
    on current_prices.signature = branches.signature and current_prices.basis = 'current'
  left join resolved as chained
    on chained.signature = branches.signature and chained.basis = 'chained_2020'
    and chained.period = current_prices.period
),
unpublished as (
  -- A88 industries with no series of their own, grouped by A38 parent.
  select
    nomenclature.a38_code,
    any_value(nomenclature.a10_code) as a10_code,
    string_agg(nomenclature.a88_code, '+' order by nomenclature.a88_code) as branch_code,
    string_agg(nomenclature.a88_label, '; ' order by nomenclature.a88_code) as branch_label
  from nomenclature
  where not exists (
    select 1 from valued
    where valued.level = 'A88' and valued.branch_code = nomenclature.a88_code
  )
  group by nomenclature.a38_code
),
residuals as (
  select
    'A88' as level, unpublished.branch_code, unpublished.branch_label,
    unpublished.a38_code as parent_code, unpublished.a10_code, unpublished.a38_code,
    true as is_residual, parent.period,
    parent.value_added_current_eur_mn - sum(child.value_added_current_eur_mn) as value_added_current_eur_mn,
    null::double as value_added_chained_2020_eur_mn
  from unpublished
  join valued as parent
    on parent.level = 'A38' and parent.branch_code = unpublished.a38_code
  join valued as child
    on child.level = 'A88' and child.parent_code = unpublished.a38_code and child.period = parent.period
  group by
    unpublished.branch_code, unpublished.branch_label, unpublished.a38_code, unpublished.a10_code,
    parent.period, parent.value_added_current_eur_mn
),
candidates as (
  select * from valued
  union all
  select * from residuals
),
branch_counts as (
  select level, count(distinct branch_code) as branches
  from candidates
  group by level
),
complete_years as (
  -- A level-year is kept only when every branch of the level has a value.
  -- For A88 the branches are the published industries plus the residuals.
  select candidates.level, candidates.period
  from candidates
  join branch_counts using (level)
  group by candidates.level, candidates.period, branch_counts.branches
  having count(*) = branch_counts.branches
)
select
  candidates.period,
  candidates.level,
  candidates.branch_code,
  candidates.branch_label,
  candidates.parent_code,
  candidates.a10_code,
  candidates.a38_code,
  candidates.is_residual,
  cast(candidates.value_added_current_eur_mn as decimal(18, 1)) as value_added_current_eur_mn,
  cast(candidates.value_added_chained_2020_eur_mn as decimal(18, 1)) as value_added_chained_2020_eur_mn,
  cast(100 * candidates.value_added_current_eur_mn / total.total_value_added as decimal(8, 3)) as share_of_total_value_added_pct
from candidates
join complete_years using (level, period)
join total using (period)
order by candidates.level, candidates.period, candidates.a10_code, candidates.a38_code nulls first, candidates.branch_code
