{#
  One typed row per location and calendar year, for the world total and every
  country or area the provider publishes.

  The snapshot is a gzip-compressed provider CSV, so every field this model
  reads is declared as text and cast here. Silent inference is not the
  contract: a column the provider renames or retypes must fail the build rather
  than arrive as a plausible-looking null.
#}

{% if var('snapshot_format') != 'original-file' %}
  {{ exceptions.raise_compiler_error('unsupported snapshot format') }}
{% endif %}

{% set declared_text = [
  'LocID', 'ISO3_code', 'LocTypeName', 'Location', 'Variant', 'Time',
  'TPopulation1July', 'PopChange', 'PopGrowthRate', 'NatChange', 'NatChangeRT',
  'NetMigrations', 'CNMR', 'Births', 'CBR', 'Deaths', 'CDR', 'TFR',
  'LEx', 'LExMale', 'LExFemale', 'MedianAgePop'
] %}
{% set types = [] %}
{% for column in declared_text %}
  {% do types.append("'" ~ column ~ "': 'VARCHAR'") %}
{% endfor %}

{% set input_relation %}
  read_csv(
    '{{ var('snapshot_path') | replace("'", "''") }}',
    header = true,
    -- Location names carry commas: "China, Hong Kong SAR". Auto-detection has
    -- read this provider's files with no quote character at all, which splits
    -- such a row into one column too many, so the dialect is pinned here.
    quote = '"',
    escape = '"',
    strict_mode = true,
    types = {{ '{' ~ types | join(', ') ~ '}' }}
  )
{% endset %}

with published as (
  select *
  from {{ input_relation }}
  where
    -- The provider's own world aggregate, and its countries and areas. Its
    -- regional, development and income groupings answer a different question
    -- and are not part of this table's grain.
    "LocTypeName" in ('World', 'Country/Area')
    -- Every row of this file reads the medium scenario; the alternative
    -- scenarios are a separate publication. Asserting it here means a file
    -- that silently mixed scenarios would fail rather than double the grain.
    and "Variant" = 'Medium'
    -- The provider closes the file with a 1 January row for the year after the
    -- projection horizon. It carries a population stock and none of the flows
    -- or rates below, so it is not an observation of this table's grain.
    and "TPopulation1July" is not null
)

select
  make_date(cast("Time" as integer), 1, 1) as period,
  cast("LocID" as integer) as location_id,
  nullif("ISO3_code", '') as iso3_code,
  "Location" as location_name,
  case when "LocTypeName" = 'World' then 'world' else 'country' end as location_kind,
  case
    when cast("Time" as integer) <= {{ var('estimate_boundary_year') }} then 'estimate'
    else 'projection'
  end as series_kind,
  cast("TPopulation1July" as decimal(18, 3)) as population_thousands,
  cast("PopChange" as decimal(18, 3)) as population_change_thousands,
  cast("PopGrowthRate" as decimal(9, 4)) as population_growth_rate_pct,
  cast("NatChange" as decimal(18, 3)) as natural_change_thousands,
  cast("NatChangeRT" as decimal(9, 4)) as natural_change_rate_per_1000,
  cast("NetMigrations" as decimal(18, 3)) as net_migration_thousands,
  cast("CNMR" as decimal(9, 4)) as net_migration_rate_per_1000,
  cast("Births" as decimal(18, 3)) as births_thousands,
  cast("CBR" as decimal(9, 4)) as crude_birth_rate_per_1000,
  cast("Deaths" as decimal(18, 3)) as deaths_thousands,
  cast("CDR" as decimal(9, 4)) as crude_death_rate_per_1000,
  cast("TFR" as decimal(9, 4)) as total_fertility_rate,
  cast("LEx" as decimal(9, 4)) as life_expectancy_years,
  cast("LExMale" as decimal(9, 4)) as life_expectancy_male_years,
  cast("LExFemale" as decimal(9, 4)) as life_expectancy_female_years,
  cast("MedianAgePop" as decimal(9, 4)) as median_age_years
from published
order by location_id, period
