{% test within_range(model, column_name, minimum, maximum) %}
{#
  A share outside 0-100 or a negative level is not a surprising number: it
  means a branch has been resolved to the wrong provider series. dbt core ships
  no numeric range test, so this package owns one.
#}
select {{ column_name }}
from {{ model }}
where {{ column_name }} is not null
  and ({{ column_name }} < {{ minimum }} or {{ column_name }} > {{ maximum }})
{% endtest %}
