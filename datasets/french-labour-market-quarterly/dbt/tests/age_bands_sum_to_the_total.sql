-- INSEE's three age bands partition the labour force, so their unemployment
-- counts must reconstruct the published total. A failure here means the
-- IDBANK-to-column map has picked up a series that is not what it claims.
-- The tolerance is the provider's own rounding: each series is published to the
-- nearest thousand, so three of them can drift from the total by up to 1.5.
select
  period,
  unemployed_thousands,
  unemployed_under_25_thousands + unemployed_25_to_49_thousands + unemployed_50_and_over_thousands
    as summed_thousands
from {{ ref('french_labour_market_quarterly') }}
where abs(
  unemployed_thousands
  - (unemployed_under_25_thousands + unemployed_25_to_49_thousands + unemployed_50_and_over_thousands)
) > 1.5
