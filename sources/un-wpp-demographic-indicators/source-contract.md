# Source acquisition evidence

## Provider access and native scope

`https://population.un.org/wpp/downloads?folder=Standard%20Projections&group=CSV%20format`,
checked 16 September 2026. The page lists the standard-projection CSV downloads
and links this file as *Demographic Indicators — 1950-2100, medium (gz)* at
`https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz`.
An anonymous HTTPS `GET` returns `200` with `Content-Length: 16557272` and
`Last-Modified: Fri, 13 Dec 2024 19:11:17 GMT`. No registration, token or
referer is required.

The page documents the columns every standard CSV carries (`SortOrder`,
`LocID`, `Notes`, `ISO3_code`, `ISO2_code`, `SDMX_code`, `LocTypeID`,
`LocTypeName`, `ParentID`, `Location`, `VarID`, `Variant`, `Time`,
`MidPeriod`) and lists the 54 demographic indicator columns of this file. The
declaration names the subset the acquisition requires; `compatible_additions`
is irrelevant here because the archive keeps the file's bytes rather than
decoded rows, so an added column is preserved whether or not it was declared.

The same page's own note explains the encoding and compression: *"These CSV
files are encoded in UTF-8"* and *"most files are compressed using the gzip
compression algorithm"*. The adapter therefore decompresses transiently as
gzip UTF-8 and archives the compressed bytes unchanged.

### The revision year is part of the URL

The file name embeds `WPP2024`. A new revision is published at a **different**
URL rather than as new content at this one, so a scheduled run can only
confirm that this revision has not been rebuilt in place. Moving to the next
revision is a human edit of `source.yaml`. In-place rebuilds are not
hypothetical: this revision was released on 11 July 2024 but its CSV files
carry a `Last-Modified` of 13 December 2024, five months later.

### Why the estimate boundary is declared rather than derived

Every row of this file reads `Variant` = `Medium` and `VarID` = `2`, for
`Time` from 1950 to 2101; the file carries no flag separating estimated years
from projected ones. The provider states the boundary in prose on
`https://population.un.org/wpp/`, checked 16 September 2026: the 2024 revision
*"presents population estimates from 1950 to the present for 237 countries or
areas"* and *"considers the results of 1,910 national population censuses
conducted between 1950 and 2023"*; the companion other-scenarios file is
published for *"2024-2100"*, so 2023 is the last estimated year and 2024 the
first projected one. `estimates_through_year: 2023` records that, and the
adapter asserts the file publishes the year and that the world total carries
every declared measure at it.

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
Nations endorsement. The declared `attribution` reproduces the provider's own
suggested citation and names the licence.

## Publication cadence and window

World Population Prospects is released on World Population Day, 11 July, of
even-numbered years:

- the 2022 revision was released on 11 July 2022, with estimates through 2021;
- the 2024 revision was released on 11 July 2024, with estimates through 2023,
  and `https://population.un.org/wpp/` describes it as *"the twenty-eighth
  edition of official United Nations population estimates and projections"*.

Checked 16 September 2026: the provider's site still presents the 2024
revision as current, and the CSV file names still read `WPP2024`.

No date is published in advance for the next revision. The cadence is therefore
established by two consecutive observed releases rather than by a provider
commitment.

## Provider timezone

The Population Division publishes from the United Nations Secretariat in New
York, `America/New_York`. Release day is stated as a calendar date rather than
as a time of day, so the conversion below treats the whole release day as the
earliest availability and adds margin rather than assuming an hour.

## Declared expected deadline

The represented period ends on 31 December of the last estimated year. The
observed lag from that period end to release is:

| Revision | Estimates through | Released | Lag |
| --- | --- | --- | --- |
| WPP 2022 | 2021-12-31 | 2022-07-11 | 192 days |
| WPP 2024 | 2023-12-31 | 2024-07-11 | 193 days |

`expected_within_days: 210` covers both observed lags with roughly two and a
half weeks of margin. `period: biennial` is the provider's own cycle: a yearly
period would mark this source overdue for the whole of every odd year, when
nothing is late and nothing is due.

`biennial` did not exist in the status contract before this source. It was
added to `SCHEDULE_PERIOD_MONTHS` in `runtime/pulse/contracts/status.py` and
`site/data/status-client.js`, both of which already documented adding a period
as the whole cost of supporting one.

## Grace decision and evidence

`grace_days: 60`. Both observed releases landed on the same calendar day, so
there is no observed slippage to measure and grace is a deliberate tolerance
rather than a fitted constant: a provider that publishes no advance date and
releases once every two years is given two months before a missing revision is
called late. Together with the expected window this places the next deadline
at 2026-12-31 + 210 + 60 days, so a 2026 revision released on its usual day
would arrive with more than four months to spare.

## UTC workflow cron

`0 4 15 1,4,7,10 *` — 04:00 UTC on the fifteenth of January, April, July and
October.

Derivation: the release day is 11 July local time in New York, which is at
worst 11 July 04:00 UTC through 12 July 04:00 UTC. A run on 15 July is four
days clear of that window in UTC without needing an assumed release hour. The
other three runs exist for the in-place rebuild evidenced above rather than for
a release: quarterly is frequent enough to notice a revision being rebuilt
under the same URL within a quarter, and infrequent enough that confirming an
unchanged 16.5 MB file is not a monthly cost. A more frequent poll would buy
nothing, because a genuinely new revision appears at a URL this workflow does
not fetch.
