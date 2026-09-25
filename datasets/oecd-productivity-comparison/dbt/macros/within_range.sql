{% test within_range(model, column_name, minimum, maximum) %}
{#
  A published ratio outside its plausible range means the screen in the model
  has let an inconsistent provider total through. dbt core ships no numeric
  range test, so this package owns one.
#}
select {{ column_name }}
from {{ model }}
where {{ column_name }} is not null
  and ({{ column_name }} < {{ minimum }} or {{ column_name }} > {{ maximum }})
{% endtest %}
