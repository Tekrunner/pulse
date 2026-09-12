-- Replace the package model atomically with its contract and all consumers.
-- This neutral fixture demonstrates an additive typed column; it contains no
-- provider, report, or visual-specific behavior.
select
  period,
  example_value,
  round(example_value * 100, 0)::bigint as example_value_minor_units
from {{ ref('example_dataset') }}
