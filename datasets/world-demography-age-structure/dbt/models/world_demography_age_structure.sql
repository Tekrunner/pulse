{#
  One typed row per location, calendar year, age grouping and age group.

  The table carries two groupings of the same population. The provider's own
  twenty-one five-year groups are read as published; the three broad groups —
  young, working age and old — are summed from them here, because the provider
  does not publish them in this file and summing exhaustive, non-overlapping
  bands is the only way to obtain them without a second source. Both groupings
  share the grain, so neither repeats the other's rows.
#}

{% if var('snapshot_format') != 'original-file' %}
  {{ exceptions.raise_compiler_error('unsupported snapshot format') }}
{% endif %}

{% set declared_text = [
  'LocID', 'ISO3_code', 'LocTypeName', 'Location', 'Variant', 'Time',
  'AgeGrp', 'AgeGrpStart', 'AgeGrpSpan', 'PopMale', 'PopFemale', 'PopTotal'
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
    "AgeGrp" as age_group,
    cast("AgeGrpStart" as integer) as age_start,
    -- The provider marks its open-ended top group with a span of -1.
    case
      when cast("AgeGrpSpan" as integer) < 0 then null
      else cast("AgeGrpStart" as integer) + cast("AgeGrpSpan" as integer) - 1
    end as age_end,
    cast("PopMale" as decimal(18, 3)) as population_male_thousands,
    cast("PopFemale" as decimal(18, 3)) as population_female_thousands,
    cast("PopTotal" as decimal(18, 3)) as population_total_thousands
  from {{ input_relation }}
  where
    -- The provider's own world aggregate, and its countries and areas. Its
    -- regional, development and income groupings answer a different question
    -- and are not part of this table's grain.
    "LocTypeName" in ('World', 'Country/Area')
    -- Every row of this file reads the medium scenario; asserting it here means
    -- a file that silently mixed scenarios would fail rather than double the
    -- grain.
    and "Variant" = 'Medium'
),

five_year as (
  select
    period, location_id, iso3_code, location_name, location_kind, series_kind,
    'five-year' as age_grouping,
    age_group, age_start, age_end,
    population_male_thousands, population_female_thousands, population_total_thousands
  from published
),

broad as (
  select
    period, location_id, iso3_code, location_name, location_kind, series_kind,
    'broad' as age_grouping,
    case
      when age_start < 15 then '0-14'
      when age_start < 65 then '15-64'
      else '65+'
    end as age_group,
    case
      when age_start < 15 then 0
      when age_start < 65 then 15
      else 65
    end as age_start,
    case
      when age_start < 15 then 14
      when age_start < 65 then 64
      else null
    end as age_end,
    -- Summing a DECIMAL(18,3) widens it to DECIMAL(38,3), which the union
    -- below would then promote for the provider's own bands too. A population
    -- in thousands does not need the extra digits, so the width is restated.
    cast(sum(population_male_thousands) as decimal(18, 3)) as population_male_thousands,
    cast(sum(population_female_thousands) as decimal(18, 3)) as population_female_thousands,
    cast(sum(population_total_thousands) as decimal(18, 3)) as population_total_thousands
  from published
  group by all
),

combined as (
  select * from five_year
  union all
  select * from broad
)

select
  period, location_id, iso3_code, location_name, location_kind, series_kind,
  age_grouping, age_group, age_start, age_end,
  population_male_thousands, population_female_thousands, population_total_thousands,
  cast(
    100.0 * population_total_thousands
    / sum(population_total_thousands) over (partition by period, location_id, age_grouping)
    as decimal(9, 4)
  ) as share_of_population_pct
from combined
order by location_id, period, age_grouping, age_start
