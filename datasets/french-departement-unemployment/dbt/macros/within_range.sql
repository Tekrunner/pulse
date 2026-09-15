{% test within_range(model, column_name, minimum, maximum) %}
{#
  A percentage that leaves 0-100, or a headcount that goes negative, is not a
  surprising number: it is evidence that the IDBANK-to-column map above has
  drifted from what the provider now serves. dbt core ships no numeric range
  test, so this package owns one rather than taking a dependency.
#}
select {{ column_name }}
from {{ model }}
where {{ column_name }} is not null
  and ({{ column_name }} < {{ minimum }} or {{ column_name }} > {{ maximum }})
{% endtest %}
