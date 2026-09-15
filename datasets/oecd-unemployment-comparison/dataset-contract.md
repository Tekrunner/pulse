# OECD unemployment rate comparison dataset contract

One row per calendar month and OECD reference area, carrying the harmonised
unemployment rate for people aged 15 or over, both sexes, seasonally and
calendar adjusted. 43 reference areas, from January 2000.

## Harmonised is not the same as national

The OECD adjusts national figures for cross-country comparability. **A rate here
can therefore differ from the figure a national statistical institute announces
for the same country and month**, including France's own.

This table exists to answer a *relative* question — does France sit above or
below its peers — and must not be used to state France's unemployment rate. The
French headline is `french-labour-market-quarterly.unemployment_rate_pct`, which
is what INSEE publishes and what a French reader will have seen quoted. A view
showing both must not let them be read as the same number.

## Splitting the provider's combined values

The source archives SDMX-CSV 2.0 with `labels=both`, so each dimension arrives
as a single `"<code>: <label>"` string. That representation was chosen at
acquisition because the alternative emits code and label columns differing only
in case, which the Parquet writer cannot store at all. This package splits the
two halves and keeps both: `reference_area_name` is the OECD's own country name,
so nothing downstream has to invent country labels.

## Membership is a declared classification

Nothing in the provider response distinguishes a member country from a computed
aggregate or from a non-member the OECD also publishes. The report's comparison
selector is defined as "OECD members", so the membership has to be stated
somewhere, and it is stated once — in `dbt/macros/oecd_membership.sql` — rather
than guessed from country names by each visual.

`reference_area_kind` is therefore one of:

- **member** — one of the 38 OECD member economies.
- **aggregate** — a computed area: `EA` (euro area), `EU`, `G7`, `OECD`. These
  belong in the table, because a reader comparing France to "the OECD" wants
  exactly this, but they must never be ranked among the member countries.
- **non-member** — an area the OECD publishes alongside members. Here: Bulgaria,
  Croatia and Romania.

The `membership-list-matches-the-provider` test fails if a listed member stops
appearing, so the list cannot drift from what the OECD actually publishes
without the build saying so.

## Known coverage gap

**Switzerland and New Zealand are OECD members that this monthly dataflow does
not carry.** They do appear in `oecd-participation-comparison`, which draws on
the quarterly dataflow. This is a provider fact, not a defect, and the report is
required to show it explicitly rather than silently narrowing its selector —
a member the reader can select must render an explicit
not-published-at-this-frequency state, not vanish. The membership test allows
exactly these two absences and no others.

## The edge is ragged

Reference areas reach the publication edge at different speeds. On 2026-09-14
the United States had reached 2026-08, 38 areas had reached 2026-07, and the
**United Kingdom had only reached 2026-05** — its rolling-quarter survey runs
about three months behind the others.

Any consumer must handle a ragged edge rather than assume a rectangle. A chart
that draws all five default comparators to "the latest month" would either stop
at the slowest or imply the UK line ended. The design has to choose and say
which.

## Frequency mismatch with the French series

This table is monthly; the French national series is quarterly. Aligning them is
a presentation decision that belongs to the report, not here, and neither
frequency is resampled into the other.

## Validations

- `(period, reference_area_code)` is unique; no column is ever null.
- Every rate lies within 0 to 100.
- Every `reference_area_kind` is `member`, `aggregate` or `non-member`.
- Every aggregate the package classifies is present, so a comparison against
  the euro area, the European Union, the G7 or the OECD can never silently lose
  one. Members are covered by the membership check, so any report's choice of
  comparators is guaranteed without this package knowing what that choice is.
- Every listed OECD member appears, except Switzerland and New Zealand.

## Lineage

Source: `oecd-unemployment-rate`, snapshot format `parquet`. CC BY 4.0.
Attribution: *Source: OECD, Monthly unemployment rates. This is an adaptation of
an original work by the OECD.* The adaptation disclaimer is required by the
licence and must survive into anything published from this table.
