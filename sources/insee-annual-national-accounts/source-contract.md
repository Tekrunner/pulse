# INSEE annual national accounts snapshot contract

This public acquisition package fetches three credential-free INSEE BDM SDMX 2.1
`StructureSpecificData` responses, one per dataflow of the base-2020 annual
national accounts, each requested whole:

- `CNA-2020-PIB` — GDP at current prices and in chained volumes, GDP per
  inhabitant, and the contributions of expenditure components to GDP volume
  growth (21 series, 1949 onward).
- `CNA-2020-CPEB` — production and operating accounts by branch: output,
  intermediate consumption, value added, compensation of employees (wages and
  employers' contributions), gross operating surplus, and operating surplus plus
  mixed income, at current prices and in chained 2020 euros, for the total
  economy and at the A5, A10, A17, A38 and A88 nomenclature levels (1,890
  series).
- `CNA-2020-EMPLOI` — domestic employment by employment type (total, employees,
  non-employees), in persons and full-time equivalents, hours worked, average
  hours and hourly productivity, by institutional sector and branch (683
  series).

The dataflows are acquisition scope, not a declaration of any Pulse dataset.
Scope is declared by dataflow rather than by IDBANK because every series in
these dataflows belongs to one release: a series INSEE adds is a compatible
addition, not an unannounced intruder. The adapter rejects a response whose
SDMX header answers a different dataflow, a dataflow with no series, a missing
or duplicated IDBANK, a series with no observations, and a non-annual period.

The adapter preserves every `Series` and `Obs` attribute as a string-valued
Parquet column, repeating series attributes on each observation, without
analytical renaming, typing, calculation or classification. The dataflows do not
share one set of dimensions, so a column carried by only one dataflow is null on
rows from the others. The machine-readable `snapshot-contract.yaml` requires the
fields every dataflow carries: `IDBANK`, `TITLE_FR`, `TIME_PERIOD`, `OBS_VALUE`,
`FREQ`, `REF_AREA`, `INDICATEUR`, `NATURE`, `UNIT_MEASURE`, `UNIT_MULT`,
`SERIE_ARRETEE` and `LAST_UPDATE`. Compatible provider additions are retained and
change the observed-schema hash.

`source_data_date` is the last day of the greatest provider `TIME_PERIOD` across
the three dataflows, so the represented date is the end of the latest year the
release describes. Acquisition time remains a separate runtime timestamp. The
adapter sends the SDMX StructureSpecific XML media type, uses a 120-second
timeout because the branch dataflow is about 9 MB, and needs no credentials.

## What the provider does that a consumer must know

- **Detail lags the total by a year.** At the May 2026 release every
  total-economy series reached 2025, while 948 branch series stopped at 2024:
  INSEE publishes the provisional year only at coarse branch detail.
- **Some branch series are no longer maintained.** 406 `CNA-2020-CPEB` series
  and 217 `CNA-2020-EMPLOI` series carried `LAST_UPDATE` 2024-06-21 and end in
  2022 or 2023, with `SERIE_ARRETEE=FALSE`. They are the copies of a branch that
  is defined identically at more than one nomenclature level — construction is
  `A5-FZ`, `A10-FZ`, `A17-FZ` and `A38-FZ`; coke and refined petroleum is
  `A17-C2`, `A38-CD` and `A88-19` — and only one copy is kept current. No two
  series share a dimension key, so these are distinct provider series, not
  duplicates in the response. A consumer reading a branch must resolve it to
  its maintained copy rather than take the series under the level it asked for.
- **Chained volumes are not additive.** Series in chained 2020 euros
  (`PRIX_REF=PCH`) do not sum across branches or components; the contributions
  to growth in `CNA-2020-PIB` are the additive decomposition the provider
  publishes.
- **Release revises history.** Each release publishes the provisional year N-1,
  the semi-definitive N-2 and the definitive N-3 together, so the three latest
  years change at every snapshot.

## Assertions

Each answers a question about the provider's response:

- `every_observation_is_annual` — every row carries `FREQ=A`.
- `every_observation_value_is_numeric` — every `OBS_VALUE` parses as a number.
- `every_series_has_a_distinct_dimension_key_within_its_dataflow` — no two
  series in a dataflow describe the same combination of dimensions.
- `every_total_economy_series_reaches_the_latest_year` — the release advanced:
  every series without a branch, or on the total-economy branch `NNTOTAL`,
  reaches the greatest year in the response. Branch series are exempt because
  of the one-year detail lag and the unmaintained copies above.

## Scheduling evidence

- **Provider access and native scope.** `https://bdm.insee.fr/series/sdmx/data/<dataflow>`
  for the three dataflows, checked 2026-09-22 against the dataflow listing at
  `https://bdm.insee.fr/series/sdmx/dataflow/FR1/all`, which lists the base-2020
  dataflows `CNA-2020-PIB`, `CNA-2020-CPEB` and `CNA-2020-EMPLOI` beside the
  retained bases 2010 and 2014.
- **Licence and attribution.** Licence Ouverte / Open Licence 2.0, the licence
  INSEE applies to its open data, checked 2026-09-22. It permits reuse,
  adaptation and redistribution including commercially, conditional on
  attributing the producer and the date of last update. There is no share-alike
  obligation.
- **Publication cadence and window.** Annual. INSEE's note on revisions,
  `https://www.insee.fr/fr/statistiques/fichier/8988934/Note_revisions_2023a2025.pdf`,
  linked from *Les comptes de la Nation en 2025*
  (`https://www.insee.fr/fr/statistiques/8988934`, checked 2026-09-22),
  describes the annual national accounts "publiés le 29 mai 2026" and compares
  them with the previous publication of 28 May 2025. INSEE began publishing base
  2020 on 31 May 2024. Every maintained series in the three dataflows carried
  `LAST_UPDATE` 2026-05-29 when queried on 2026-09-22, with 2025 as the latest
  year of every total-economy series.
- **Provider timezone.** Europe/Paris.
- **Declared expected deadline.** `expected_within_days: 150` after the end of
  the represented year. The three observed releases fell 148 days (2025-05-28),
  149 days (2026-05-29) and 152 days (2024-05-31) after the end of the year they
  added; 150 days places the deadline on 30 May, inside that range.
- **Grace decision and evidence.** `grace_days: 14`. The observed release day
  has moved between 28 and 31 May; fourteen days absorbs a release slipping into
  the first half of June, which the calendar has not shown but which a Friday or
  public-holiday shift could cause, without letting a missed release pass
  unnoticed through the summer.
- **UTC workflow cron derivation.** `0 6 2,12 6 *`: 06:00 UTC (08:00
  Europe/Paris, CEST) on 2 and 12 June. The first run falls two to five days
  after every observed release; the second is a retry inside the grace window,
  before the declared deadline plus grace expires on 13 June. A run that finds
  the same content is a no-op.
