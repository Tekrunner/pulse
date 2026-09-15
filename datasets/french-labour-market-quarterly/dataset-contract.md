# French quarterly ILO labour-market dataset contract

One row per calendar quarter, carrying twenty-five published INSEE indicators
for France including Mayotte, seasonally adjusted, from 2003-Q1 onwards.

**Every value in this table is published by INSEE. Nothing here is computed from
anything else.** The unemployment rate is not derived from the count, the count
is not derived from the rate, and no rate is derived from any other rate. The
package selects, types and pivots; it does not calculate.

## What a row is

The `period` column is the first day of the calendar quarter the observation
describes, derived from the provider's `YYYY-Qn`. Values are typed
`DECIMAL(10,1)`, which is the precision INSEE publishes: rates to one decimal
place, headcounts to the nearest thousand.

## Why the series begin at 2003-Q1

The snapshot carries 206 quarters, but only 94 of them carry every declared
indicator. The ILO unemployment counts reach back to 1975 while the rates, the
halo, underemployment and the activity rates begin in 2003-Q1 on the
France-including-Mayotte basis. Publishing the wider window would produce a
half-empty table whose `not_null` tests could not mean anything, and would
invite a chart that silently changes which measures it is showing partway along
its own x-axis. Only complete quarters are published.

## Re-attaching provider meaning

When INSEE BDM series are fetched by IDBANK, the response carries no
`INDICATEUR`, `SEXE` or `AGE` attribute — only the IDBANK, the French title and
the observation. The IDBANK-to-column map in
`dbt/models/french_labour_market_quarterly.sql` is therefore the analytical
heart of this package: it re-attaches the provider's meaning to each series. It
is checked against the French catalogue titles recorded in
`sources/insee-labour-market/source.yaml`, and the source package rejects a
snapshot in which any of those titles has changed, so a silent provider
renaming cannot reach this map unnoticed.

## Denominators are not interchangeable

The four slack measures each have an officially published rate, and those rates
have **different denominators**:

| Measure | Rate is a share of |
| --- | --- |
| ILO unemployment | the labour force |
| Long-term unemployment | the labour force |
| Halo around unemployment | the population aged 15 to 64 |
| Underemployment | employment |

The halo denominator is the population rather than the labour force because
people in the halo are, by definition, outside the labour force: they want work
but do not meet both ILO conditions of availability and active search. The
underemployment denominator is employment because underemployed people are in
work. A visual that stacks these four rates, or that reads their differences as
a single quantity, would be wrong. Their **counts** are in consistent units
(thousands of people) and may be compared directly, though they overlap: a
long-term unemployed person is also an unemployed person.

## Coverage and comparability limits

- The geography is France *including* Mayotte (`REF_AREA=FE`). The localised
  rates in `french-departement-unemployment` use metropolitan France and France
  excluding Mayotte, so the national figure here does not equal the national
  figure there, and the two must not be presented as the same number.
- All series are seasonally adjusted, so a quarter-on-quarter change is a real
  movement rather than a seasonal one, but no series here is raw.
- The age bands (under 25, 25 to 49, 50 or over) and the sexes each partition
  the labour force, which the package tests by reconstructing the published
  total from them within the provider's own rounding.
- The activity rate is published on two bases: all ages, and 15 to 64. The
  **all-ages** rate is the one comparable with the OECD participation rates in
  `oecd-participation-comparison`: both are a 15-or-over basis, and across the
  94 shared quarters they differ by at most 0.7 points and 0.49 on average,
  which is OECD harmonisation rather than a different population. The 15-to-64
  rate is a narrower base that excludes the retired population and runs about
  18 points higher (75.4 against 56.9 in 2026-Q2); it must never share an axis
  with an OECD figure.

## Validations

Executable dbt tests, all of them package-owned:

- `period` is unique and never null; every indicator is never null.
- Every percentage lies within 0 to 100; every headcount is not negative.
- The three age-band unemployment counts sum to the published total within 1.5
  thousand, the provider's rounding across three series.
- The male and female unemployment counts sum to the published total within 1.0
  thousand.
- Long-term unemployment never exceeds unemployment, in either count or rate.

The summation tests are the ones that would catch the failure that actually
matters: an IDBANK in the map no longer pointing at the series it claims.

## Lineage

Source: `insee-labour-market`, snapshot format `parquet`. Licence Ouverte /
Open Licence 2.0. Attribution: *Source: INSEE, enquete Emploi, indicateurs
trimestriels au sens du BIT.*
