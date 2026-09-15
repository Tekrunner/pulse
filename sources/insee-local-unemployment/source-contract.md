# INSEE localised unemployment rate snapshot contract

This public acquisition package fetches one combined, credential-free INSEE BDM
SDMX 2.1 `StructureSpecificData` response covering all 115 published territorial
series of the localised unemployment rate: metropolitan France, France excluding
Mayotte, the 13 metropolitan regions, and 100 departements — the 96 metropolitan
departements including Corse-du-Sud and Haute-Corse, plus Guadeloupe, Martinique,
Guyane and La Réunion. Mayotte has no localised series, which is why the national
reference published in this dataflow is France *excluding* Mayotte.

Those series are acquisition scope, not a declaration of any Pulse dataset. Each
entry in `source.yaml` records the INSEE IDBANK, the provider `REF_AREA` code and
the French catalogue title, so the adapter can reject a missing, unexpected,
duplicate, retitled or re-territorialised series before a snapshot is accepted.
The `REF_AREA` code is recorded as well as the IDBANK because the territory is
the join key every consumer will use; a series silently moving to another
territory would otherwise be invisible.

The adapter preserves every `Series` and `Obs` attribute as a string-valued
Parquet column without analytical renaming, typing, calculation or
classification. The machine-readable `snapshot-contract.yaml` requires the
source-native fields `IDBANK`, `TITLE_FR`, `TIME_PERIOD`, `OBS_VALUE`, `FREQ`,
`REF_AREA`, `UNIT_MEASURE` and `UNIT_MULT`; compatible provider additions are
retained and change the observed-schema hash.

`source_data_date` is derived transparently from the greatest provider
`TIME_PERIOD`: quarterly `YYYY-Qn` becomes the last day of that quarter, for the
same reason as every quarterly source here — `pulse` derives the publication
deadline by advancing one period from the represented date, so a date taken from
a quarter start would place the deadline a full quarter early.

## Relationship to the national series, and why this is a separate source

This dataflow is released on its own calendar, roughly five weeks after the
national ILO series in `insee-labour-market`, so at any moment the localised
figures normally describe an earlier quarter than the national headline. When
both were queried on 2026-09-14, the national series carried 2026-Q2 and the
localised series carried 2026-Q1. Declaring one source for both would force one
of the two publication deadlines to be wrong, which is the whole reason these
are separate packages rather than one larger one.

The national reference series published here are metropolitan France and France
excluding Mayotte, while the national headline in `insee-labour-market` is
France *including* Mayotte. These are different geographies and therefore
different numbers. Reconciling or choosing between them is an analytical
decision that belongs to a dataset, not to acquisition.

## Scheduling evidence

- **Provider access and native scope.** `https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/<idbank>+...`,
  checked 2026-09-14. The `TAUX-CHOMAGE` dataflow was enumerated the same day and
  returned exactly 115 series, whose territorial composition is recorded above.
- **Licence and attribution.** Licence Ouverte / Open Licence 2.0, checked
  2026-09-14: reuse, adaptation and redistribution, including commercially, on
  condition of attributing the producer and the date of last update, with no
  share-alike obligation.
- **Publication cadence and window.** Quarterly, published as an INSEE
  *Informations Rapides* at 07:30 Europe/Paris. Direct provider evidence: every
  series carried `LAST_UPDATE` 2026-06-19 with a greatest `TIME_PERIOD` of
  2026-Q1 when queried on 2026-09-14. 2026-Q1 ended on 2026-03-31, so that
  release fell +80 days after the quarter it describes. INSEE announces exact
  dates in a four-month calendar published on the 25th of each month, of which
  only the first month's dates are fixed.
- **Provider timezone.** Europe/Paris (CET in winter, CEST in summer).
- **Declared expected deadline.** `expected_within_days: 85`, measured from the
  end of the represented quarter. The one directly observed release fell at +80
  days; 85 allows a small margin above it. This is a weaker evidence base than
  the national source, where two consecutive releases were observed, and it
  should be revisited once a second localised release has been seen.
- **Grace decision.** `grace_days: 14`, for the same documented reason as the
  national source: INSEE fixes only the first month of its four-month calendar,
  so an announced date can move. Fourteen days absorbs that movement while still
  flagging a genuinely missed quarter long before the next one is due.
- **UTC workflow cron derivation.** `0 8 25 3,6,9,12 *`. Quarters end on 31
  March, 30 June, 30 September and 31 December, so the 25th of June, September,
  December and March falls +84 to +87 days after the quarter end: after the
  observed +80-day release with four to seven days of margin, and before the
  declared deadline plus grace expires at +99 days, leaving roughly a fortnight
  in which a failed run can be retried before the source is reported stale.
  07:30 Europe/Paris is 05:30 UTC under CEST and 06:30 UTC under CET, so 08:00
  UTC is safely after publication in both offsets. A quarterly cron is preferred
  over polling because an acquisition with a new logical run key writes a new
  immutable snapshot even when the provider bytes are unchanged.

Reuse is under Licence Ouverte / Open Licence 2.0 with the attribution declared
in `source.yaml`. The only durable output owned here is faithful raw Parquet
plus the generic immutable `snapshot.json` manifest. Territorial aggregation,
choice of national reference, map geometry, classification into bands and any
comparison with the national ILO series belong to independent packages under
`datasets/`. `pulse source acquire insee-local-unemployment` never loads or
executes them.
