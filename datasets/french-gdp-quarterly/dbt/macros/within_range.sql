{% test within_range(model, column_name, minimum, maximum) %}
{#
  A negative GDP level or a quarterly change beyond any recorded French quarter
  means an IDBANK now feeds the wrong column. dbt core ships no numeric range
  test, so this package owns one.
#}
select {{ column_name }}
from {{ model }}
where {{ column_name }} is not null
  and ({{ column_name }} < {{ minimum }} or {{ column_name }} > {{ maximum }})
{% endtest %}
