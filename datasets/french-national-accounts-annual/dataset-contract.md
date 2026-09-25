# French annual national accounts dataset contract

`dataset-contract.yaml` is authoritative. This file records what a consumer has
to know that a schema cannot say.

## What this table is

One row per calendar year from 1949 to the latest provisional year of the INSEE
annual national accounts, base 2020, for France. It carries GDP in value, in
volume and per inhabitant; the provider's contributions of each demand
component to GDP volume growth; the income-side split of GDP into compensation,
operating surplus, mixed income and net taxes; domestic employment split into
employees and non-employees; and the AMECO-adjusted wage share. The table is
complete for every year in that span: `years_are_consecutive` fails the build if
one is missing.

## Where it comes from

The `insee-annual-national-accounts` snapshot: the base-2020 dataflows
`CNA-2020-PIB` (GDP and contributions), `CNA-2020-CPEB` (the total-economy
branch account, `CNA_ACTIVITE=NNTOTAL`) and `CNA-2020-EMPLOI` (total-economy
employment, `SECT-INST=S10`), all from the same end-of-May release. Each column
is fed by exactly one provider series, named by its dimensions in
`dbt/macros/series_selectors.sql`; `every_selector_matches_one_series` fails the
build if a selector matches none or several.

## Definitions

Published columns are the provider's figures, cast to decimals at their
published precision.

- **GDP** is the product-approach aggregate. The chained-volume series is
  referenced to 2020 and the price index is the ratio of value to volume, 2020 =
  100. Volume growth is the provider's own chained change on the previous year.
- **Contributions to growth** are in percentage points of the previous year's
  GDP. Final consumption, fixed capital formation, inventories, valuables and
  net trade add up to GDP volume growth; households (excluding sole
  proprietorships), non-profit institutions and government add up to final
  consumption; the five investing sectors add up to fixed capital formation;
  exports and imports add up to net trade. Imports enter with a negative sign.
- **Compensation of employees** (D1) includes employers' social contributions;
  wages and salaries (D11) do not.
- **Gross operating surplus** (B2G) is the surplus of corporations, government
  and households, and includes the rent that owner-occupiers are deemed to pay
  themselves. It is a large share of the surplus with no transaction behind it.

Derived columns are accounting identities over published aggregates:

- `gross_mixed_income_eur_mn` = operating surplus plus mixed income (B2G+B3G,
  published together) − operating surplus.
- `net_taxes_on_production_eur_mn` = value added − compensation − operating
  surplus and mixed income: other taxes less other subsidies on production
  (D29−D39). It can be negative when production subsidies exceed those taxes.
- `net_taxes_on_products_eur_mn` = GDP − value added: taxes less subsidies on
  products (D21−D31).
- The **AMECO adjustment** credits each non-employee with the average
  compensation per employee: `imputed_non_employee_labour_income_eur_mn` =
  compensation / employees × non-employees. Adjusted labour income is
  compensation plus that imputation; adjusted capital income is operating
  surplus and mixed income minus it. The adjusted wage share divides adjusted
  labour income by GDP at current market prices, as AMECO's `ALCD0` does.
  AMECO scales compensation by total employment over employees. The provider
  rounds total employment, employees and non-employees separately, so their sum
  misses the total by up to 0.1 thousand; this package uses employees plus
  non-employees so that the adjusted split closes on GDP exactly.

## What the period means

`period` is 1 January of the year whose annual flow, annual average or
year-on-year change the row carries. Employment is an annual average; hours
worked are the year's total.

## Provider quirks

- **The three latest years are revised at every release.** The latest year is
  provisional, the one before semi-definitive, the one before that definitive.
- **Chained volumes are not additive.** Sums of chained components do not equal
  chained GDP; the contributions are the provider's additive decomposition.
- **The imputation can exceed mixed income.** Crediting every non-employee with
  the average employee's compensation is a convention, not a measurement; in
  some years the imputed amount exceeds published mixed income, so part of it is
  taken from the operating surplus of corporations. Adjusted capital income is
  still positive in every published year.
- **Base 2020 only.** Earlier bases (2010, 2014) are separate dataflows and are
  not mixed in; the whole series is on one base.

## Limitations

- The table is France-wide; it has no branch or regional detail.
- It has no quarterly observations; the latest year is the latest annual
  release, not the latest quarter.
- The adjusted wage share assumes non-employees earn what employees earn on
  average, in every branch and every year alike.
- It does not support comparison with another provider's version of French GDP,
  which may be on another base or vintage.

## Licence and attribution

Licence Ouverte / Open Licence 2.0. Reuse, adaptation and redistribution,
including commercial, are permitted provided INSEE is attributed with the date
of the last update of the reused information. Attribution: "Source: INSEE,
comptes nationaux annuels, base 2020."
