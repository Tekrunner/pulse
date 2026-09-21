# World demography projection scenarios dataset contract

`dataset-contract.yaml` is authoritative. This file records what a consumer has
to know that a schema cannot say.

## What this table is

One row per location, projected year and published scenario, 2024 to 2100, for
the world total and all 237 countries and areas. Every row is a projection.
There is no estimated period here at all: the estimates live in the sibling
`world-demography-indicators`, and this table begins the year after they end.

`dbt/models/world_demography_scenarios.sql` is the analytical boundary, reading
the `un-wpp-projection-scenarios` snapshot with every field declared as text and
cast explicitly.

## Eighteen scenarios, two kinds, and why the kind is a column

The provider publishes eighteen values of `Variant` in one file, and they are
not eighteen alternatives of the same sort. `scenario_kind` separates them:

**Deterministic** (12) — `High`, `Low`, `Constant fertility`, `Constant
mortality`, `Instant replacement`, `Instant replacement zero migration`, `Zero
migration`, `No change`, `Momentum`, `No fertility below age 18`, `Accelerated
ABR decline`, `Accelerated ABR decline with rec`. Each fixes an assumption and
runs it forward. Several are deliberately implausible: `Constant fertility`
holds today's fertility to 2100 and reaches 18.2 billion, `No change` holds both
fertility and mortality. They are bounds for reasoning, not forecasts.

**Probabilistic** (6) — `Median PI`, `Lower 80 PI`, `Upper 80 PI`, `Lower 95
PI`, `Upper 95 PI`, `Mean`. These summarize the provider's probabilistic
projection and are the only scenarios here carrying a stated likelihood.

The distinction is a column rather than a note because a consumer that drew all
eighteen as one fan would be telling a reader that a deliberately implausible
bound and the edge of a 95% interval are the same kind of statement.

`Median PI` for the world matches the medium path in the sibling indicator table
exactly: both read 10,180,160.751 thousand at 2100.

## Scenarios do not all publish the same measures

`Mean` publishes **only** `total_fertility_rate`. It carries no population, no
growth rate, no life expectancy, no median age, and no world row — it is
published for countries and areas alone, 18,249 rows against the 18,326 of every
other scenario.

Rather than dropping it, which would hide a scenario, or writing zero, which
would invent a population, its other measures are null.
`a_scenario_publishes_a_measure_throughout_or_not_at_all` asserts that this is
the only meaning a null can have here: where a scenario publishes a measure it
publishes it for every row it covers, so a null never marks a gap inside a
series a consumer is drawing.

## The probabilistic tails are not populations

At the far end of the projection the provider's lower bounds behave as the edge
of a distribution rather than as a country:

- `Lower 95 PI` and `Lower 80 PI` round a small country's population to exactly
  `0.000` — Andorra from 2085, Hong Kong at 2100.
- Where they do, `median_age_years` reads above 100, as high as 180.896.
- On four rows a median age of exactly `0.0000` sits beside an entirely ordinary
  population: Hong Kong 2085, Kuwait 2073, Qatar 2090 and 2100. That is a
  placeholder, not an age.

These values are carried as published. `measures_lie_in_their_published_ranges`
asserts physical bounds only of the deterministic scenarios and holds the
probabilistic ones to non-negativity, because asserting that a distribution's
edge is a possible population would be asserting something about the wrong
object. A consumer reading a median age from a probabilistic bound must treat
zero and values above 100 as no value.

## Why the scenarios are a separate table from the estimates

One dataset reads one snapshot, and the provider ships the estimates and the
alternative scenarios as two files. That constraint happens to match the
semantics: the estimate table has one row per location-year, this one has one
per location-year-scenario, and a single table would either duplicate every
estimate eighteen times or carry a null scenario on most of its rows.

A consumer joining them holds the join's invariants itself. The two tables agree
on `location_id` and on the boundary year: the last estimate is 2023 and the
first projected year here is 2024, asserted by `every_year_is_projected`.

## Refresh behaviour

As for the sibling indicator table: a revision supersedes the previous one
whole, at a different URL, and reaches this table only after a human updates the
source declaration. The scenario vocabulary itself is declared in the source
package, so a scenario the provider withdraws fails an assertion rather than
disappearing quietly.
