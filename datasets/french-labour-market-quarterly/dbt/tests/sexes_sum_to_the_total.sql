-- Men and women partition the labour force in this classification, so their
-- unemployment counts must reconstruct the published total, within the
-- provider's own rounding to the nearest thousand.
select
  period,
  unemployed_thousands,
  unemployed_men_thousands + unemployed_women_thousands as summed_thousands
from {{ ref('french_labour_market_quarterly') }}
where abs(unemployed_thousands - (unemployed_men_thousands + unemployed_women_thousands)) > 1.0
