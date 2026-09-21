# Healthy life expectancy dataset contract

`dataset-contract.yaml` is authoritative. This file records what a consumer has
to know that a schema cannot say.

## What this table is

One row per location, reference year and sex: healthy life expectancy at birth
in years, with the uncertainty interval the provider publishes around it. 12,936
rows, 2000 to 2021, read from the `who-healthy-life-expectancy` snapshot.

## The licence reaches past this package

This is the only source in this repository that is not published under an open
licence. The World Health Organization grants its own terms: use for **public
health purposes**, with attribution in a prescribed format, no onward sale or
transfer, no use in commercial promotion, and **prior written authorization for
any alteration or modification of the datasets**, where alteration expressly
includes abbreviations, additions and deletions.

Two consequences shape this package.

First, **no row is dropped**. The table keeps every location the provider
returns, including its regional, World Bank income-group and global aggregates,
because selecting a subset would be a deletion under that clause. The country
universe a consumer wants is applied in the consumer's own query.

Second, **anything redistributing this table inherits those terms**. A consumer
placing this beside the CC BY 3.0 IGO population series cannot fold both into
one shared credit line: the provenance for this measure has to name WHO and its
licence on its own.

The repository owner was shown the quoted clauses on 16 September 2026 and
accepted them, on the judgement that a private, non-commercial report falls
within the grant. That decision, and the clauses themselves, are recorded in
`sources/who-healthy-life-expectancy/source-contract.md`. No prior written
authorization has been sought or obtained for the typing and renaming this model
performs.

## What the measure is, and what it is not

Healthy life expectancy is the average number of years a newborn would live in
full health under the year's rates of death *and of ill health*. It is derived
from the provider's Global Health Estimates, which weight years lived by
modelled disability across causes. It is a modelled quantity, not an observed
one.

It is therefore **not** comparable with Eurostat's "healthy life years", which
counts years free of self-reported activity limitation from a household survey.
The two have similar names and measure different things. Eurostat's indicator
was evaluated for this need and rejected on coverage, not on quality.

Placed beside `world-demography-indicators.life_expectancy_years` it reads
naturally — expected years, and expected years in good health — but the two come
from different providers with different methods, and the difference between them
is not a published quantity.

## The window is short, and it does not move

2000 to 2021, against a life-expectancy series running 1950 to 2100. A consumer
placing both on one time axis will find this one stopping decades short at both
ends, and `test_healthy_life_expectancy_stops_well_short_of_the_life_expectancy_series`
pins that gap so it is discovered by a test rather than by a reader.

The provider restates the whole series when it revises rather than appending to
it, so both ends of this table's period can move between snapshots.

## Uncertainty intervals are published as a pair, or not at all

`uncertainty_low_years` and `uncertainty_high_years` are nullable: the provider
publishes an estimate without an interval on a small number of rows. Demanding
an interval would discard estimates it does publish.
`the_interval_is_published_as_a_pair_or_not_at_all` asserts that no row ever
carries one bound alone, so a consumer drawing a band never gets one with an
edge missing.

## Identity

`location_code` is the provider's spatial code. For a country it is already an
ISO 3166-1 alpha-3 code, which is what lets these rows be recognised beside the
World Population Prospects tables; `iso3_code` repeats it only for countries and
is null on the provider's own aggregates, which are not countries.

`sex` is `total`, `male` or `female`, renamed from the provider's `SEX_BTSX`,
`SEX_MLE` and `SEX_FMLE`. Every location-year carries all three, asserted by
`every_location_year_carries_all_three_sexes`.

## Refresh behaviour

Irregular. The provider publishes no release calendar for this indicator: the
observed Global Health Estimates rounds arrived in 2018, December 2020 and
August 2024, with gaps of two and then four years. Every row of the current
round carries a load stamp of 2 August 2024 and the series ends at 2021.

The source is declared on a biennial schedule and reads `stale` as a result,
deliberately: no healthy life expectancy has been published beyond 2021, and by
the provider's own past behaviour a 2022 figure is overdue. That signal is the
honest one, and it is why the table's period has not moved.
