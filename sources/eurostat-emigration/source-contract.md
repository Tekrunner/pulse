# Source acquisition evidence

## Provider access and native scope

Eurostat dissemination SDMX 2.1 REST, checked 16 September 2026:

```
https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/migr_emi1ctz/A.TOTAL.COMPLET.TOTAL.NR.T.?format=SDMX-CSV
```

Anonymous HTTPS, no registration, token or referer. The response is SDMX-CSV
1.0, roughly 74 kB, one row per observation with the columns `DATAFLOW`,
`LAST UPDATE`, `freq`, `citizen`, `agedef`, `age`, `unit`, `sex`, `geo`,
`TIME_PERIOD`, `OBS_VALUE`, `OBS_FLAG` and `CONF_STATUS`.

### Why SDMX-CSV rather than the statistics endpoint

The `statistics/1.0/data` endpoint used elsewhere in Eurostat answers only
JSON-stat: `format=SDMX-CSV`, `format=SDMX_CSV`, `format=csvdata` and
`format=TSV` all return `400 Invalid value for 'wsOutputFormat' parameter`.
JSON-stat is a dimensional cube, not rows, so archiving it would mean this
layer inventing a flattening — a decoding decision it should not be making.
The SDMX 2.1 endpoint answers the same data already shaped as one row per
observation, so the archive keeps what the provider sends.

### The pinned key

The dimension order is the provider's own, read from the dataflow's JSON-stat
`id` list: `freq`, `citizen`, `agedef`, `age`, `unit`, `sex`, `geo`, `time`.
The key pins `A.TOTAL.COMPLET.TOTAL.NR.T.` so that the response cannot widen
into other citizenships, age definitions, ages, units or sexes without an
assertion noticing. The trailing `geo` position is deliberately open: which
reporting countries exist is a question about Eurostat's own membership and
reporting obligations, answered by whichever package declares them, not by
this acquisition. Observed, 36 reporting areas are returned, including the
`EU27_2020` aggregate the provider computes.

`citizen=TOTAL` is what makes this series the total flow rather than a
citizenship-specific one. It is also what makes this measure differenceable
against the immigration series: both count every mover regardless of
citizenship, so neither is restricted to foreign nationals.

## Licence and attribution evidence

Eurostat's reuse policy, unchanged at
`https://ec.europa.eu/eurostat/about-us/policies/copyright`, checked 16
September 2026, applies Commission Decision 2011/833/EU: reuse is authorised
for commercial and non-commercial purposes provided the source is
acknowledged. The declared attribution names the dataset by its provider code,
`migr_emi1ctz`.

## Publication cadence and window

`https://ec.europa.eu/eurostat/cache/metadata/en/migr_immi_esms.htm`, checked
16 September 2026. Eurostat documents immigration and emigration in one ESMS
file; `migr_emi_esms.htm` does not exist and answers 404.

Legal basis: Regulation (EC) No 862/2007 on Community statistics on migration
and international protection, Article 3.

Reference period, quoted:

> Migration data refer to the amount of immigration and emigration that
> occurred during the reference period of one calendar year T-1 from 1 January
> until 31 December of year T-1.

Collection, quoted:

> Migration data are collected by Eurostat annually by 31 December of year T.

Release calendar, quoted:

> March T+1: Migration flows by age, sex and citizenship/country of
> birth/country of previous/next residence for reference year T-1.

Revision policy, quoted:

> Migration statistics are continuously revised according to the most recent
> data released and sent to Eurostat by the national statistical institutes.

Coverage note, quoted:

> Statistics from the UK are available only until the withdrawal of the UK
> from the EU.

## Provider timezone

`Europe/Luxembourg`, where Eurostat publishes. The `LAST UPDATE` column the
provider stamps on each row reads as a local timestamp — observed
`29/05/26 23:00:00` — which is consistent with a nightly dissemination build
rather than an announced hour.

## Declared expected deadline

Substituting the reference year `R` for `T-1`: a reference year is collected
by 31 December of year `R+1` and released in March of year `R+2`. The lag from
the end of the reference year to the release is therefore 31 December `R` to
31 March `R+2`, which is **455 days**.

`expected_within_days: 455` records that lag directly. The observed data
agrees: reference year 2024 is present with a `LAST UPDATE` of 29 May 2026,
and as of 16 September 2026 reference year 2025 is not yet published, which is
what a March 2027 release implies.

`455` exceeds the ceiling of 365 that `validate_publication_schedule`
previously enforced. The ceiling was raised to 550 in
`runtime/pulse/contracts/status.py` and `site/data/status-client.js`: its
purpose is to catch a typo, and a documented lag longer than the period itself
is not one. The existing test that pinned the old boundary now pins the new
one.

## Grace decision and evidence

`grace_days: 30`. The release is stated as a month rather than a day, so the
expected window already lands on 31 March; grace covers the rest of April,
which is the smallest tolerance that does not call a release late while the
provider is still inside a normal publishing month. This is a deliberate
tolerance, not a fitted constant: the provider publishes no punctuality series
against which slippage could be measured, and its metadata records punctuality
as not applicable.

## UTC workflow cron

`0 7 8 4,5,6 *` — 07:00 UTC on the eighth of April, May and June.

Derivation: the release window closes at the end of March in Luxembourg, which
is UTC+02:00 under summer time at that date, so 31 March 23:59 local is 31
March 21:59 UTC. A run on 8 April is a week clear of that. The May and June
runs exist for the continuous revision the provider documents above: a national
statistical institute restating a year after the March release is normal here,
and two further passes catch a restatement within the season without polling a
small annual dataset all year. The two Eurostat migration series are released
together and share one repository writer, so their runs sit two hours apart
rather than at the same minute.
