# INSEE quarterly ILO labour-market snapshot contract

This public acquisition package fetches one combined, credential-free INSEE BDM
SDMX 2.1 `StructureSpecificData` response covering twenty-five quarterly series
measured by the *enquête Emploi* on the ILO (BIT) definition: the unemployment
rate and the number of unemployed people, each for the whole population, for the
three published age bands and for each sex; long-term unemployment as a count
and as a rate; the halo around unemployment as a count and as a published share
of the population; underemployment as a count and as a rate; and the activity
(labour force participation) rate for both sexes together and separately, for
all ages and for 15-to-64-year-olds.

Those series are acquisition scope, not a declaration of any Pulse dataset.
Their INSEE IDBANKs and French catalogue titles are retained exactly in
`source.yaml` so the adapter can reject missing, unexpected, duplicate or
renamed provider series before a snapshot is accepted. French titles rather
than the English ones are the identity anchor because the French catalogue
title is the provider's own, while the English field is a translation that
INSEE maintains separately and has been observed to contain errors; a
translation being corrected must not look like a series being renamed.

The adapter preserves every `Series` and `Obs` attribute as a string-valued
Parquet column, repeating series attributes on each observation, without
analytical renaming, typing, calculation or classification. The
machine-readable `snapshot-contract.yaml` requires the source-native fields
`IDBANK`, `TITLE_FR`, `TIME_PERIOD`, `OBS_VALUE`, `FREQ`, `REF_AREA`,
`UNIT_MEASURE` and `UNIT_MULT`; compatible provider additions are retained and
change the observed-schema hash.

Every observation in scope is `REF_AREA=FE`, which is France including Mayotte,
and every series is seasonally adjusted. Choosing one reference area and one
adjustment in acquisition scope keeps the snapshot internally comparable; it is
not an analytical decision about how any of these measures should be read.

`source_data_date` is derived transparently from the greatest provider
`TIME_PERIOD`: quarterly `YYYY-Qn` becomes **the last day of that quarter**.
The represented date is the end of the represented period rather than its
start, because `pulse` derives the publication deadline by advancing from that
date by one period; deriving a quarterly deadline from a quarter *start* would
place it a full quarter early. Acquisition time remains a separate runtime
timestamp. The adapter sends the SDMX StructureSpecific XML media type, uses a
30-second timeout, and needs no credentials.

## Scheduling evidence

- **Provider access and native scope.** `https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/<idbank>+...`,
  checked 2026-09-14. The dataflow listing at `https://bdm.insee.fr/series/sdmx/dataflow`
  and the datastructures for `CHOMAGE-TRIM-NATIONAL` and `EMPLOI-BIT-TRIM` were
  read the same day; 104 and 122 live series respectively were enumerated before
  the twenty-five in scope here were selected.
- **Licence and attribution.** Licence Ouverte / Open Licence 2.0, the licence
  INSEE applies to its open data, checked 2026-09-14. It permits reuse,
  adaptation and redistribution including commercially, conditional on
  attributing the producer and the date of last update. There is no share-alike
  obligation.
- **Publication cadence and window.** Quarterly, published as an INSEE
  *Informations Rapides* at 07:30 Europe/Paris. Two consecutive releases were
  observed directly: 2026-Q1 on 2026-05-13 (Informations Rapides 113) and
  2026-Q2 on 2026-08-07 (Informations Rapides 192). Every live series in both
  dataflows carried `LAST_UPDATE` 2026-08-07 with a greatest `TIME_PERIOD` of
  2026-Q2 when queried on 2026-09-14, which corroborates that the whole scope
  advances in one release rather than piecemeal. INSEE states that it announces
  exact dates in a calendar published on the 25th of each month covering four
  months, of which only the first month's dates are fixed.
- **Provider timezone.** Europe/Paris (CET in winter, CEST in summer).
- **Declared expected deadline.** `expected_within_days: 45`, measured from the
  end of the represented quarter. The two observed releases fell at +43 days
  (Q1) and +38 days (Q2); 45 covers both with a small margin and is not a
  rounded guess at a cadence word.
- **Grace decision.** `grace_days: 14`. This is a tolerance for the movement
  INSEE itself documents: only the first month of its four-month calendar is
  fixed, so a release announced for a later month can move. Fourteen days
  absorbs a shift of up to two weeks without reporting false staleness, and
  still flags a genuinely missed quarter well before the next one is due. The
  figure is a derivation from that documented practice, not a copied constant.
- **UTC workflow cron derivation.** `0 8 22 2,5,8,11 *`. Quarters end on 31
  March, 30 June, 30 September and 31 December, so the 22nd of May, August,
  November and February falls +52 to +53 days after the quarter end. That is
  after the largest observed lag (+43 days) with at least nine days of margin,
  and six to seven days before the declared deadline plus grace expires at +59
  days, so a single failed run still has room to be retried by hand before the
  source is reported stale. 07:30 Europe/Paris is 05:30 UTC under CEST and
  06:30 UTC under CET; running at 08:00 UTC is safely after publication in both
  offsets. A quarterly cron is deliberately preferred over weekly polling
  because an acquisition with a new logical run key writes a new immutable
  snapshot even when the provider bytes are unchanged, so polling would fill the
  archive with duplicates.

Reuse is under Licence Ouverte / Open Licence 2.0 with the attribution declared
in `source.yaml`. The only durable output owned here is faithful raw Parquet
plus the generic immutable `snapshot.json` manifest.

Dataset selection, output columns, analytical types, formulas, the relationship
between these measures, tests, and report limitations belong to independent
packages under `datasets/`. `pulse source acquire insee-labour-market` never
loads or executes them.
