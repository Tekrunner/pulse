{#
  One row per quarter and territory. The grain is deliberately long rather than
  one column per territory: a hundred departements as a hundred columns would
  make every consumer re-derive the territorial hierarchy from column names.

  The territory name is decoded from the provider title, which INSEE writes as
  "Taux de chomage localise par <niveau> - <nom>". The level word is not used to
  classify the territory, because INSEE labels the two national reference series
  "par region"; the REF_AREA code is the classifier instead.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('insee-local-unemployment publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}

with decoded as (
  select
    make_date(
      cast(substr(TIME_PERIOD, 1, 4) as integer),
      (cast(substr(TIME_PERIOD, 7, 1) as integer) - 1) * 3 + 1,
      1
    ) as period,
    REF_AREA as provider_ref_area,
    case
      when REF_AREA in ('FM', 'FR-D976') then 'country'
      when starts_with(REF_AREA, 'R') then 'region'
      else 'departement'
    end as territory_kind,
    -- Departements are keyed by their bare INSEE code so the map geometry joins
    -- without any translation; regions and national references keep the
    -- provider code, which is already their natural key.
    case when starts_with(REF_AREA, 'D') and REF_AREA <> 'FR-D976'
      then substr(REF_AREA, 2)
      else REF_AREA
    end as territory_code,
    trim(regexp_extract(TITLE_FR, '^Taux de chômage localisé par (?:département|région) - (.*)$', 1))
      as territory_name,
    cast(OBS_VALUE as double) as unemployment_rate_pct
  from {{ input_relation }}
  where regexp_matches(TIME_PERIOD, '^\d{4}-Q[1-4]$')
)
select
  period,
  territory_kind,
  territory_code,
  territory_name,
  provider_ref_area,
  cast(unemployment_rate_pct as decimal(10, 1)) as unemployment_rate_pct
from decoded
order by period, territory_kind, territory_code
