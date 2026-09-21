# Claude Design production brief: World demography

This is a design and authoring session against real report-facing data, before
production implementation. Produce the complete report surface and its
purpose-built visuals for human review. Do not write a coding-agent brief or
defer content and visual decisions to implementation.

Report ID: `world-demography`. Route: `reports/world-demography`. Visibility:
public.

## Read these inputs in full

- Work record, carrying the standing questions, the evaluated sources and the
  reasoning behind each selection:
  `_bmad-output/report-workflows/world-demography.json`
  (SHA-256 `40acc713aa410496927da4a24a3d28b0b83d300d6ef7af50042b3ac793d6231c`)
- Representative and boundary rows read from the published Parquet:
  `_bmad-output/world-demography-real-data.json`
  (SHA-256 `db2c2184d36a9b5855547400999e2dc2088f63df1486a8e3ee47138cfc942cdf`)
- Neutral renderer boundary: `docs/visual-contract-v1.md`
- Semantic tokens: `site/design/tokens.css`
- Visual language: `site/design/visual-language.md`
- Shared report client, including the click-to-select seam and `placeChips`:
  `site/visuals/report-shared.js`
- The one existing report that already wires both standard controls, as
  vocabulary to match rather than reinvent: `site/reports/french-consumer-prices/report.js`

### Dataset contracts and their published Parquet

| Dataset | Contract | SHA-256 | Parquet | SHA-256 | Rows |
| --- | --- | --- | --- | --- | --- |
| `world-demography-indicators` | `datasets/world-demography-indicators/dataset-contract.yaml` | `1841f56ce0c12f0f1e58a7b85401aedb17bb779b4ff5162e6fbc0c629c4739d0` | `publish/public/data/world-demography-indicators/dataset.parquet` | `693ffa19954bec3a2f666185f9a7032df91e5e54388ded48527c266ddc722571` | 35,938 |
| `world-demography-scenarios` | `datasets/world-demography-scenarios/dataset-contract.yaml` | `add4b5c93fcd0787cd44c194249d1ee23d41893e55c187042fe57daa8a56deb1` | `publish/public/data/world-demography-scenarios/dataset.parquet` | `67fa04d8877019fe3e882429ffab1078dcf808c8aae7bca4d3041997fe7465f3` | 333,817 |
| `world-demography-age-structure` | `datasets/world-demography-age-structure/dataset-contract.yaml` | `d2dc0ee7714be3ab27efa945d5594f1517486b6a5b1983dd24a02bc817fb42b0` | `publish/public/data/world-demography-age-structure/dataset.parquet` | `60bea39c5c1cfb9f3ae285d6039f247e4bf1d3b27b2e62a60e2d13607d174872` | 862,512 |
| `european-immigration-flows` | `datasets/european-immigration-flows/dataset-contract.yaml` | `d1079bba771f06d4aa0b02e61971b35552796b1bda81e5fcd466630ddc670fa9` | `publish/public/data/european-immigration-flows/dataset.parquet` | `fee1f61e4f3557430d2aa8f15a8ebe0f33af75d5baa553676f6a712db4414138` | 853 |
| `european-emigration-flows` | `datasets/european-emigration-flows/dataset-contract.yaml` | `a74fe85206d2944f681921712fb442d6f033189cd06f7a66433b6d5f7f1bc1ea` | `publish/public/data/european-emigration-flows/dataset.parquet` | `06d751d1923a8bc454bfaa958e57094c2c6ac2e2b0c03d692fb5e9896f798a20` | 855 |
| `healthy-life-expectancy` | `datasets/healthy-life-expectancy/dataset-contract.yaml` | `86e1ed7e0e605cb14f18ad456b26512e2820709684d6cd44a3f498c6f972a999` | `publish/public/data/healthy-life-expectancy/dataset.parquet` | `251c3fe5cbd6ee2a7c91dee70e56e61a7b174024735763e5da161886b4f6cfa8` | 12,936 |

Inspect the Parquet directly. Use its actual schema, periods, values, negative
values, null behavior, and precision. Do not invent fields or base design
decisions on representative arrays when report-facing rows exist.

## Who reads this, and how

The reader is an economist with a doctorate in the subject, reading standing
questions repeatedly rather than arriving once. They open the report at the
latest estimate, read the world first, then compare a small set of countries
side by side, then pick a single year and read every country figure at that
year. They change the country selection often and the year selection often, and
they expect a figure to answer at the selected year without their having to
leave the mark to find the number.

They do not need method explained to them. They do need to be told what *this
data* does: where a series stops, which provider a panel comes from, and which
of two similarly named quantities a column actually is.

## The standing questions

These are the report's subject. Every section answers one of them.

| ID | Question |
| --- | --- |
| `world-population-path` | How large is the world's population each year, how fast is it changing, and where do the published projection scenarios take it? |
| `country-population-path` | How large is each selected country's population each year, how fast is it changing, and where does the published projection take it? |
| `population-change-composition` | For each selected country, how much of a year's population change is natural change and how much is net migration, both as people and relative to the population? |
| `gross-migration-flows` | Where a provider publishes them, how large are the gross immigration and emigration counts behind a country's net migration? |
| `fertility-and-longevity` | For each selected country, what is the total fertility rate, life expectancy at birth, and healthy life expectancy at birth? |
| `age-structure` | For each selected country at a selected year, what is the population by five-year age group and sex, and what share of the population is young, working age, or old? |

The world is read before any country. Beyond that, group the questions however
the design reads best; they are listed here in the order the reader described
them, not in a prescribed layout.

## What this report is, and how it differs from the others in this repository

Every existing Pulse report is about one country. This one is about all of
them: the reader selects which countries to compare, and the selection changes
often. Design the country selection as a first-class report control, not as a
legend.

## Decide and produce

Decide the narrative sequence, indicator definitions, units, precision,
represented periods, layout, and interaction model. Design purpose-built
visuals that answer the questions above rather than selecting a generic
dashboard or inherited chart vocabulary. Define parameterized query needs and
report-owned controls and state. Specify provenance and a complete accessible
data equivalent for every visual.

For every visual, return a Visual Contract v1 declaration with a stable
lowercase kebab-case ID, consumer schema, display schema, inputs (`rows`,
`display`, `provenance`), fixture rows selected from the supplied real Parquet,
validation behavior, and focused cleanup ownership. Keep calculations and
non-additive relationships explicit.

Return a self-contained HTML/SVG/CSS/JS prototype, the design decisions and
rationale, all contracts and fixtures, and every local asset. Include ready,
loading, empty, suspect, stale, query-error, schema-incompatibility,
render-error, and shared-engine-failure treatments. Show slot-local failure
isolation. Include desktop, narrow smartphone landscape, and 400% zoom/reflow
behavior.

## Report controls this report needs

### The two standard ones

- **Represented period.** A `fieldset` offering preset windows *and* an explicit
  custom range: a start and an end the reader sets independently, where changing
  either moves the selection to "custom". Presets alone are not enough. The
  window here spans 1950 to 2100 and crosses the estimate/projection boundary,
  so at least one preset should sit wholly inside the observed period and at
  least one should reach the projection horizon.
- **Observation year, shared across the report.** The reader picks one year, and
  *every* figure at year grain shows its values for that same year. Selection is
  made two ways, both required: a control in the report's control row, and
  clicking any point on any figure. The label says so: "Observation year — or
  click any point on a figure". This is the year selector the reader asked for,
  and it is the same mechanism as the observation month in the French
  consumer-prices report.

Selection is report-owned state. A visual receives the selected index as a
display input, draws its own marker, and emits a selection event when a reader
clicks it; it never holds the selection and never reaches for another visual.

The selected values are drawn beside the selected point, inside the plot, using
`placeChips` — not in a readout under the figure. Give a value the unit a
reader would say out loud: this data is published in thousands of people, and
"8.09bn" or "66.4M" is what a reader says, never "8,091,735 thousand". Scale
the axis with it.

### The two this report adds

- **Country selection.** Multi-select over the country universe below, default
  **France, Germany and the United Kingdom**. Every country figure answers for
  the current selection. Decide how many countries the design supports at once
  and say so; the reader compares "a small set" side by side. Design the empty
  selection as a first-class state, not an error.
- **Projection scenario selection.** The provider publishes eighteen scenarios
  of two different kinds (see below). Decide which are shown by default and how
  a reader reaches the rest. Do not put all eighteen on a plot at once by
  default.

Record any departure from any of these four as a design decision with its
reason.

## The country universe, and the one selection rule the report owns

The datasets publish **all 237 countries and areas** the provider covers, plus
its world aggregate. That is deliberate: which countries exist is a fact about
the provider, and narrowing it is a reader's preference, so the narrowing
belongs here rather than in the data.

The reader asked not to have "every micro-state" in the list. The rule this
report applies is: **offer the countries whose population reached at least
300,000 in the latest estimate year, which is 184 of the 237.** That keeps
Iceland, Malta, Luxembourg and the French overseas departments, and drops
Andorra, San Marino, Tuvalu, Nauru and the like. Apply it in the report's own
query. Design the control to make the rule legible if a reader wonders why a
country is missing.

## What the data actually says — read these before designing

These are facts about the published rows, not suggestions about what to draw.

### The estimate/projection boundary is 2023/2024

`world-demography-indicators` carries `series_kind` on every row: `estimate`
through 2023, `projection` from 2024 to 2100. They are on one time axis and are
not the same kind of thing. A reader must be able to see, without interaction,
where measurement stops and model begins.

### Publication edges differ by family, and the header must say so

| Family | Provider | Latest published | Note |
| --- | --- | --- | --- |
| Population, change, fertility, longevity | UN WPP 2024 | estimates to **2023**, projection to 2100 | revised about every two years |
| Projection scenarios | UN WPP 2024 | 2024 to 2100 | same revision |
| Age structure | UN WPP 2024 | estimates to **2023**, projection to 2100 | same revision |
| Gross migration flows | Eurostat | **2024** | annual; published in March of the year after next |
| Healthy life expectancy | WHO | **2021** | irregular; the series has not moved since August 2024 |

Bind each family's query to its own published end while the window is open to
the latest, and pull them together only when the reader sets an explicit end.
The header states each family's own edge so the difference is legible without
interaction.

### Eighteen scenarios, of two kinds that must not be read as one set

`world-demography-scenarios` carries `scenario_kind`:

- **deterministic** (12): `High`, `Low`, `Constant fertility`, `Constant
  mortality`, `Instant replacement`, `Instant replacement zero migration`,
  `Zero migration`, `No change`, `Momentum`, `No fertility below age 18`,
  `Accelerated ABR decline`, `Accelerated ABR decline with rec`. Each fixes an
  assumption and runs it forward. `No change` and `Constant fertility` are
  deliberately implausible bounds, not forecasts.
- **probabilistic** (6): `Median PI`, `Lower 80 PI`, `Upper 80 PI`,
  `Lower 95 PI`, `Upper 95 PI`, `Mean`. These summarize the provider's
  probabilistic projection and are the only ones that carry a stated likelihood.

At 2100 the world spans **6.99bn** (`Low`) to **18.19bn** (`Constant
fertility`) across the deterministic scenarios, and **9.05bn** to **11.44bn**
across the 95% prediction interval. The medium path the indicator table carries
matches `Median PI` exactly at 10.18bn. Drawing all eighteen as one fan would
tell the reader that a deliberately implausible bound and a 95% interval edge
are the same kind of statement. They are not.

Two provider facts the design has to survive:

- `Mean` publishes **only the total fertility rate** — no population at all, and
  no world row. Every other measure is null on those rows.
- The probabilistic lower bounds round a small country's population to **exactly
  zero** at the far end of the projection, and publish a median age above 100 or
  of exactly 0 where they do. That is the tail of a distribution, not an age.

### The world total has no ISO3 code and no net migration

`iso3_code` is null on the world rows, by construction: the provider publishes
none. `net_migration_thousands` is `0.0` for the world in every year, also by
construction — migration nets to zero globally. A world panel that showed a
migration component would show a flat zero.

### The medium projection peaks in 2084

World population reaches **10,289,315 thousand in 2084** and declines after. The
growth rate crosses zero there. This is a fact the figure should be able to
show; it is not a sentence to write, because the next revision moves it.

### Germany's population grows while its natural change is deeply negative

2023, the latest estimate year:

| | France | Germany | United Kingdom |
| --- | --- | --- | --- |
| Population (thousands) | 66,438.822 | 84,548.231 | 68,682.962 |
| Growth rate (% / yr) | 0.173 | 0.349 | 0.699 |
| Population change (thousands) | 114.674 | 294.664 | 480.161 |
| Natural change (thousands) | 22.796 | **−314.891** | 34.641 |
| Natural change (per 1,000) | 0.343 | **−3.724** | 0.505 |
| Net migration (thousands) | 91.862 | 609.553 | 445.523 |
| Net migration (per 1,000) | 1.383 | 7.210 | 6.487 |
| Total fertility rate | 1.6389 | 1.4414 | 1.5600 |
| Life expectancy (years) | 83.3253 | 81.3777 | 81.3015 |
| Median age (years) | 41.8171 | 45.1468 | 39.7818 |

This is the composition question in one table: a country can grow while losing
people naturally. The composition figure has to make a negative component
legible beside a positive one.

### Population change is *not* exactly the sum of its two components

The provider's `population_change_thousands` is accounted for by natural change
and net migration but does **not** equal their sum: the residual reaches about
4,900 people for a country and 7,300 for the world aggregate. A stacked
decomposition drawn as if it closed would be wrong. Design for "these two
account for the change", not "these two add up to the change".

### Rates are published per 1,000, not as percentages

The reader asked for the migration and natural-change components "both as raw
numbers and as a % of its population". The provider publishes them as rates
**per 1,000 population**, which is the conventional demographic unit and what
this dataset carries: `natural_change_rate_per_1000`, `net_migration_rate_per_1000`.
No percentage column was derived, because it would be the same quantity divided
by ten under a second name. Use the per-1,000 unit and label it plainly. If the
design concludes a percentage reads better for this reader, say so as a design
decision and it will be added to the dataset rather than computed in a visual.

### Gross migration flows exist for Europe only, and the United Kingdom stops in 2019

`european-immigration-flows` and `european-emigration-flows` cover 36 reporting
areas. For the three default countries:

| Area | First year | Last year | Years published |
| --- | --- | --- | --- |
| Germany (`DE` / `DEU`) | 1998 | 2024 | 27 |
| France (`FR` / `FRA`) | 2006 | 2024 | 19 |
| United Kingdom (`UK` / `GBR`) | 1998 | **2019** | 21 |
| EU aggregate (`EU27_2020`) | 2013 | 2024 | 12 — no ISO3 code |

A reader selecting a non-European country gets nothing from this pair. A reader
at a year after 2019 gets nothing for the United Kingdom. Both are provider
facts and need a not-published treatment on the mark, not a gap and not a zero.
Say where a series stops on the mark itself: "United Kingdom — to 2019".

These two flows are differenceable against each other because both count every
mover regardless of citizenship. They are **not** reconcilable with the UN's
`net_migration_thousands`, which comes from a different provider on a different
basis. If the design places them together, that is the one fact about them that
prose has to carry, because no mark can.

### Healthy life expectancy is a modelled quantity over a short window

`healthy-life-expectancy` covers 2000–2021 only, for 183 countries plus the
provider's own regional, income-group and world aggregates, by sex. Life
expectancy beside it runs 1950–2100. A panel holding both will have one series
stopping decades short of the other, twice over — once at 2021 and once at the
estimate boundary. The measure is derived from modelled disability weights, so
it is not the same kind of number as a life table's life expectancy.

Its licence is also unlike every other source here: WHO grants use for public
health purposes only, bars commercial use, and requires prior written
authorization for modification. The provenance line for this panel must name
WHO and its licence explicitly rather than folding it into a shared credit.

### The age structure carries two groupings of the same people

`world-demography-age-structure` has `age_grouping` of `five-year` (21 bands,
`0-4` … `100+`) and `broad` (3 bands, `0-14`, `15-64`, `65+`). They describe the
same population; adding a row from one to a row from the other counts people
twice. Within a grouping, bands are exhaustive and non-overlapping and
`share_of_population_pct` sums to 100. `age_end` is null on the open-ended band.

The reader asked for a young/middle/old split "below 18 / 18-65 / 65+, or
whichever split is available". Five-year bands make the available split
**0-14 / 15-64 / 65+**, which is what the broad grouping carries.

World shares in 2023: 0-14 = 25.0204%, 15-64 = 64.9828%, 65+ = 9.9968%.

France's 2023 pyramid, 21 bands by sex, is in the real-data file under
`france_age_pyramid_2023`.

## Copy states meaning, never measurements

A built Pulse report has no intelligence at run time. It renders rows from
published datasets and does nothing else: no text is regenerated, recomputed or
reviewed when the data refreshes. Every sentence written here is therefore
either durable or wrong at the next release.

- **Durable copy is definitional.** What a measure counts, what its denominator
  is, what an absence treatment means, where the data comes from, what a control
  does. Write as much of it as the reader needs.
- **A value, a direction, a magnitude, a ranking, a comparison or a period is
  not copy — it is an output.** "10.29bn in 2084", "peaks in the 2080s",
  "Germany's natural change turned negative in 1972": these belong in a figure,
  a tile, a direct label or the accessible table. Written into a sentence they
  become hardcoded assertions that go false at the next revision, and nothing in
  the running report can notice. The next World Population Prospects revision
  will move the peak year and the 2100 range.
- **Do not write a standfirst, section introduction or caption that restates
  what the figures on the same screen already show.**
- **Do not explain method.** No sentence telling this reader not to compare two
  rates with different denominators, or that a projection is not a measurement.
  Put the unit in the label. Warnings about *this data* — the United Kingdom's
  flows ending in 2019, healthy life expectancy stopping at 2021, the world
  having no migration component, the two migration providers not reconciling —
  are the opposite, and belong on the page.
- **If a sentence genuinely must carry a live number, it is a derivation.**
  Declare it in the owning visual's contract with the columns it reads.

## Binding constraints

- Use ordinary DOM and hand-authored SVG through Visual Contract v1; no chart or
  visualization library.
- The report owns data access, parameter-bound SQL, row mapping, state, routing
  and shared resources. Visuals only validate and draw supplied plain rows plus
  display and provenance inputs.
- **A query may select only from its own dataset's table.** Two of the questions
  above want rows from more than one dataset in one figure — the gross flows
  beside net migration, and healthy life expectancy beside life expectancy. Such
  a visual declares its **row spine** on its slot, declares the other queries and
  schemas alongside them even though no slot references them, and is joined in
  the report's own mapping before the visual is called. Choose the spine by
  which dataset decides the rows that must appear: for gross flows that is the
  UN indicator table, because a country with no Eurostat rows must still render
  in the not-published treatment.
- Meet WCAG 2.2 AA: semantic structure, logical keyboard use, visible focus,
  sufficient contrast and targets, non-colour-only cues, reduced motion,
  zoom/reflow, and accessible tables and text equivalents. Country selection and
  year selection must both be fully keyboard-operable.
- Use existing semantic roles. Keep one-off palette, geometry and layout local;
  flag any proposed shared role for separate human approval.
- The prototype runtime is review-only. Clearly identify design-only support
  files, remote assets and representative data so none is ported into
  production.
- Specify exact copy, layout, styling, geometry, behavior, state, responsive and
  accessibility requirements. These become binding after approval.

Package the result using the field structure in
`.claude/skills/pulse-add-visual/assets/handoff-manifest.json`, into
`claude-design-output/world-demography/`. Do not mark it approved; approval is a
separate human action.
