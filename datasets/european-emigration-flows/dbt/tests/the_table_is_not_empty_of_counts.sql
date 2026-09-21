-- Every column typing correctly while every count came back null would pass
-- every other test in this package and publish a table that answers nothing.
select count(emigration_persons) as published_counts
from {{ ref('european_emigration_flows') }}
having count(emigration_persons) = 0
