# Source acquisition evidence

## Provider access and native scope

`https://population.un.org/wpp/downloads?folder=Standard%20Projections&group=CSV%20format`,
checked 16 September 2026. The page lists this file under Population, as
*Population on 01 July, by 5-year age groups — 1950-2100, medium (gz)*, at
`https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_PopulationByAge5GroupSex_Medium.csv.gz`.
An anonymous HTTPS `GET` returns `200` with `Content-Length: 29948947` and
`Last-Modified: Fri, 13 Dec 2024 19:11:50 GMT`. No registration, token or
referer is required.

The page documents the columns added to age-disaggregated files: *"AgeGrp
(string): label identifying the single age (e.g. 15) or age group (e.g.
15-19)"*, *"AgeGrpStart (numeric): initial age of the age group"* and
*"AgeGrpSpan (numeric): length of the age group, in years"*. Read, the file
publishes twenty-one groups per location and year, `0-4` through `95-99` and
an open-ended `100+`, with `PopMale`, `PopFemale` and `PopTotal` in thousands.
The declared `age_groups` list records that vocabulary so that a group the
provider stops publishing fails an assertion rather than disappearing quietly.

The page's own note documents the encoding and compression: *"These CSV files
are encoded in UTF-8"* and *"most files are compressed using the gzip
compression algorithm"*.

### The revision year is part of the URL

The file name embeds `WPP2024`. A new revision is published at a **different**
URL rather than as new content at this one, so a scheduled run can only
confirm that this revision has not been rebuilt in place; moving to the next
revision is a human edit of `source.yaml`. In-place rebuilds are not
hypothetical: this revision was released on 11 July 2024 but its CSV files
carry a `Last-Modified` of 13 December 2024.

### Why the estimate boundary is declared rather than derived

As in the medium indicator file, every row reads `Variant` = `Medium` for
`Time` from 1950 to 2100 and the file carries no flag separating estimated
years from projected ones. The provider states the boundary in prose on
`https://population.un.org/wpp/`, checked 16 September 2026: the 2024 revision
*"presents population estimates from 1950 to the present"* and *"considers the
results of 1,910 national population censuses conducted between 1950 and
2023"*. `estimates_through_year: 2023` records that, and the adapter asserts
the file publishes the year, publishes every declared age group for the world
total at it, and that the two sexes sum to the published total there.

## Licence and attribution evidence

The downloads page states, checked 16 September 2026:

> Copyright © 2024 by United Nations, made available under a Creative Commons
> license CC BY 3.0 IGO: http://creativecommons.org/licenses/by/3.0/igo/
>
> Suggested citation: United Nations, Department of Economic and Social
> Affairs, Population Division (2024). World Population Prospects 2024, Online
> Edition.

CC BY 3.0 IGO permits redistribution and adaptation with attribution and an
indication of changes, and requires that an adaptation not imply United
Nations endorsement.

## Publication cadence and window

World Population Prospects is released on World Population Day, 11 July, of
even-numbered years: the 2022 revision on 11 July 2022 with estimates through
2021, and the 2024 revision on 11 July 2024 with estimates through 2023.
`https://population.un.org/wpp/` describes the 2024 revision as *"the
twenty-eighth edition of official United Nations population estimates and
projections"* and, checked 16 September 2026, still presents it as current.

The same page records a grain change across revisions — *"Since the 2022
revision, the estimates and projections are presented in one-year intervals of
age and time instead of the five-year intervals used previously"* — which is
why the five-year groups this file publishes are the provider's own
aggregation of its single-year work rather than its native grain.

No date is published in advance for the next revision, so the cadence rests on
two consecutive observed releases rather than on a provider commitment.

## Provider timezone

`America/New_York`, the United Nations Secretariat in New York. Release day is
stated as a calendar date rather than a time of day.

## Declared expected deadline

The represented period ends on 31 December of the last estimated year.

| Revision | Estimates through | Released | Lag |
| --- | --- | --- | --- |
| WPP 2022 | 2021-12-31 | 2022-07-11 | 192 days |
| WPP 2024 | 2023-12-31 | 2024-07-11 | 193 days |

`expected_within_days: 210` covers both observed lags with margin.
`period: biennial` is the provider's own cycle; an annual period would mark
this source overdue for the whole of every odd year, when nothing is due.
`biennial` was added to `SCHEDULE_PERIOD_MONTHS` in
`runtime/pulse/contracts/status.py` and `site/data/status-client.js` for this
family of sources.

## Grace decision and evidence

`grace_days: 60`. Both observed releases landed on the same calendar day, so
there is no observed slippage to fit; grace is a deliberate tolerance giving a
provider that publishes no advance date and releases once every two years two
months before a missing revision is called late.

## UTC workflow cron

`0 8 15 1,4,7,10 *` — 08:00 UTC on the fifteenth of January, April, July and
October.

Derivation: the 11 July release day in New York is at worst 11 July 04:00 UTC
through 12 July 04:00 UTC, so a run on 15 July clears it by four days without
assuming a release hour. The other three runs exist for the in-place rebuild
evidenced above. The three World Population Prospects sources share a release
day and one repository writer, so their runs sit two hours apart rather than at
the same minute.
