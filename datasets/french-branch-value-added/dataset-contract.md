# French value added by branch dataset contract

`dataset-contract.yaml` is authoritative. This file records what a consumer has
to know that a schema cannot say.

## What this table is

One row per year and branch of French gross value added, at three nested
levels of INSEE's nomenclature of activities:

- **A10**, ten branches, published from 1949;
- **A38**, 37 branches (A38 has 38 positions, but extraterritorial
  organisations, `UZ`, lie outside the domestic economy and carry no value
  added), published from 1959;
- **A88**, the two-digit NACE divisions, published from 1999.

A level is published for a year only when every one of its branches has a
value, so at every level and year the branches partition the whole economy and
their shares add up to 100. The A10 and A38 levels reach the latest provisional
year; A88 stops a year earlier, because INSEE publishes industry detail a year
behind the total.

## Where it comes from

The `insee-annual-national-accounts` snapshot, dataflow `CNA-2020-CPEB`
(production and operating accounts by branch, base 2020), operation `B1G`
(gross value added) at current prices (`PRIX_REF=VAL`) and in chained volumes
(`PRIX_REF=PCH`), plus the total-economy series (`NNTOTAL`) for the
denominator of shares.

The nesting of A88 into A38, A17, A10 and A5 is declared in
`dbt/seeds/branch_nomenclature.csv`, with the provider's English branch names
from the INSEE codelist `CL_CNA_ACTIVITE`. `every_provider_branch_code_is_declared`
fails the build if INSEE publishes value added under a code the seed does not
declare.

## Definitions

- **Gross value added** is output less intermediate consumption, at basic
  prices, as INSEE publishes it for each branch.
- **Share of total value added** divides a branch's value added at current
  prices by that of all branches in the same year. It is a share of value
  added, not of GDP: GDP also includes net taxes on products.
- **Residual rows** (`is_residual` true) are A88 rows derived as the A38 parent
  less the A88 industries INSEE publishes separately. On the 2026 release INSEE
  published no separate series for printing (18), basic metals (24), security
  and investigation (80), coal and metal-ore mining (05 and 07, one residual)
  and households' undifferentiated own-use production (98). When exactly one
  industry is missing from a parent, its residual is that industry's value
  added; when several are, it is their sum. Residuals exist at current prices
  only: chained volumes do not subtract, so their volume column is null.

## Which provider series a branch takes

INSEE publishes a branch under every level at which it is defined and keeps
only one of those copies current. Construction is `A5-FZ`, `A10-FZ`, `A17-FZ`
and `A38-FZ`, and only `A10-FZ` advances; telecommunications has no A38 series
and is published only as `A88-61`. The copies left behind stopped at 2022 or
2023 with the base-2020 launch in June 2024 and carry that older vintage.

This package keys every provider series by the set of A88 industries it
covers; two codes with the same set are the same branch. Each branch takes all
its years from one series: the most recently updated, and among equally
current copies the one with the longest history. Real estate is the one branch
with two current copies that disagree: `A88-68` differs from `A10-LZ` before
1993, and `A10-LZ`, which adds up with the other A10 branches to the total, is
used. The A88 level is not published before 1999, so no published row depends
on the disagreement; `maintained_copies_of_a_branch_agree` asserts that every
current copy matches what is published at its level.

## What the period means

`period` is 1 January of the year whose value added the row carries.

## Provider quirks

- **The three latest years are revised at every release**, and the industry
  detail of the latest year is published a year later than the total.
- **Chained volumes are not additive.** The chained values of an A10 branch's
  A38 children do not add up to the parent's chained value, and residuals have
  none.
- **Residuals can be zero or nearly so.** Households' own-use production and
  coal and metal-ore mining are a few million euros or nothing.

## Limitations

- The table has no A17 or A5 level; those are declared in the nomenclature only
  to identify copies of the same branch.
- It carries value added only, not output, intermediate consumption,
  compensation or operating surplus by branch.
- The A88 level begins in 1999; the A38 level in 1959.
- A share of value added is not a share of GDP.

## Licence and attribution

Licence Ouverte / Open Licence 2.0. Reuse, adaptation and redistribution,
including commercial, are permitted provided INSEE is attributed with the date
of the last update of the reused information. Attribution: "Source: INSEE,
comptes nationaux annuels, base 2020."
