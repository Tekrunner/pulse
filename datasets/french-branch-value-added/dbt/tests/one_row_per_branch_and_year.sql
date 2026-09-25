-- Each branch appears once per year at its level.
select period, level, branch_code, count(*) as rows
from {{ ref('french_branch_value_added') }}
group by period, level, branch_code
having count(*) > 1
