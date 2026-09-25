# OECD productivity comparison dataset contract

`dataset-contract.yaml` is authoritative. This file records what a consumer has
to know that a schema cannot say.

## What this table is

One row per reference area and year from the OECD Productivity Database, total
economy: the 38 OECD members, the OECD, euro-area (EA20) and EU27 aggregates,
and the non-members the database covers (Brazil, Bulgaria, Croatia, Peru and
Romania on the 2026 snapshot). It carries GDP at purchasing power parity,
population, employment and hours, and the ratios that decompose GDP per
inhabitant. Areas enter in different years and reach the latest year at
different times, so the table is not a rectangle.

## Where it comes from

The `oecd-productivity-database` snapshot (`OECD.SDD.TPS:DSD_PDB@DF_PDB`),
total economy, annual. The provider sends every dimension as `"<code>: <label>"`;
this package splits the two halves, and `reference_area_name` is the OECD's own
English name.

## Membership is a declared classification

Nothing in the provider response distinguishes a member from an aggregate or a
non-member. Membership is stated once, in `dbt/macros/oecd_membership.sql`, and
published as `reference_area_kind`. An aggregate must never be ranked among
members. `membership_list_matches_the_provider` fails if a declared member or
aggregate stops appearing.

## Definitions

- **Current PPP** converts each year's GDP at that year's parities: the basis
  for comparing levels across areas within a year.
- **Constant 2020 PPP** is chain-linked volume at 2020 prices and parities: the
  basis for following one area over time. Its growth equals growth in national
  currency volume.
- **GDP volume growth** is computed from national-currency chain-linked volume.
- **The decomposition.** All ratios are derived from four published totals —
  GDP, total hours, employment and population — so GDP per inhabitant is
  exactly GDP per hour × hours per worker × employment per inhabitant. Adding
  the working-age share of population, which this provider does not publish,
  splits employment per inhabitant further into the employment rate of the
  working-age population and the working-age share. That split needs population
  by age from another provider and must use this table's population as the
  denominator, so that the product still closes.
- **GDP per hour** derived here equals the OECD's published GDP per hour worked
  (`derived_ratios_match_the_published_ones`). **Hours per worker** is total
  hours over employment. It is not the OECD's published average hours
  (`HRSAV`), which for the United States is counted on a different employment
  basis and so does not multiply out to GDP per inhabitant.

## The labour-input screen

On the 2026 snapshot two areas publish labour totals that cannot be
measurements:

- **New Zealand**: total hours are about fifty times too large in every year
  from 1989 (about 200 billion hours a year for an economy of under three
  million workers), and 2025 employment, flagged by the provider as estimated,
  is fifty times the 2024 figure.
- **Peru**: total hours yield about two hours a year per worker.

`labour_input_is_plausible` is false wherever hours per worker fall outside
1,000–3,500 or employment outside 0.1–0.9 of population. There, the published
totals are kept as sent, and the hours-based ratios (GDP per hour, hours per
worker, employment per inhabitant) are null. Every other area lies between about
1,300 and 2,400 hours per worker and 0.28 and 0.77 workers per inhabitant.
`only_new_zealand_and_peru_fail_the_labour_screen` fails the build if any
further area trips the screen, because that would be a new provider problem
for a reader to hear about. GDP, GDP per inhabitant and growth are unaffected.

## What the period means

`period` is 1 January of the year whose flows, annual averages or change on the
previous year the row carries.

## Provider quirks

- **Ragged starts.** Hours begin in 1970 for France, 1980 for the United
  Kingdom, 1987 for the United States, 1991 for Germany, and later for many
  members; the OECD aggregate's hours begin in 1996.
- **Ragged edge.** On 2026-09-23 the edge was 2025, but GDP per capita for
  Bulgaria, Costa Rica and Australia stopped at 2024 and Brazil at 2021.
- **Rolling revisions.** The OECD updates each variable when its source does,
  so any snapshot can revise any year.

## Limitations

- Constant-PPP levels compare an area with itself over time, not areas with
  each other in years far from 2020; current PPP is the cross-area basis.
- PPP-based GDP per inhabitant is a volume comparison of living standards; it
  says nothing about purchasing power on world markets at market exchange rates.
- The table has no working-age population and so no employment rate.

## Licence and attribution

Creative Commons Attribution 4.0 International (CC BY 4.0), the OECD's default
licence. Adaptation is permitted with attribution and must carry the OECD
adaptation notice; the derived ratios and the screen are adaptations.
Attribution: "Source: OECD Productivity Database. This is an adaptation of an
original work by the OECD."
