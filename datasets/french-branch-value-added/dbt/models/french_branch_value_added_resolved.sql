{{ config(materialized='view') }}
{#
  One value per branch, year and price basis, taken from the provider series
  that INSEE still maintains for that branch.

  INSEE publishes a branch under every nomenclature level at which it is
  defined, and keeps only one of those copies current: construction is A5-FZ,
  A10-FZ, A17-FZ and A38-FZ, and only A10-FZ advances; telecommunications has no
  A38 series at all and is published only as A88-61. Two provider codes name the
  same branch exactly when they cover the same set of A88 industries, so each
  provider series is keyed here by that set — its `signature` — and every
  signature takes its values from its most recently updated series. The copies left
  behind are an older vintage, not a different measure.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('insee-annual-national-accounts publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}

with nomenclature as (
  select * from {{ ref('branch_nomenclature') }}
),
membership as (
  -- Every provider code at every level, with the A88 industries it covers.
  select 'A88' as level, a88_code as code, a88_code from nomenclature
  union all select 'A38', a38_code, a88_code from nomenclature
  union all select 'A17', a17_code, a88_code from nomenclature
  union all select 'A10', a10_code, a88_code from nomenclature
  union all select 'A5', a5_code, a88_code from nomenclature
  union all select 'NNTOTAL', 'NNTOTAL', a88_code from nomenclature
),
signatures as (
  select level, code, string_agg(a88_code, ' ' order by a88_code) as signature
  from membership
  group by level, code
),
provider as (
  select
    -- `A38-CL` is level A38, code CL; the total economy is `NNTOTAL`.
    case when CNA_ACTIVITE = 'NNTOTAL' then 'NNTOTAL' else split_part(CNA_ACTIVITE, '-', 1) end as level,
    case when CNA_ACTIVITE = 'NNTOTAL' then 'NNTOTAL' else split_part(CNA_ACTIVITE, '-', 2) end as code,
    IDBANK as idbank,
    LAST_UPDATE as last_update,
    case PRIX_REF when 'VAL' then 'current' when 'PCH' then 'chained_2020' end as basis,
    make_date(cast(TIME_PERIOD as integer), 1, 1) as period,
    cast(OBS_VALUE as double) as value
  from {{ input_relation }}
  where OPERATION = 'B1G'
    and PRIX_REF in ('VAL', 'PCH')
    and CNA_TYPE_EMP is null
    and (CNA_ACTIVITE like 'A%-%' or CNA_ACTIVITE = 'NNTOTAL')
    and regexp_matches(TIME_PERIOD, '^\d{4}$')
),
keyed as (
  select provider.*, signatures.signature
  from provider
  join signatures using (level, code)
),
chosen as (
  -- One series per branch and price basis, used for every year it covers:
  -- the most recently updated, and among equally current copies the one with
  -- the longest history. Choosing year by year instead would splice an older
  -- vintage onto a newer one wherever their coverage differs. Real estate is
  -- the one branch with two current copies that disagree: A88-68 differs from
  -- A10-LZ before 1993, and A10-LZ, the longer, is the one that adds up with
  -- the other A10 branches to total value added.
  select signature, basis, idbank
  from (
    select
      signature, basis, idbank,
      row_number() over (
        partition by signature, basis order by last_update desc, years desc, idbank
      ) as preference
    from (
      select signature, basis, idbank, last_update, count(*) as years
      from keyed
      group by signature, basis, idbank, last_update
    )
  )
  where preference = 1
)
select keyed.signature, keyed.basis, keyed.period, keyed.value, keyed.idbank, keyed.last_update
from keyed
join chosen using (signature, basis, idbank)
