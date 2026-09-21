# World demography age structure dataset contract

`dataset-contract.yaml` is authoritative. This file records what a consumer has
to know that a schema cannot say.

## What this table is

One row per location, calendar year, age grouping and age band, 1950 to 2100,
for the world total and all 237 countries and areas. 862,512 rows, the largest
table in this repository.

`dbt/models/world_demography_age_structure.sql` is the analytical boundary,
reading the `un-wpp-population-by-age` snapshot with every field declared as
text and cast explicitly.

## Two groupings of the same people

`age_grouping` is `five-year` or `broad`. They are not a hierarchy to be summed
together; they are the same population counted twice over, at two resolutions.

- `five-year` carries the provider's own 21 bands, `0-4` through `95-99` and an
  open-ended `100+`.
- `broad` carries three bands summed here from those: `0-14`, `15-64`, `65+`.

A consumer that adds a row from one grouping to a row from the other counts
people twice. `the_two_groupings_describe_the_same_population` asserts that for
every location and year the two groupings total exactly the same people — not
within a tolerance, exactly, because both sums are of the same published values.

The broad bands are derived rather than read because this file does not publish
them. Summing exhaustive, non-overlapping bands is the only way to obtain them
without a second source, and doing it here means one definition of "working age"
rather than one per consumer.

## Why 0-14 / 15-64 / 65+ and not 0-17 / 18-64

A five-year grain cannot cut at 18. The available young/middle/old split is the
one the provider's own bands permit, which is also the split its dependency
ratios use. A consumer needing an 18 boundary needs the single-year file, which
is a different snapshot roughly ten times the size.

## Bands are exhaustive, and one is open-ended

Within a grouping the bands cover every age from zero upward with no gap and no
overlap, asserted by `bands_are_exhaustive_and_do_not_overlap`. Exactly one band
per grouping is open at the top: `100+` and `65+`, both carrying `age_end` null.
The provider marks that with an `AgeGrpSpan` of `-1`, which this model reads as
null rather than as a negative width.

`share_of_population_pct` is computed within a grouping, so each grouping's
shares sum to 100 rather than to 200 between them. The tolerance in
`shares_sum_to_one_hundred_within_a_grouping` is the rounding of the published
share itself — half of the last digit on each band, scaled by how many bands the
grouping has — not an allowance fitted until the test passed.

## Ordering is by `age_start`, not by label

`age_group` is a label: sorted as text, `100+` precedes `10-14`. `age_start` is
the band's first year of age and is the order a consumer reads the bands in.

## Estimates and projections again share one axis

`series_kind` is `estimate` through 2023 and `projection` after, read from the
snapshot manifest's represented date exactly as in the sibling indicator table.
A pyramid for 2075 is a projected pyramid.

## Sex sums, and their tolerance

`the_sexes_sum_to_the_band_total` allows half of the last published digit on
each of two addends for a five-year band, and twenty-one times that for a broad
band, because a broad band sums twenty-one independently rounded triples. That
scaling is arithmetic about the provider's precision, not a fitted constant.

## Size

The published Parquet is about 15 MB, the largest here by an order of magnitude.
A consumer that needs one location-year — a pyramid at a selected year — should
say so in its query rather than reading the table and filtering afterwards.

## Refresh behaviour

As for the sibling tables: a revision supersedes the previous one whole, at a
different URL, and reaches this table only after a human updates the source
declaration. The band vocabulary is declared in the source package, so a band
the provider stops publishing fails an assertion rather than disappearing.
