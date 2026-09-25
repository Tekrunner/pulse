{% test within_range(model, column_name, minimum, maximum) %}
{#
  A share outside 0-100, a negative level or a growth rate beyond any recorded
  French year is not a surprising number: it means a selector now claims a
  different series from the one its column describes. dbt core ships no numeric
  range test, so this package owns one.
#}
select {{ column_name }}
from {{ model }}
where {{ column_name }} is not null
  and ({{ column_name }} < {{ minimum }} or {{ column_name }} > {{ maximum }})
{% endtest %}
