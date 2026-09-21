{#
  One typed row per location, projected year and published scenario.

  Every row of this table is a projection: the provider publishes this file only
  from the year after its estimates end. The measure columns are nullable
  because a scenario need not carry every measure — the probabilistic mean, for
  instance, is published as a fertility summary and carries no population.
#}

{% if var('snapshot_format') != 'original-file' %}
  {{ exceptions.raise_compiler_error('unsupported snapshot format') }}
{% endif %}

{% set declared_text = [
  'LocID', 'ISO3_code', 'LocTypeName', 'Location', 'VarID', 'Variant', 'Time',
  'TPopulation1July', 'PopGrowthRate', 'NatChange', 'NetMigrations',
  'TFR', 'LEx', 'MedianAgePop'
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
    -- The provider closes the file with a 1 January row for the year after the
    -- projection horizon. It carries a population stock and none of the
    -- measures below, so it is not an observation of this table's grain.
    and cast("Time" as integer) <= {{ var('projection_horizon_year') }}
)

select
  make_date(cast("Time" as integer), 1, 1) as period,
  cast("LocID" as integer) as location_id,
  nullif("ISO3_code", '') as iso3_code,
  "Location" as location_name,
  case when "LocTypeName" = 'World' then 'world' else 'country' end as location_kind,
  cast("VarID" as integer) as scenario_id,
  "Variant" as scenario,
  -- The provider publishes two kinds of projection in one file. Most scenarios
  -- are deterministic: fix an assumption, run it forward. Six summarize its
  -- probabilistic projection, and their tails behave differently — a lower
  -- bound can round a small population to zero and carry a median age no human
  -- population could have. Naming the kind lets a consumer, and this package's
  -- own range test, tell a what-if path from a distribution's edge.
  case
    when "Variant" in ('Median PI', 'Mean', 'Lower 80 PI', 'Upper 80 PI', 'Lower 95 PI', 'Upper 95 PI')
      then 'probabilistic'
    else 'deterministic'
  end as scenario_kind,
  cast("TPopulation1July" as decimal(18, 3)) as population_thousands,
  cast("PopGrowthRate" as decimal(9, 4)) as population_growth_rate_pct,
  cast("NatChange" as decimal(18, 3)) as natural_change_thousands,
  cast("NetMigrations" as decimal(18, 3)) as net_migration_thousands,
  cast("TFR" as decimal(9, 4)) as total_fertility_rate,
  cast("LEx" as decimal(9, 4)) as life_expectancy_years,
  cast("MedianAgePop" as decimal(9, 4)) as median_age_years
from published
order by scenario_id, location_id, period
