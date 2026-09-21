# World demography indicators dataset contract

`dataset-contract.yaml` is authoritative for identity, columns, types,
indicators, questions, temporal meaning and validations. This file records what
a consumer has to know that a schema cannot say.

## What this table is

One row per location and calendar year, 1950 to 2100, for the world total and
all 237 countries and areas the provider publishes. It is the analytical read of
one snapshot: `un-wpp-demographic-indicators`, the medium-scenario file of the
2024 revision of World Population Prospects.

`dbt/models/world_demography_indicators.sql` is the analytical boundary. Every
field it reads is declared as text in the `read_csv` call and cast explicitly,
because a provider column that is renamed or retyped must fail the build rather
than arrive as a plausible-looking null.

## The universe is the provider's, not a reader's

Every country and area the provider publishes is here, down to locations of a
few hundred people. Narrowing that list is a preference about who is worth
looking at, and preferences belong to whoever is looking; the provider's own
universe is a fact, and facts belong here. A consumer that wants a shorter list
applies its own rule in its own query.

Two consequences follow. The table contains the Holy See, Tokelau and Niue
alongside China and India, and their rows behave like rows for populations of
a few hundred people: a rounding of a thousandth of a thousand is four per cent
of Tokelau.

The provider's regional, subregional, development and income groupings are
**not** here. They answer a different question — how a bloc behaves — and mixing
them into a table keyed by country would let a consumer sum a country and the
region containing it.

## Estimates and projections share one time axis

`series_kind` is `estimate` through 2023 and `projection` from 2024. The
boundary is not a constant in this package: it is read from the snapshot
manifest's represented date, so it travels with the revision rather than
drifting beside it.

The provider's file gives no help here. Every one of its rows reads
`Variant = Medium` from 1950 to 2101, with nothing marking where measurement
stops. The boundary is declared in the source package from the provider's own
prose and asserted against the data there; this package inherits it through the
manifest.

A consumer that reads the two kinds as one continuous observed series is reading
a model as a measurement. Seventy-seven of the 151 years in every location's row
set are projected.

## Population change does not decompose exactly

The provider's `population_change_thousands` is **accounted for** by
`natural_change_thousands` and `net_migration_thousands`, but it is not their
sum. Measured over every row in this table, the residual is a few people for a
median country-year, reaches about 4,862 people for a country, and reaches about
7,322 people for the world aggregate, where 237 independently rounded country
figures accumulate.

There is therefore no validation asserting that identity, and there deliberately
never was one with a tolerance fitted to make it pass. A tolerance chosen to
absorb 4,862 people is not a rounding allowance; it is a way of not noticing
that the provider publishes three numbers that do not close.

What does hold exactly, and is asserted, is
`natural_change_thousands = births_thousands − deaths_thousands`, to half of the
last digit the provider publishes.

A consumer drawing a stacked decomposition of population change will find the
stack not reaching the line. That is the data, not the drawing.

## The world total has no ISO3 code, and no migration

`iso3_code` is null on the world rows because the provider publishes none, and
`only_the_world_total_lacks_an_iso3_code` asserts that it is the only null.
`location_id` is the grain key; `iso3_code` is what lets a country be recognised
beside another provider's rows.

`net_migration_thousands` is `0.0` for the world in every year, by construction:
migration nets to zero globally. This is not a missing value and not a
measurement.

## Rates are per 1,000, and no percentage was derived

`natural_change_rate_per_1000` and `net_migration_rate_per_1000` are the
provider's own rates in the provider's own unit, which is the conventional one
for these measures. No percentage-of-population column exists, because it would
be the same quantity under a second name divided by ten, and two columns that
differ only by a constant are two places for the same fact to be wrong.

## Extreme values that are real

`population_growth_rate_pct` reaches −71.064 (Kuwait, 1990), −41.785 (Rwanda,
1994) and −33.038 (Hong Kong, 1967). `life_expectancy_years` falls to 10.99. A
consumer clipping these as outliers would be clipping the provider's record of a
war, a genocide and a mass departure. The range validations bound only what a
human population physically cannot do.

## Refresh behaviour

This table is rebuilt from whichever snapshot of its source is current. A World
Population Prospects revision supersedes the previous one whole rather than
appending to it: every value in the table can move, including historical
estimates of 1950. The revision arrives at a different URL, so it reaches this
table only after a human updates the source declaration.
