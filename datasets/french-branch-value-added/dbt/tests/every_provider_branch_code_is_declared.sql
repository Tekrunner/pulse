-- Every branch code the provider publishes value added under is one this
-- package's nomenclature declares. An undeclared code means INSEE changed its
-- nomenclature and a branch would silently drop out of the table.
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}
with provider as (
  select distinct split_part(CNA_ACTIVITE, '-', 1) as level, split_part(CNA_ACTIVITE, '-', 2) as code
  from {{ input_relation }}
  where OPERATION = 'B1G' and CNA_TYPE_EMP is null and CNA_ACTIVITE like 'A%-%'
),
declared as (
  select 'A88' as level, a88_code as code from {{ ref('branch_nomenclature') }}
  union select 'A38', a38_code from {{ ref('branch_nomenclature') }}
  union select 'A17', a17_code from {{ ref('branch_nomenclature') }}
  union select 'A10', a10_code from {{ ref('branch_nomenclature') }}
  union select 'A5', a5_code from {{ ref('branch_nomenclature') }}
)
select provider.* from provider
left join declared using (level, code)
where declared.code is null
