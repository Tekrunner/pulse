# French GDP in US dollars dataset contract

`dataset-contract.yaml` is authoritative. This file records what a consumer has
to know that a schema cannot say.

## What this table is

One row per calendar year from 1960 to the latest year the World Bank publishes,
of French GDP in current US dollars at market exchange rates, the series it is
built from, and the decomposition of its annual change into real growth, change
in the GDP deflator and change in the euro-dollar exchange rate. The years are
unbroken: `years_are_consecutive` fails the build otherwise.

## Where it comes from

The `world-bank-wdi-gdp` snapshot: six World Development Indicators for France,
`NY.GDP.MKTP.CD`, `NY.GDP.MKTP.KD`, `NY.GDP.MKTP.CN`, `NY.GDP.MKTP.KN`, `NY.GDP.DEFL.ZS` and
`PA.NUS.FCRF`, all from one WDI update.

## Definitions

- **Dollar GDP** is GDP in local currency divided by the official
  annual-average exchange rate. It moves with real output, with domestic prices
  and with the exchange rate.
- **The decomposition** uses the identity, which the provider's series satisfy:
  ln(dollar GDP) = ln(real GDP) + ln(deflator) − ln(euros per dollar), up to a
  constant. Differencing gives the three terms of each year's change, in log
  points (100 × the change in natural log). In log points the terms add up
  exactly, with no interaction term; `dollar_gdp_change_pct` gives the simple
  percentage change for reading off a level.
- **Constant-dollar GDP** is the provider's own series: constant local-currency
  GDP rescaled so that it equals current-dollar GDP in one base year, which
  `constant_usd_base_year` carries. Its growth is real growth
  (`constant_dollars_grow_with_real_gdp`); its level is that of the base year's
  prices and exchange rate.
- **Exchange-rate change** is signed so that a positive value is a euro
  appreciation, which raises dollar GDP.

## What the period means

`period` is 1 January of the year whose GDP, annual-average exchange rate or
change on the previous year the row carries. Before 1999 "the euro" is the
franc expressed in euros.

## Provider quirks

- **The exchange rate is in francs before 1999.** The World Bank expresses GDP
  in local currency in euros for every year, francs converted at 6.55957, but
  publishes the official exchange rate in francs per dollar up to 1998 and in
  euros per dollar from 1999. This package divides pre-1999 rates by 6.55957,
  the irrevocable conversion rate fixed by Council Regulation (EC) No 2866/98.
  `dollar_gdp_is_local_gdp_at_the_exchange_rate` confirms that dollar GDP then
  equals euro GDP at the converted rate in every year; an unconverted year would
  miss by a factor of 6.56.
- **The World Bank's figures are not INSEE's latest.** WDI takes French national
  accounts from its own sources and update schedule; its euro GDP can differ
  from the latest INSEE release in level and vintage, and its constant-price
  base year is not INSEE's 2020.
- **Constant euros and constant dollars have different base years.** The
  constant local-currency series and the constant-dollar series are anchored to
  different years, so constant dollars are not constant euros at one year's
  exchange rate: they differ by a fixed factor. The constant-dollar base year
  is in the provider's indicator name and in `constant_usd_base_year`.
- **Every WDI update can revise history.**

## Limitations

- The table is France only.
- Dollar GDP at market rates is not a measure of living standards and must not
  be compared across countries as one: price levels differ between countries,
  which only a purchasing-power-parity conversion removes.
- The decomposition splits the change in dollar GDP, not its level.

## Licence and attribution

Creative Commons Attribution 4.0 International (CC BY 4.0). Redistribution and
adaptation are permitted with attribution and an indication of changes; the
franc-to-euro conversion and the decomposition are changes made in this package.
Attribution: "Source: World Bank, World Development Indicators."
