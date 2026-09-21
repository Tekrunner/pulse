# European immigration flows dataset contract

`dataset-contract.yaml` is authoritative. This file records what a consumer has
to know that a schema cannot say.

## What this table is

One row per reporting area and reference year: the number of people who
established usual residence in that country during the year, counted regardless
of citizenship. 853 rows across 36 reporting areas, read from the
`eurostat-immigration` snapshot.

Its sibling `european-emigration-flows` is the same table in the opposite
direction, on the same series key.

## What "regardless of citizenship" buys, and why it matters

The acquisition pins `citizen = TOTAL`, so this count includes returning
nationals, not foreign nationals only. That is what makes it differenceable
against the emigration count published on the same basis: arrivals minus
departures is a balance over the same population on both sides.

The alternative source evaluated for this need, the OECD International Migration
Database, publishes inflows and outflows of *foreign* population. Its outflow
excludes returning nationals, so differencing it produces a quantity no provider
publishes. That, rather than coverage, is why it was not taken.

## What this pair cannot be reconciled with

`world-demography-indicators.net_migration_thousands` is the United Nations' net
migration, from a different provider on a different basis. It is not the
difference of these two flows and will not equal it. A consumer placing them in
one figure is placing two providers' answers to a similar question side by side,
and that is the one fact about them that has to be said in prose, because no
mark can carry it.

## The panel is deliberately not rectangular

Reporting starts in different years and, for one country, stops:

| Area | First | Last | Years published |
| --- | --- | --- | --- |
| Germany | 1998 | 2024 | 27 |
| France | 2006 | 2024 | 19 |
| United Kingdom | 1998 | **2019** | 21 |
| `EU27_2020` | 2013 | 2024 | 12 |

The provider's own metadata states it plainly: *"Statistics from the UK are
available only until the withdrawal of the UK from the EU."* A consumer reaching
a year after 2019 must show the United Kingdom as unpublished on the mark — "to
2019" — rather than as a gap or as a zero.

`immigration_persons` is nullable for the same reason. A year the provider
withholds is not a year in which nobody arrived.

## Reporting-area codes are Eurostat's, not ISO's

Eurostat uses ISO 3166-1 alpha-2 with two exceptions of its own: `EL` for Greece
and `UK` for the United Kingdom. `dbt/macros/eurostat_iso3.sql` declares the
whole vocabulary explicitly rather than transliterating it, so a code the
provider adds arrives as null and fails
`every_reporting_country_carries_an_iso3_code` instead of being invented.

`EU27_2020` is Eurostat's own aggregate of the twenty-seven member states as
constituted from 2020. It is a published row, not a country: `geo_kind` is
`aggregate` and `iso3_code` is null. A consumer summing countries and then
adding the aggregate double-counts most of Europe.

## Coverage is European, and that is the whole of it

Thirty-six reporting areas: European Union member states, EFTA, and candidate
countries. A reader selecting Japan, Brazil or Nigeria gets nothing from this
table, and that is not a failure to be filled in — no comparable all-country
source of gross migration flows exists.

## Refresh behaviour

Annual. The provider collects a reference year by 31 December of the following
year and releases it in March of the year after that, so a reference year is
about fifteen months old when it first appears. It also revises published years
continuously as national statistical institutes restate them, so a value in this
table can change without the period moving.
