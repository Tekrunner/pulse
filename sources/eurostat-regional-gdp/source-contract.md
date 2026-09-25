# Eurostat regional GDP snapshot contract

This public acquisition package fetches one credential-free Eurostat SDMX 2.1
response for dataset `nama_10r_3gdp`, *Gross domestic product (GDP) at current
market prices by NUTS 3 region*, as SDMX-CSV 1.0, pinned to annual frequency
and three units:

- `MIO_EUR` — GDP in millions of euros.
- `EUR_HAB` — GDP in euros per inhabitant.
- `PPS_EU27_2020_HAB` — GDP in purchasing power standards (EU27 from 2020) per
  inhabitant.

Every region Eurostat publishes is retained, at every NUTS level from country
to NUTS 3 and for every reporting country, together with the provider's
extra-regio territories (`..Z`, `..ZZ`, `..ZZZ`). 126,364 rows, 2000–2024, on
2026-09-23. Which regions a consumer needs is a question about the NUTS
classification, answered by the dataset package that declares it.

Every column the provider sends — `DATAFLOW`, `LAST UPDATE`, `freq`, `unit`,
`geo`, `TIME_PERIOD`, `OBS_VALUE`, `OBS_FLAG`, `CONF_STATUS` — is retained under
its own name as the string it arrived as. The adapter rejects a response that is
not readable CSV, has ragged rows, lacks a declared dimension, carries a unit or
frequency outside the pinned key or lacks a declared unit, carries a non-annual
period, or repeats a unit-region-year observation.

`source_data_date` is the last day of the latest year for which any region
publishes a value.

## What the provider does that a consumer must know

- **French NUTS 3 regions are the departements**, coded by NUTS (`FR101` is
  Paris, `FRE11` is Nord), not by the INSEE departement code. The overseas
  departements are `FRY10` to `FRY50`; `FRZZZ` is the extra-regio territory.
- **Empty cells are withheld.** Eurostat publishes an empty value, marked
  confidential (`CONF_STATUS=C`), for some regions and years (Irish NUTS 3
  regions, for example).
- **Zero is published.** Hungary's extra-regio territory carries 0 million
  euros in every year.
- **Countries reach the edge at different times.** On 2026-09-23 the edge was
  2024 for 31 of 34 countries; Albania stopped at 2023, Switzerland at 2022 and
  Norway at 2021.
- **Flags.** `p` (provisional), `b` (break in series) and `e` (estimated) are
  carried in `OBS_FLAG`.

## Assertions

- `every_published_value_is_numeric` — every non-empty value parses.
- `every_published_value_is_non_negative` — no published GDP is negative.
- `every_empty_value_carries_a_status_or_flag` — an empty value is always
  explained by a confidentiality status or a flag.
- `most_countries_publish_the_latest_year` — more than half the countries
  (two-letter geo codes) publish the edge year, so the edge reflects a release
  rather than one early reporter.

## Scheduling evidence

- **Provider access and native scope.** `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/nama_10r_3gdp/A.EUR_HAB+PPS_EU27_2020_HAB+MIO_EUR.?format=SDMX-CSV`,
  checked 2026-09-23; dimension order `freq, unit, geo`.
- **Licence and attribution.** Eurostat's reuse policy under Commission Decision
  2011/833/EU, the terms recorded for the repository's other Eurostat sources:
  reuse is authorised for commercial and non-commercial purposes provided the
  source is acknowledged. No share-alike obligation.
- **Publication cadence and window.** The Eurostat reference metadata for
  regional economic accounts
  (`https://ec.europa.eu/eurostat/cache/metadata/en/reg_eco10_esms.htm`,
  checked 2026-09-23) states: "The annual Regional GDP dataset is released
  between 1 of February and 15 of February of each year." Every row carried
  `LAST UPDATE` 10/02/26 11:00:00, i.e. the release of 10 February 2026, which
  added 2024.
- **Provider timezone.** Europe/Luxembourg (CET).
- **Declared expected deadline.** `expected_within_days: 411`. Year N is added
  at the release of February N+2, and the stated window ends on 15 February,
  411 days after 31 December of year N in a common year.
- **Grace decision and evidence.** `grace_days: 14`. The provider states a
  fifteen-day window and the observed release fell inside it; a fortnight's
  grace tolerates a release slipping just past the window without letting a
  skipped release go unnoticed.
- **UTC workflow cron derivation.** `0 6 20 2 *`: 06:00 UTC (07:00 CET) on 20
  February, five days after the stated window closes and inside the grace
  window that expires on 1 March.
