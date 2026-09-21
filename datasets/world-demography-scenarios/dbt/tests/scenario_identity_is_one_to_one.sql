-- A scenario is identified by the provider's code and by its label. If either
-- mapped to two of the other, a consumer selecting by one would silently get
-- rows from two different projections. Its kind is a property of the scenario,
-- so it must not vary within one either.
select scenario_id, scenario, scenario_kind
from (
  select
    scenario_id,
    count(distinct scenario) as labels_for_code,
    count(distinct scenario_kind) as kinds_for_code,
    any_value(scenario) as scenario,
    any_value(scenario_kind) as scenario_kind
  from {{ ref('world_demography_scenarios') }}
  group by scenario_id
) as by_code
where labels_for_code > 1 or kinds_for_code > 1

union all

select scenario_id, scenario, scenario_kind
from (
  select
    any_value(scenario_id) as scenario_id,
    scenario,
    count(distinct scenario_id) as codes_for_label,
    any_value(scenario_kind) as scenario_kind
  from {{ ref('world_demography_scenarios') }}
  group by scenario
) as by_label
where codes_for_label > 1
