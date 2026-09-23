# OECD quarterly labour force participation rate snapshot contract

This public acquisition package fetches one credential-free OECD SDMX request
for the harmonised quarterly labour force participation rate of every reference
area the OECD publishes at that frequency, for total, men and women aged 15 or
over, seasonally adjusted, expressed as a percentage of the working-age
population in the same subgroup, from 2000-Q1 onwards. On 2026-09-14 that was 45
reference areas, including Switzerland and New Zealand, which the monthly
unemployment dataflow does not carry.

The `SEX` dimension is deliberately left open across total, men and women,
because the gap between men's and women's participation is one of the questions
this data exists to answer. Every other dimension of the SDMX key is pinned, and
a response carrying any other value for a pinned dimension is rejected as
describing something other than what was declared.

## Why this is a separate source from `oecd-unemployment-rate`

Both come from the same provider on the same news-release calendar, but they
advance at different frequencies: unemployment rates are monthly, participation
rates quarterly. Declaring one source for both would force a single
`source_data_date`, and the greater of a monthly and a quarterly period is
always the monthly one — so `pulse status` would advertise the quarterly
participation data as fresher than it is, every month of the year. Two packages
each state their own represented date truthfully.

## Representation

As for `oecd-unemployment-rate`, this package negotiates SDMX-CSV 2.0 with
`labels=both` through the `Accept` header rather than the `csvfilewithlabels`
file format. That format splits each dimension into a code column and a label
column differing only in case, which the DuckDB-backed Parquet writer cannot
store at all (`Catalog Error: Column with name Age already exists!`). SDMX-CSV
2.0 carries one column per dimension holding `"<code>: <label>"`, so nothing
collides and no provider field has to be dropped. Splitting the composite value
is a decoding decision for a dataset package.

`source_data_date` is the provider's publication edge: the last day of the
newest quarter carrying any observation. Reference areas reach that edge at
different speeds, and the spread is recorded as a plausibility assertion with a
three-quarter tolerance rather than hidden by back-dating the snapshot. The
assertion measures every area still being published; Brazil, whose quarterly
participation rate ends at 2015-Q3, is declared discontinued and held out, so a
series the OECD has retired cannot hold every future release suspect.

## Provider access

On 2026-09-23 `sdmx.oecd.org` answered HTTP 403 to requests carrying Python's
default `Python-urllib/3.x` User-Agent, while the same URL returned 200 to
curl's agent or to any explicit one. The adapter therefore sends
`User-Agent: pulse-data-pipeline/1.0`, which names the
pipeline honestly rather than impersonating a browser. A 403 from this provider
should be read first as an agent refusal, not a withdrawn dataset.

## Sex coverage, and why the assertion is scoped

`men_and_women_are_reported_wherever_a_total_is` covers every reference area
except those declared in `sex_incomplete_reference_areas`. Checked against the
full history on 2026-09-14, 96 of 4,373 area-quarter cells carry a total without
a men/women split: 54 for Brazil, which carries none at any date, 28 for Croatia
and 14 for the OECD aggregate between 2007 and 2010. Those three are the
declared exclusions and every other area is complete, so the assertion is a real
guarantee rather than a permanently red one.

Excluding by known provider gap rather than including a handful of chosen
countries matters: a consumer that changes which areas it draws must not be able
to weaken, or need to touch, an acquisition contract.

## Scheduling evidence

- **Provider access and native scope.** `https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_LFS@DF_IALFS_LF_WAP_Q,1.0/...`,
  checked 2026-09-14, with the `DSD_LFS` datastructure read the same day to fix
  the dimension order and the key.
- **Licence and attribution.** Creative Commons Attribution 4.0 International
  (CC BY 4.0), the OECD's default licence for content published from 1 July
  2024, checked 2026-09-14. Adaptation and redistribution are permitted with
  attribution; an adaptation must not use the OECD logo or visual identity and
  must carry the OECD adaptation disclaimer, which the declared attribution
  string includes.
- **Publication cadence and window.** Quarterly, from Paris, on the OECD's
  *Unemployment rates and Labour Market Situation* calendar read on 2026-09-14:
  15 January, 12 February, 12 March, 16 April, 22 May, 11 June, 7 July, 10
  September, 15 October, 10 November, 10 December 2026. Direct provider
  evidence: on 2026-09-14 the publication edge stood at 2026-Q2, which ended on
  2026-06-30, so that quarter reached the edge within 72 days.
- **Provider timezone.** Europe/Paris (CET in winter, CEST in summer).
- **Declared expected deadline.** `expected_within_days: 80`, measured from the
  end of the represented quarter. The one directly observed advance was +72
  days; 80 allows margin above it without stretching so far that a genuinely
  skipped quarter goes unreported. Like the localised INSEE source, this rests
  on a single observed release and should be revisited once a second has been
  seen.
- **Grace decision.** `grace_days: 14`, matching the 15-day spread in the OECD's
  own 2026 release days (from the 7th to the 22nd of the month). The calendar is
  republished rather than fixed a year ahead, so the tolerance tracks observed
  movement in the calendar itself.
- **UTC workflow cron derivation.** `0 10 25 1,4,7,10 *`. Quarters end on 31
  March, 30 June, 30 September and 31 December; the 25th of the month following
  the quarter's release month places a run at +86 to +87 days after the quarter
  end, after the observed +72-day advance and before the declared deadline plus
  grace expires at +94 days. A single run a month is enough here, unlike the
  monthly sibling, because a quarterly cadence leaves far more room between the
  release and the deadline. 10:00 UTC is after the Paris publication under both
  CET and CEST.

Reuse is under CC BY 4.0 with the attribution declared in `source.yaml`. The
only durable output owned here is faithful raw Parquet plus the generic
immutable `snapshot.json` manifest. Splitting codes from labels, classifying
reference areas, and every presentation decision belong to independent packages
under `datasets/`.
