# French localised unemployment rate dataset contract

One row per calendar quarter and territory, carrying the localised ILO
unemployment rate INSEE publishes for metropolitan France, France excluding
Mayotte, the 13 metropolitan regions and 100 departements.

Every rate is published by INSEE. Nothing is aggregated, averaged or
interpolated here.

## The grain is long, and deliberately so

A hundred departements as a hundred columns would force every consumer to
re-derive the territorial hierarchy from column names, and would break the
moment INSEE changed a territory. The grain is therefore `(period,
territory_code)`, with `territory_kind` naming what a row is.

`territory_code` for a departement is the **bare INSEE code** — `75`, `2A`,
`971` — so a row joins to `french-departement-geometry.departement_code` with no
translation. Regions and the national references keep the provider's own code,
which is already their natural key. `provider_ref_area` retains the untouched
provider value so any row can be traced back to the exact snapshot series it
came from.

## The panel is not rectangular

INSEE publishes the 96 metropolitan departements, the regions and the national
references from **1982-Q1**, but Guadeloupe, Martinique, Guyane and La Réunion
only from **2014-Q1**. That is 49 quarters with all 100 departements and 128
with 96.

Both truncating to 2014 and padding the gap were rejected. Truncating would
discard 32 years of metropolitan history for a report whose subject is how
unemployment has evolved; padding would invent observations INSEE never made.
The table therefore keeps the full history, the executable test asserts exactly
this shape, and the constraint is passed on to whatever draws the map: **a
consumer that lets a reader reach a quarter before 2014 must show the four
overseas departements as unpublished — not as zero, and not as missing shapes.**

## This national rate is not the national headline

The national reference series in this table are metropolitan France (`FM`) and
France excluding Mayotte (`FR-D976`). The national headline in
`french-labour-market-quarterly` is France *including* Mayotte. These are
different geographies and therefore different numbers.

A departement must be compared against the country rows in **this** table.
Comparing a departement here against the headline there would put a difference
of geography into a figure a reader will read as a difference of place.

## This table trails the national series

Localised rates are released about five weeks after the national ILO figures, so
the latest quarter here is normally one behind `french-labour-market-quarterly`.
On 2026-09-14 this table reached 2026-Q1 while the national table reached
2026-Q2. Any view that shows both must say which quarter each is at, rather than
implying they are simultaneous.

## Decoding the territory name

INSEE writes each series title as `Taux de chômage localisé par <niveau> -
<nom>`, and the name is parsed from it. The level word is deliberately *not*
used to classify the territory, because INSEE labels both national reference
series "par région"; the `REF_AREA` code does the classifying instead. If the
title format ever changes, the `territory-names-are-decoded` test fails rather
than publishing a map of blank labels.

## Validations

- `(period, territory_code)` is unique; no column is ever null.
- Every rate lies within 0 to 100.
- Every `territory_kind` is `country`, `region` or `departement`.
- Every territory name decoded successfully.
- Coverage matches the provider's real history: 96 metropolitan departements in
  every quarter, all 100 from 2014-Q1, and exactly none of the four overseas
  ones before it.

## Lineage

Source: `insee-local-unemployment`, snapshot format `parquet`. Licence Ouverte /
Open Licence 2.0. Attribution: *Source: INSEE, taux de chomage localises.*
