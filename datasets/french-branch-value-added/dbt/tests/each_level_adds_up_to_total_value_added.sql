-- Every published level partitions the economy: its branches' shares of total
-- value added at current prices add up to 100. Maintained provider series are
-- rounded to a million euros and each share to a thousandth of a point, so the
-- tolerance grows with the number of branches at the level.
select period, level, sum(share_of_total_value_added_pct) as summed_share, count(*) as branches
from {{ ref('french_branch_value_added') }}
group by period, level
having abs(sum(share_of_total_value_added_pct) - 100) > 0.002 * count(*) + 0.01
