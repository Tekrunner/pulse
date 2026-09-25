# World Bank WDI GDP snapshot contract

This public acquisition package fetches one credential-free World Bank
Indicators API v2 response (`source=2`, World Development Indicators) for France
carrying six annual indicators, 1960 onward:

- `NY.GDP.MKTP.CD` — GDP (current US$).
- `NY.GDP.MKTP.KD` — GDP (constant 2015 US$).
- `NY.GDP.MKTP.CN` — GDP (current LCU).
- `NY.GDP.MKTP.KN` — GDP (constant LCU).
- `NY.GDP.DEFL.ZS` — GDP deflator (base year varies by country).
- `PA.NUS.FCRF` — Official exchange rate (LCU per US$, period average).

Those indicators are acquisition scope, not a declaration of any Pulse dataset.
Their codes and provider names are retained in `source.yaml` so the adapter
rejects a missing, unexpected or renamed indicator, an answer for another
country, a duplicate indicator-year, and an answer that does not fit on the one
requested page.

The provider answers with a paging header and a list of observations whose
`indicator` and `country` members are nested objects. The adapter flattens them
with the provider's own key names joined by a dot — `indicator.id`,
`indicator.value`, `country.id`, `country.value` — and keeps every other field
unrenamed with its JSON type: `date`, `value`, `unit`, `obs_status`, `decimal`
and `countryiso3code`. `value` is a number or null and is not a required field,
because a required field may not be null. Compatible provider additions are
retained and change the observed-schema hash.

`source_data_date` is the last day of the latest year for which any indicator
publishes a value.

## What the provider does that a consumer must know

- **The local currency changes unit in 1999, but not in every indicator.** The
  GDP series in local currency (`.CN`, `.KN`) are expressed in euros throughout,
  francs having been converted at the fixed rate of 6.55957. The official
  exchange rate is expressed in francs per dollar up to 1998 and in euros per
  dollar from 1999. Dividing current-LCU GDP by the exchange rate therefore
  reproduces current-dollar GDP from 1999 but is off by the conversion factor
  before it (checked for every year 1960–2025 on 2026-09-23).
- **The deflator is the ratio of current to constant local-currency GDP** (times
  100) in every year, to the precision published.
- **Every update can revise history.** Each quarterly WDI update can restate
  earlier years.

## Assertions

- `every_published_value_is_numeric` — every non-null `value` is a JSON number.
- `every_published_value_is_positive` — every published value is strictly
  positive; all six are levels, an index or an exchange rate.
- `every_declared_indicator_reaches_the_latest_year` — the update advanced all
  six indicators together.

## Scheduling evidence

- **Provider access and native scope.** `https://api.worldbank.org/v2/country/FRA/indicator/NY.GDP.MKTP.CD;NY.GDP.MKTP.KD;NY.GDP.MKTP.CN;NY.GDP.MKTP.KN;NY.GDP.DEFL.ZS;PA.NUS.FCRF?format=json&per_page=1000&source=2`,
  checked 2026-09-23: 330 observations, five indicators times 66 years, one
  page, `lastupdated` 2026-07-13. `NY.GDP.MKTP.KD` added 2026-09-25: 66
  observations, 1960–2025, named with its base year, so a rebase renames the
  indicator and the adapter rejects it until the declaration follows.
- **Licence and attribution.** Creative Commons Attribution 4.0 International,
  the licence the World Bank applies to the World Development Indicators in its
  data catalogue (`https://datacatalog.worldbank.org/search/dataset/0037712/world-development-indicators`),
  checked 2026-09-23. It permits redistribution and adaptation with attribution;
  no share-alike obligation.
- **Publication cadence and window.** WDI is updated quarterly. The release note
  for the July 2025 update
  (`https://datatopics.worldbank.org/world-development-indicators/release-note/jul-2025.html`,
  checked 2026-09-23) states that on 1 July 2025 "data for 2024 for national
  accounts and population, including GDP and GNI-related indicators" were
  released. The World Bank's note on the July 2026 update
  (`https://blogs.worldbank.org/en/opendata/what-s-new-in-the-world-development-indicators--july-2026-update`)
  records the refresh of 1 July 2026 with the latest national accounts; the API
  reported `lastupdated` 2026-07-13 for all five indicators, i.e. a follow-up
  refresh within two weeks.
- **Provider timezone.** The release notes give dates without a time; treated as
  a whole day, US Eastern (the World Bank's Washington headquarters).
- **Declared expected deadline.** `expected_within_days: 182`. The previous
  year's national accounts arrive on 1 July, 181 days after 31 December in a
  common year and 182 in a leap year.
- **Grace decision and evidence.** `grace_days: 21`. The 2026 indicators were
  last updated on 13 July, twelve days after the announced refresh; three weeks
  covers such a follow-up without letting a skipped July update pass unnoticed.
- **UTC workflow cron derivation.** `0 6 15 1,4,7,10 *`: 06:00 UTC on the 15th
  of January, April, July and October. The July run falls fourteen days after
  the 1 July update, after the observed follow-up refresh, and inside the grace
  window that expires on 22 July; the other three runs pick up the revisions of
  the remaining quarterly updates, and find unchanged content otherwise.
