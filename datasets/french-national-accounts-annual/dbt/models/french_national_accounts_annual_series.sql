{{ config(materialized='view') }}
{#
  Every provider observation that one of the declared selectors claims,
  labelled with the column it feeds. A view, not a published table: it exists
  so the selection itself can be tested.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('insee-annual-national-accounts publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}
{% set selectors = series_selectors() %}

with observed as (
  select
    case
      {%- for column, selector in selectors.items() %}
      when {{ selector }} then '{{ column }}'
      {%- endfor %}
    end as series,
    IDBANK as idbank,
    make_date(cast(TIME_PERIOD as integer), 1, 1) as period,
    cast(OBS_VALUE as double) as value
  from {{ input_relation }}
  where regexp_matches(TIME_PERIOD, '^\d{4}$')
)
select * from observed where series is not null
