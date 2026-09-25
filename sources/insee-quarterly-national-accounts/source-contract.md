# INSEE quarterly national accounts GDP snapshot contract

This public acquisition package fetches one combined, credential-free INSEE BDM
SDMX 2.1 `StructureSpecificData` response covering three quarterly series of the
base-2020 quarterly national accounts, all seasonally and working-day adjusted
(CVS-CJO), France (`REF_AREA=FE`), from 1949:

- `011794860` — GDP in chained volumes at previous-year prices, millions of
  euros, quarterly level.
- `011794859` — GDP at current prices, millions of euros, quarterly level.
- `011794844` — quarter-on-quarter GDP volume growth, per cent.

Those series are acquisition scope, not a declaration of any Pulse dataset.
Their IDBANKs and French catalogue titles are retained exactly in `source.yaml`
so the adapter rejects missing, unexpected, duplicate or renamed provider series
before a snapshot is accepted. The French title is the identity anchor because
it is the provider's own; the English title is a translation maintained
separately.

The adapter preserves every `Series` and `Obs` attribute as a string-valued
Parquet column, repeating series attributes on each observation, without
analytical renaming, typing, calculation or classification.
`snapshot-contract.yaml` requires `IDBANK`, `TITLE_FR`, `TIME_PERIOD`,
`OBS_VALUE`, `FREQ`, `REF_AREA`, `UNIT_MEASURE`, `UNIT_MULT` and `LAST_UPDATE`;
compatible provider additions are retained and change the
observed-schema hash. A `SERIES_BDM` response carries fewer attributes than the
dataflow it draws from — no `CORRECTION`, `NATURE` or `VALORISATION` — so the
seasonal adjustment and price basis are identified by the retained French
title, which states both.

`source_data_date` is the last day of the greatest provider quarter, so the
publication deadline is derived from the end of the period described.

## What the provider does that a consumer must know

- **Levels are quarterly, not annualised.** The level series are the value of
  GDP produced in the quarter; four quarters sum to a year.
- **Every release revises.** The first estimate of a quarter is revised by the
  detailed results a month later, and each release can revise earlier quarters.
  The quarterly accounts are benchmarked to the annual accounts only once a
  year, after the annual release at the end of May, so between May and the
  next benchmark the two can disagree on recent years.

## Assertions

- `every_observation_is_quarterly` — every row carries `FREQ=T`.
- `every_observation_value_is_numeric` — every `OBS_VALUE` parses as a number.
- `every_gdp_level_is_positive` — no observation published in euros is zero or
  negative.
- `every_declared_series_reaches_the_same_latest_quarter` — the release advanced
  the volume, value and growth series together.

## Scheduling evidence

- **Provider access and native scope.** `https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/011794860+011794859+011794844`,
  checked 2026-09-23. The series were selected from dataflow
  `CNT-2020-PIB-EQB-RF` (68 series), enumerated the same day.
- **Licence and attribution.** Licence Ouverte / Open Licence 2.0, checked
  2026-09-23. It permits reuse, adaptation and redistribution including
  commercially, conditional on attributing the producer and the date of last
  update; no share-alike obligation.
- **Publication cadence and window.** Quarterly, in two INSEE *Informations
  Rapides* per quarter. Observed on insee.fr, checked 2026-09-23: the first
  estimate of 2026-Q1 on 30 April 2026 (n° 106,
  `https://www.insee.fr/fr/statistiques/8986227`); the first estimate of
  2026-Q2 on 30 July 2026 (n° 184, `https://www.insee.fr/fr/statistiques/9033097`);
  the detailed results of 2026-Q2 (n° 212,
  `https://www.insee.fr/fr/statistiques/9039499`), matching the `LAST_UPDATE`
  2026-08-28 carried by the three series with a latest period of 2026-Q2.
- **Provider timezone.** Europe/Paris; INSEE releases *Informations Rapides* at
  07:30 local time.
- **Declared expected deadline.** `expected_within_days: 31`. Both observed
  first estimates fell 30 days after the quarter ended (31 March to 30 April,
  30 June to 30 July), and the first estimate is the release that adds a new
  quarter; the detailed results revise it but do not advance the represented
  date. 31 days covers the fourth quarter, whose first estimate falls at the end
  of January.
- **Grace decision and evidence.** `grace_days: 7`. The first estimate has been
  published on the 30th of the month following the quarter; seven days absorbs a
  shift of the release to the following week without hiding a missed quarter.
- **UTC workflow cron derivation.** `0 8 2 * *`: 08:00 UTC on the 2nd of every
  month. 08:00 UTC is after 07:30 Europe/Paris under both CET and CEST. The runs
  on 2 February, May, August and November fall two to three days after each
  first estimate and inside the grace window; the runs on 2 March, June,
  September and December pick up the detailed results published at the end of
  the preceding month. The remaining months find unchanged content, which is a
  no-op.
