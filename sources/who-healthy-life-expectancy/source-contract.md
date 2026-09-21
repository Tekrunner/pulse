# Source acquisition evidence

## Provider access and native scope

WHO Global Health Observatory OData API, checked 16 September 2026:

```
https://ghoapi.azureedge.net/api/WHOSIS_000002
```

Anonymous HTTPS, no registration, token or referer. The response is JSON with
a `value` array of 12,936 flat records, roughly 7.7 MB. The indicator is
identified as `WHOSIS_000002`, *Healthy life expectancy (HALE) at birth
(years)*, confirmed against
`https://ghoapi.azureedge.net/api/Indicator?$filter=contains(IndicatorName,'HALE')`.

Observed scope: reference years 2000 to 2021; `SpatialDimType` values
`COUNTRY` (185 countries), `REGION`, `WORLDBANKINCOMEGROUP` and `GLOBAL`;
`Dim1Type` = `SEX` with `SEX_BTSX`, `SEX_MLE` and `SEX_FMLE`. Every row carries
`Date` = `2024-08-02`, the stamp of the current Global Health Estimates load.

The API has no dimension filter that would narrow the response without also
choosing which locations and sexes exist, and those are questions about the
Global Health Estimates rather than about this acquisition, so the whole
indicator is requested and everything it returns is retained as observed.

Fields the provider publishes as null on some rows — `Low`, `High`,
`ParentLocation`, `ParentLocationCode`, and the unused `Dim2`, `Dim3`,
`DataSourceDim` and `Comments` — are deliberately absent from
`required_fields`, because a required field may not be null. They are still
archived: `compatible_additions: true` keeps every field the provider sends.

## Licence and attribution evidence — and the decision recorded against it

**This is not a Creative Commons licence.** WHO publishes its own terms at
`https://www.who.int/about/policies/publishing/data-policy/terms-and-conditions`,
*Terms and conditions of use for WHO data compilations, aggregations,
evaluations and analyses*, checked 16 September 2026. No Creative Commons
statement appears on the Global Health Observatory pages or in the API
response. The clauses that bear on Pulse, quoted:

> **Licensed Use.** Subject to these Terms and Conditions, WHO grants to you
> the royalty-free, worldwide, non-exclusive right to use, reproduce, extract,
> download, copy, distribute, display or include the Datasets and data
> contained therein in other products for public health purposes.

> **Acknowledgement and Disclaimer.** By using the Datasets, you agree to
> appropriately acknowledge and provide attribution to WHO and the country or
> countries having provided the underlying data (as indicated in the Datasets)
> in the following format: WHO, title of dataset, year, date of access,
> acknowledgement of the country or countries having provided the underlying
> data.

> **Altering or Modifying the Datasets.** As part of the Licensed Use, you may
> minimally alter or adapt figures and tables in the Datasets to match the
> style of your publication. Any other alteration or modification of the
> Datasets (including abbreviations, additions, or deletions) may be made only
> with the prior written authorization of WHO.

> **Prohibited Uses.** You will not sell or otherwise transfer the Datasets
> and/or data contained therein to any third party, except within the Licensed
> Use. [...] Datasets shall not be used for or in conjunction with the
> promotion of a commercial enterprise and/or its product(s) or service(s),
> and/or in any way that suggests that WHO endorses any specific company,
> products or services.

Two clauses reach past acquisition into everything built on this snapshot. A
Pulse dataset restricts rows to a declared country universe (a deletion),
retypes and renames columns, and derives fields — all of which fall under
*Altering or Modifying* rather than under minimal restyling. Publishing the
result on a public site is distribution, which the grant permits only *for
public health purposes*.

**Recorded human decision, 16 September 2026.** The repository owner was shown
these clauses and the four available courses — drop the indicator, substitute
Eurostat healthy life years, accept the terms, or archive and publish an
unmodified passthrough — and chose to accept the terms, on the judgement that
a private, non-commercial demography report falls within the grant. That
decision is recorded here rather than assumed. It is a judgement about
purpose, not a determination that the modification clause has been satisfied;
no prior written authorization has been sought or obtained.

Anything downstream that redistributes this snapshot inherits these terms.
They are unusually restrictive for an open statistical provider: unlike a
Creative Commons licence, they bar commercial use outright and require
authorization to modify, so a consumer cannot assume the permissions it would
get from a CC BY provider.

The declared `attribution` follows the provider's prescribed format, with date
of access pointing at the acquisition timestamp each snapshot manifest already
records, because a static declaration cannot carry a per-snapshot date.

## Publication cadence and window

WHO publishes no release calendar for this indicator. The evidence is what has
been observed:

| Global Health Estimates round | Reference years | Disseminated |
| --- | --- | --- |
| GHE 2000-2016 | to 2016 | 2018 |
| GHE 2000-2019 | to 2019 | December 2020 |
| GHE 2000-2021 | to 2021 | August 2024 |

The current round is confirmed by the API itself: all 12,936 rows carry
`Date` = `2024-08-02`, and the latest `TimeDim` is 2021. The gaps between
rounds are two years and then four; the lag from a reference year's end to its
dissemination is roughly one year for the 2019 round and roughly two years and
seven months for the 2021 round. A revision restates the whole series rather
than appending to it.

## Provider timezone

`Europe/Zurich`, WHO headquarters in Geneva. No release time of day is
published, and the `Date` stamps carry no announced hour, so the cron below
adds margin rather than assuming one.

## Declared expected deadline

`period: biennial`, `expected_within_days: 950`, `grace_days: 60`.

Biennial is the shorter of the two observed gaps between rounds. 950 days is
the most recent observed publication lag: the 2021 reference year ended on
2021-12-31 and was disseminated on 2024-08-02, 945 days later. The earlier
round was far quicker — the 2019 reference year was out in December 2020,
366 days — so the window is set by the slower and more recent of the two
rather than by their midpoint. A provider that has decelerated is better
described by its latest behaviour than by its average.

**An earlier revision of this file declared 550 days.** That figure was not
derived from WHO at all: it was the ceiling `expected_within_days` happened to
carry at the time, having just been raised to 550 for an unrelated source
whose lag is 455 days. Declaring it made this source read `stale` from
2025-09-01, roughly thirteen months before WHO's own record gives any reason
to call a release late, and the public site pipeline inherited that lateness
because its validity window is the earliest deadline in the lineage. The
ceiling is there to reject nonsense, not to supply a value; it was raised to
1000 so that this source's evidence could be declared directly.

**This source will still read `stale`, and that remains intended.** The
represented period ends 2021-12-31; the following biennial period ends
2023-12-31, so with the declared window and grace the deadline falls on
2026-10-06. Past that date WHO will have gone longer without a release than it
ever has, and saying so is the point. What has changed is the timing of the
signal, not its presence. Extending the period vocabulary to four years so the
board reads green was considered and rejected on 16 September 2026, because it
would assert a quadrennial cycle WHO has never committed to; that decision
stands.

## Grace decision and evidence

`grace_days: 60`. There is no announced date against which slippage could be
measured, so grace is a deliberate tolerance rather than a fitted constant: two
months for a provider that publishes on no calendar at all. It is the same
tolerance chosen for the World Population Prospects sources, for the same
reason.

## UTC workflow cron

`0 6 12 1,4,7,10 *` — 06:00 UTC on the twelfth of January, April, July and
October.

Derivation: no release date exists to run after, so the run is a poll rather
than a collection, and its frequency is set by how long a new Global Health
Estimates round could go unnoticed. Quarterly bounds that at roughly three
months, against observed gaps between rounds of two to four years. 06:00 UTC
is 07:00 or 08:00 in Geneva, so a poll lands after a working day would have
begun there rather than in the middle of the preceding night. The response is
a few megabytes, so the cost of the poll is small; the day of month is offset
from the World Population Prospects runs on the fifteenth so that two unrelated
providers are not fetched in the same hour.
