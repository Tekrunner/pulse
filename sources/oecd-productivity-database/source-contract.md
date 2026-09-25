# OECD Productivity Database snapshot contract

This public acquisition package fetches one credential-free OECD SDMX response
from the Productivity Database (`OECD.SDD.TPS:DSD_PDB@DF_PDB(2.0)`), pinned to
annual frequency, the total economy (`ACTIVITY=_T`) and eight measures:

- `GDP` — gross domestic product.
- `GDPPOP` — GDP per capita.
- `GDPHRS` — GDP per hour worked.
- `GDPEMP` — GDP per person employed.
- `POP` — population.
- `EMP` — employment.
- `HRSAV` — average hours worked per person employed.
- `HRSTO` — total hours worked.

Every reference area the provider sends is retained: OECD members, partner
economies and the OECD, EU and euro-area aggregates (46 areas on 2026-09-23).
Which areas a consumer needs is a question about membership, answered by the
dataset package that declares it. Units, price bases and transformations are
not pinned: the provider publishes each measure in national currency and in PPP
US dollars, at current prices, constant prices and in chain-linked volumes, and
as levels and as annual growth rates (`TRANSFORMATION` `N` and `GY`). Every one
is kept as a provider row.

The provider answers as SDMX-CSV 2.0 with `labels=both`, so every dimension
column holds `"<code>: <label>"`, kept exactly as sent; splitting code from
label is a decoding decision for a dataset. `snapshot-contract.yaml` requires
the structure, dimension, period, value, status and unit-multiplier columns;
compatible additions are retained and change the observed-schema hash.

The adapter rejects a response missing a declared dimension column, repeating a
column name, carrying a frequency, activity or measure outside the pinned key,
lacking one of the declared measures, carrying a non-year period, or repeating
an observation.

`source_data_date` is the last day of the provider's publication edge: the
latest year for which any area publishes any declared measure.

## What the provider does that a consumer must know

- **Rows without an observation.** For a series key it holds no data for, the
  provider emits a row with an empty period and an empty value (88 rows on
  2026-09-23, all per-capita series in national currency). They are kept as
  sent and exempt from the period and value checks.
- **Areas reach the edge years apart.** On 2026-09-23 the edge was 2025; GDP in
  national currency stopped at 2024 for Bulgaria and Costa Rica, 2023 for
  Brazil and 2021 for Peru, and GDP per hour worked stopped at 2021 for Türkiye.
- **Hours start late for many areas.** Hours-based measures start in 1970 for
  France, 1980 for the United Kingdom, 1987 for the United States and 1991 for
  Germany, and later still for several members.
- **Rolling revisions.** Each variable is replaced whenever its underlying
  source is, so any snapshot can revise any year.

## Assertions

- `every_observation_value_is_numeric` — every dated row carries a number.
- `every_reference_area_carries_both_a_code_and_a_label` — the area column is
  a well-formed code and label pair on every row.
- `most_reference_areas_publish_gdp_for_the_publication_edge` — more than half
  the areas publishing GDP in national currency at current prices have a value
  for the edge year, so the edge reflects a release rather than one early
  reporter.

## Access note

`sdmx.oecd.org` answers HTTP 403 to Python's default `Python-urllib` user agent
and 200 to the same request carrying another agent (observed 2026-09-23), so the
adapter identifies itself as `pulse-data-pipeline/1.0`.

## Scheduling evidence

- **Provider access and native scope.** `https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_PDB@DF_PDB,2.0/.A.GDP+GDPPOP+GDPHRS+GDPEMP+POP+EMP+HRSAV+HRSTO._T.....`,
  checked 2026-09-23 against the `DSD_PDB` datastructure, which fixes the
  dimension order `REF_AREA, FREQ, MEASURE, ACTIVITY, UNIT_MEASURE, PRICE_BASE,
  TRANSFORMATION, ASSET_CODE, CONVERSION_TYPE`. 57,801 rows, edge 2025.
- **Licence and attribution.** Creative Commons Attribution 4.0 International
  (CC BY 4.0), the OECD's default licence for content published from 1 July
  2024, the same terms recorded for the repository's other OECD sources.
  Redistribution and adaptation are permitted with attribution; an adaptation
  must carry the OECD adaptation disclaimer, which the declared attribution
  includes.
- **Publication cadence and window.** The OECD describes the Productivity
  Database as updated on a rolling basis, each variable published as soon as it
  is updated in its source databases, with no release calendar (OECD search
  results for the database and its Compendium, 2026-09-23; the OECD site refused
  automated retrieval of the page itself with HTTP 403). The same results give a
  last update of 26 May 2026 and the *OECD Compendium of Productivity Indicators
  2026* on 23 June 2026. The response of 2026-09-23 carried 2025 for 40 of 45
  areas publishing GDP per capita at current PPP.
- **Provider timezone.** Europe/Paris.
- **Declared expected deadline and grace — an explicit human decision.**
  Because the provider publishes no calendar, the requester chose the schedule
  on 2026-09-23: year N is expected by 30 September of year N+1,
  `expected_within_days: 273`, with `grace_days: 30`. This is looser than the
  late-May update observed in 2026, deliberately tolerating a late spring
  update without reporting it as a fault.
- **UTC workflow cron derivation.** `0 10 5 1,4,7,10 *`, also chosen by the
  requester as a quarterly refresh: 10:00 UTC on the 5th of January, April,
  July and October, after the Paris working morning in both CET and CEST. The
  5 October run falls five days after the deadline and inside the grace window
  that expires on 30 October; the July run normally already finds the new year.
