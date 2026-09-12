{% if var('snapshot_format') == 'parquet' %}
  {% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}
{% elif var('snapshot_format') == 'original-file' %}
  {% set input_relation = "read_csv('" ~ var('snapshot_path') | replace("'", "''") ~ "', header=true, types={'period':'VARCHAR','value':'VARCHAR'}, strict_mode=true)" %}
{% else %}
  {{ exceptions.raise_compiler_error('unsupported snapshot format') }}
{% endif %}

select
  strptime(period, '%Y-%m')::date as period,
  value::decimal(18, 2) as example_value
from {{ input_relation }}
