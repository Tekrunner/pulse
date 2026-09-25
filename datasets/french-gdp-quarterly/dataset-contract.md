# French quarterly GDP dataset contract

`dataset-contract.yaml` is authoritative. This file records what a consumer has
to know that a schema cannot say.

## What this table is

One row per calendar quarter from 1949-Q1 to the latest quarter INSEE has
published, of French GDP in value and in chained volume, seasonally and
working-day adjusted, with its quarter-on-quarter and year-on-year volume
growth. The series is unbroken: `quarters_are_consecutive` fails the build if a
quarter is missing.

## Where it comes from

The `insee-quarterly-national-accounts` snapshot: three series of the base-2020
quarterly national accounts (dataflow `CNT-2020-PIB-EQB-RF`), fetched by IDBANK
and mapped to columns in `dbt/models/french_gdp_quarterly.sql`:

- `011794860`: GDP in chained volume, previous-year prices;
- `011794859`: GDP at current prices;
- `011794844`: quarter-on-quarter volume growth.

## Definitions

- **Quarterly levels** are GDP produced in the quarter.
- **Annualised levels** are four times the quarterly level: what GDP would
  total over a year at that quarter's pace, on the scale of an annual total.
- **Quarter-on-quarter growth** is the provider's published rate, to a tenth
  of a point (stored with two decimals).
- **Year-on-year growth** is derived here as the change in chained volume on
  the same quarter a year earlier. It is on the same scale as annual growth,
  and smoother than quarter-on-quarter growth because consecutive values share
  three quarters.

## What the period means

`period` is the first day of the quarter the flow belongs to: 2026-04-01 is
2026-Q2.

## Provider quirks

- **Adjusted quarters do not sum to the annual accounts.** The quarterly series
  are seasonally and working-day adjusted, while the annual national accounts
  are not working-day adjusted. Four adjusted quarters therefore differ from
  the annual total by the calendar effect: between 0.01% and 0.15% of GDP in
  the years checked (1960, 2000, 2019, 2023–2025) on the 2026 releases.
- **The two estimates of a quarter differ.** The first estimate, about 30 days
  after the quarter, is revised by the detailed results a month later, and each
  release can revise earlier quarters.
- **Benchmarking lags the annual release.** The quarterly accounts are
  realigned on the annual accounts once a year, so between the end-of-May
  annual release and that realignment the two can disagree on recent years by
  more than the calendar effect.

## Limitations

- The table has GDP only: no demand components or branches by quarter.
- It is not a substitute for the annual accounts in any year both cover: the
  annual figure is the benchmark, and the adjusted quarters differ from it.
- Growth before 1950 cannot be computed year on year.

## Licence and attribution

Licence Ouverte / Open Licence 2.0. Reuse, adaptation and redistribution,
including commercial, are permitted provided INSEE is attributed with the date
of the last update of the reused information. Attribution: "Source: INSEE,
comptes nationaux trimestriels, base 2020."
