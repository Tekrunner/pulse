{#
  One wide row per quarter, pivoted from the snapshot's long IDBANK/observation
  shape. The IDBANK-to-column map below is the analytical heart of this package:
  the snapshot carries no INDICATEUR, SEXE or AGE attribute when series are
  fetched by IDBANK, so the provider's meaning is re-attached here, against the
  French catalogue titles recorded in the source declaration.

  Only quarters carrying every declared series are kept. The unemployment counts
  reach back to 1975 while the rates, halo, underemployment and activity series
  begin in 2003-Q1, so a wider window would publish a half-empty table whose
  not-null tests could not mean anything.
#}

{% if var('snapshot_format') != 'parquet' %}
  {{ exceptions.raise_compiler_error('insee-labour-market publishes provider-native Parquet rows') }}
{% endif %}
{% set input_relation = "read_parquet('" ~ var('snapshot_path') | replace("'", "''") ~ "')" %}

{% set series = {
  '011818543': 'unemployment_rate_pct',
  '011818548': 'unemployment_rate_under_25_pct',
  '011818544': 'unemployment_rate_25_to_49_pct',
  '011818545': 'unemployment_rate_50_and_over_pct',
  '011818547': 'unemployment_rate_men_pct',
  '011818546': 'unemployment_rate_women_pct',
  '011818555': 'unemployed_thousands',
  '011818599': 'unemployed_under_25_thousands',
  '011818598': 'unemployed_25_to_49_thousands',
  '011818600': 'unemployed_50_and_over_thousands',
  '011818596': 'unemployed_men_thousands',
  '011818592': 'unemployed_women_thousands',
  '011818577': 'long_term_unemployed_thousands',
  '011818581': 'long_term_unemployment_rate_pct',
  '011818564': 'halo_thousands',
  '011818560': 'halo_15_to_64_thousands',
  '011818623': 'halo_share_of_population_15_to_64_pct',
  '011818739': 'underemployed_thousands',
  '011818670': 'underemployment_rate_pct',
  '011818680': 'participation_rate_pct',
  '011818665': 'participation_rate_men_pct',
  '011818704': 'participation_rate_women_pct',
  '011818737': 'participation_rate_15_to_64_pct',
  '011818644': 'participation_rate_men_15_to_64_pct',
  '011818710': 'participation_rate_women_15_to_64_pct'
} %}

with observed as (
  select
    IDBANK as idbank,
    TIME_PERIOD as provider_period,
    -- The first day of the quarter the observation describes. The provider
    -- writes quarters as YYYY-Qn; nothing else is accepted.
    make_date(
      cast(substr(TIME_PERIOD, 1, 4) as integer),
      (cast(substr(TIME_PERIOD, 7, 1) as integer) - 1) * 3 + 1,
      1
    ) as period,
    cast(OBS_VALUE as double) as value
  from {{ input_relation }}
  where regexp_matches(TIME_PERIOD, '^\d{4}-Q[1-4]$')
    and IDBANK in ({% for idbank in series %}{{ "'" ~ idbank ~ "'" }}{{ ", " if not loop.last }}{% endfor %})
),
pivoted as (
  select
    period,
    {%- for idbank, column in series.items() %}
    max(case when idbank = '{{ idbank }}' then value end) as {{ column }}{{ "," if not loop.last }}
    {%- endfor %}
  from observed
  group by period
),
complete as (
  select * from pivoted
  where {% for column in series.values() %}{{ column }} is not null{{ " and " if not loop.last }}{% endfor %}
)
select
  period,
  {%- for column in series.values() %}
  cast({{ column }} as decimal(10, 1)) as {{ column }}{{ "," if not loop.last }}
  {%- endfor %}
from complete
order by period
