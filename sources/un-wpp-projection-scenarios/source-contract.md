# Source acquisition evidence

## Provider access and native scope

`https://population.un.org/wpp/downloads?folder=Standard%20Projections&group=CSV%20format`,
checked 16 September 2026. The page lists this file under Demographic
Indicators as *2024-2100, other scenarios (gz)* at
`https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_OtherVariants.csv.gz`.
An anonymous HTTPS `GET` returns `200` with `Content-Length: 75342445` and
`Last-Modified: Fri, 13 Dec 2024 19:11:35 GMT`. No registration, token or
referer is required.

It carries the same 67 columns as the medium-scenario indicator file, so the
declared subset is the same measures read under a different scenario. The
page's own note documents the encoding and compression: *"These CSV files are
encoded in UTF-8"* and *"most files are compressed using the gzip compression
algorithm"*.

### What "other scenarios" actually contains

The page's label names a period, not a scenario list. Read, the file publishes
eighteen values of `Variant` for 2024 to 2101:

- eight scenarios that hold one component fixed or replace it — `High`, `Low`,
  `Constant fertility`, `Constant mortality`, `Instant replacement`, `Instant
  replacement zero migration`, `Zero migration`, `No change`;
- `Momentum`, `No fertility below age 18`, `Accelerated ABR decline` and
  `Accelerated ABR decline with rec`;
- six summaries of the provider's probabilistic projection — `Median PI`,
  `Lower 80 PI`, `Upper 80 PI`, `Lower 95 PI`, `Upper 95 PI` and `Mean`.

`Mean` is published for `LocTypeName` = `Country/Area` only; every other
scenario is also aggregated to the world total and to the provider's regional
and grouping locations. `world_total_scenarios` records that exclusion, so the
world-aggregate assertion asks only what the provider actually aggregates.
Both lists are declared rather than inferred, so that a scenario the provider
withdraws fails an assertion instead of disappearing unnoticed.

### The revision year is part of the URL

The file name embeds `WPP2024`. A new revision is published at a **different**
URL rather than as new content at this one, so a scheduled run can only
confirm that this revision has not been rebuilt in place; moving to the next
revision is a human edit of `source.yaml`. In-place rebuilds are not
hypothetical: this revision was released on 11 July 2024 but its CSV files
carry a `Last-Modified` of 13 December 2024.

### The estimate boundary is checked against the data here

Unlike the medium file, this one begins where the estimates end, so the
declared `estimates_through_year` is verifiable from the response: the adapter
asserts that the first published year is exactly one after it. Observed, the
file's minimum `Time` is 2024 against a declared boundary of 2023.

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

No date is published in advance for the next revision, so the cadence rests on
two consecutive observed releases rather than on a provider commitment.

## Provider timezone

`America/New_York`, the United Nations Secretariat in New York. Release day is
stated as a calendar date rather than a time of day.

## Declared expected deadline

The represented period ends on 31 December of the last estimated year on which
the projection is based.

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

`0 6 15 1,4,7,10 *` — 06:00 UTC on the fifteenth of January, April, July and
October.

Derivation: the 11 July release day in New York is at worst 11 July 04:00 UTC
through 12 July 04:00 UTC, so a run on 15 July clears it by four days without
assuming a release hour. The other three runs exist for the in-place rebuild
evidenced above. The three World Population Prospects sources share a release
day and one repository writer, so their runs sit two hours apart rather than at
the same minute; this is the largest file of the three at 75 MB, which is a
further reason not to poll it more often than the evidence justifies.
