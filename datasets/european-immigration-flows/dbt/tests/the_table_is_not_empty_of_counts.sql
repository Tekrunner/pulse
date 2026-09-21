-- Every column typing correctly while every count came back null would pass
-- every other test in this package and publish a table that answers nothing.
select count(immigration_persons) as published_counts
from {{ ref('european_immigration_flows') }}
having count(immigration_persons) = 0
