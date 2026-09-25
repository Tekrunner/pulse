-- A38 branches add up to their A10 parent and A88 industries, residual
-- included, to their A38 parent, at current prices. Maintained provider series
-- are rounded to a million euros; the tolerance allows half a million per
-- child.
with rows as (select * from {{ ref('french_branch_value_added') }})
select parent.period, parent.level, parent.branch_code,
  parent.value_added_current_eur_mn, sum(child.value_added_current_eur_mn) as children
from rows as parent
join rows as child
  on child.parent_code = parent.branch_code and child.period = parent.period
  and ((parent.level = 'A10' and child.level = 'A38') or (parent.level = 'A38' and child.level = 'A88'))
group by all
having abs(parent.value_added_current_eur_mn - sum(child.value_added_current_eur_mn)) > 0.5 * count(*) + 0.5
