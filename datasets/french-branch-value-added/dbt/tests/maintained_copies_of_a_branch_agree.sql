-- Where INSEE keeps more than one copy of a branch current, they carry the
-- same figure for every year this table publishes that branch at the copy's
-- level: choosing either copy must not change what is published.
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}
with latest as (
  select max(LAST_UPDATE) as release from {{ input_relation }}
),
maintained as (
  select
    split_part(CNA_ACTIVITE, '-', 1) as level, split_part(CNA_ACTIVITE, '-', 2) as branch_code,
    make_date(cast(TIME_PERIOD as integer), 1, 1) as period, cast(OBS_VALUE as double) as value,
    PRIX_REF as prix_ref
  from {{ input_relation }}, latest
  where OPERATION = 'B1G' and PRIX_REF in ('VAL', 'PCH') and CNA_TYPE_EMP is null
    and CNA_ACTIVITE like 'A%-%' and LAST_UPDATE = latest.release
)
select maintained.level, maintained.branch_code, maintained.period, maintained.prix_ref,
  maintained.value, published.value_added_current_eur_mn, published.value_added_chained_2020_eur_mn
from maintained
join {{ ref('french_branch_value_added') }} as published using (level, branch_code, period)
where abs(maintained.value - case maintained.prix_ref
  when 'VAL' then published.value_added_current_eur_mn
  else published.value_added_chained_2020_eur_mn end) > 0.05
