# OECD monthly unemployment rate snapshot contract

This public acquisition package fetches one credential-free OECD SDMX request
for the harmonised monthly unemployment rate of every reference area the OECD
publishes at that frequency: total population, 15 years or over, seasonally and
calendar adjusted, expressed as a percentage of the labour force in the same
subgroup, from January 2000 onwards. On 2026-09-14 that was 43 reference areas,
comprising OECD members, several non-member EU states, and the euro area, EU,
G7 and OECD aggregates.

## Why SDMX-CSV 2.0 rather than the labelled CSV file format

The obvious representation, `format=csvfilewithlabels`, splits every dimension
into a code column and a label column whose names differ only in case:
`ADJUSTMENT` beside `Adjustment`, `AGE` beside `Age`, `SEX` beside `Sex`, and so
on. Pulse archives provider rows through DuckDB, whose catalog resolves column
names case-insensitively, so such a payload cannot be stored at all: it fails
with `Catalog Error: Column with name Age already exists!`. Setting
`preserve_identifier_case` does not change this.

Rather than drop provider columns to fit the writer, this package negotiates
SDMX-CSV 2.0 with `labels=both` through the `Accept` header. That representation
carries exactly one column per dimension, holding `"<code>: <label>"`, so no two
column names collide and both the code and the OECD's own label survive
unaltered. The labels matter: `REF_AREA` carries the OECD's country names, and a
consumer that re-invented them would be inventing data. Splitting the composite
value is a decoding decision for a dataset package, not for acquisition.

## Scope checks and what they mean

`source.yaml` pins every non-territorial dimension of the SDMX key. The adapter
rejects a response whose pinned dimensions carry any other value, because such a
response describes something other than what was declared. It also rejects a
response whose observations are not numeric, not monthly, or outside 0 to 100.
It names no reference area at all: every area is retained exactly as sent, and
which areas must exist is a question about OECD membership, answered where that
membership is declared — in the dataset package. A list of required areas here
would make an acquisition contract depend on what some consumer draws first.

`source_data_date` is the provider's **publication edge**: the last day of the
newest month for which the response carries any observation. That is what the
source-level deadline should judge, because it answers "did the OECD release".
Reference areas reach that edge at very different speeds — on 2026-09-14 the
United States had reached 2026-08, 38 areas had reached 2026-07, and the United
Kingdom, whose rolling-quarter survey publishes later, had only reached 2026-05.
The lag assertion measures that spread across every area in the response and
tolerates four months, which leaves one month of headroom over the widest lag
observed on 2026-09-14.
Back-dating the whole snapshot to the slowest required member would claim a
staleness the provider does not have and would hide the spread instead of
exposing it. The spread is recorded as a plausibility assertion with a
four-month tolerance. It is real provider structure rather than an acquisition
defect, and the snapshot records it instead of back-dating to the slowest area;
what a consumer does with it is the consumer's decision.

## Known coverage gap

Switzerland and New Zealand are OECD members but do not appear in this monthly
dataflow; they do appear in the quarterly participation dataflow acquired by
`oecd-participation-rate`. This is a provider coverage fact, not an acquisition
defect. The snapshot records the coverage as the provider sent it, and the
quarterly participation dataflow is where those two members do appear.

## Scheduling evidence

- **Provider access and native scope.** `https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0/...`,
  checked 2026-09-14. The `OECD.SDD.TPS` dataflow listing and the `DSD_LFS`
  datastructure were read the same day to fix the dimension order and the key.
- **Licence and attribution.** Creative Commons Attribution 4.0 International
  (CC BY 4.0), the OECD's default licence for content published from 1 July
  2024, checked 2026-09-14. Redistribution and adaptation are permitted with
  attribution; an adaptation must not use the OECD logo or visual identity and
  must carry the OECD adaptation disclaimer, which is why the declared
  attribution string includes it.
- **Publication cadence and window.** Monthly, from Paris. The OECD's own 2026
  release calendar for *Unemployment rates and Labour Market Situation* was read
  on 2026-09-14 and gives: 15 January, 12 February, 12 March, 16 April, 22 May,
  11 June, 7 July, 10 September, 15 October, 10 November, 10 December. **There
  is no August release**, so the publication edge stands still for two months
  each summer and then advances twice at once.
- **Provider timezone.** Europe/Paris (CET in winter, CEST in summer).
- **Declared expected deadline.** `expected_within_days: 45`, measured from the
  end of the represented period. Because the represented date is the publication
  edge, the deadline asks when the *next* month should have reached the edge.
  Against the 2026 calendar that lag is 7 to 22 days in eleven months of the
  year and 41 days for July, which is carried across the August gap to the 10
  September release. 45 covers the worst documented case with a small margin; a
  tighter figure would report the OECD's own published calendar as a fault.
- **Grace decision.** `grace_days: 14`, covering the observed movement in the
  calendar itself: across 2026 the release day ranges from the 7th to the 22nd
  of the month, a spread of 15 days, and the calendar is republished rather than
  fixed a year ahead. Fourteen days absorbs that movement without masking a
  genuinely skipped release.
- **UTC workflow cron derivation.** `0 10 13,25 * *`. Every 2026 release falls
  between the 7th and the 22nd, so a run on the 13th collects the early-month
  releases and a run on the 25th collects the late-month ones; each run is at
  10:00 UTC, after the Paris working-morning publication in both CET and CEST.
  Two runs a month are deliberate rather than incidental: with a single run on
  the 25th, the worst case — the edge frozen at June until the 10 September
  release — leaves only three days between the deadline at +59 days and the next
  scheduled run, whereas the run on the 13th restores a fortnight of margin. The
  cost is small and measured: the full history archives to a 57 KB Parquet
  snapshot.

Reuse is under CC BY 4.0 with the attribution declared in `source.yaml`. The
only durable output owned here is faithful raw Parquet plus the generic
immutable `snapshot.json` manifest. Splitting codes from labels, classifying
reference areas into OECD members and aggregates, aligning this monthly series
with quarterly French data, and every presentation decision belong to
independent packages under `datasets/`.
