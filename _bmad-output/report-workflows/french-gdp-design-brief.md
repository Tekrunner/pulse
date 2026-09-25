# Claude Design production brief: French GDP

This is a design and authoring session against real report-facing data, before
production implementation. Produce the complete report surface and every
purpose-built visual in it, for human review, as a **clickable prototype with
working controls**: the reviewer judges interactions by using them, not from
static frames. Do not write a coding-agent brief and do not defer content or
visual decisions to implementation.

One report, one handoff. Every section below is part of the same reading
experience and must be composed together, not designed as independent widgets.

---

## Read these inputs in full

| Input | Path | SHA-256 |
| --- | --- | --- |
| Report work record (questions, source decisions) | `_bmad-output/report-workflows/french-gdp.json` | recorded in the handoff manifest |
| Real-data evidence (representative rows, boundary cases, cross-dataset facts) | `_bmad-output/report-workflows/french-gdp-real-data.json` | `d9d3461c41c8329e4765f2f4b76c40c8b041530a9961d195b9380e1855f6818a` |
| Renderer boundary | `docs/visual-contract-v1.md` | `94bf9eb5b1fbe5a1b868179bb2a056cbf757841f5ebfccb39f3bb82e87f3d054` |
| Semantic tokens | `site/design/tokens.css` | `ca67d12d7f99021913affe2ebf03ea18fdf1f12bff75f4215631fe3c41593a5c` |
| Visual language | `site/design/visual-language.md` | `bbd8e1ce3909bef84efe8e80d46e0b2f6dc1be547d2227d68e347bfb9efc021b` |
| Shared report vocabulary (`valueStrip`, `placeChips`, `enablePicking`) | `site/visuals/report-shared.js` | `c02e98caf2646a5c069715e4eee8628ffa95e77494a0d1be7f141bbb9945005b` |
| Neutral visual template (baseline, not an exemplar) | `site/workflows/add-visual/template/visual.js` | `fb16e98839719c35340346d8713a6245730d2b1e0efaeb857e96b2cfa6be9987` |
| Handoff manifest structure | `.claude/skills/pulse-add-visual/assets/handoff-manifest.json` | `5a9cb11d301bc7b17009390c3a69413f45ee154c7c3b95c15494a5bca0fadc20` |

### Dataset contracts and their real Parquet

| Dataset | Contract | Contract SHA-256 | Parquet SHA-256 |
| --- | --- | --- | --- |
| `french-national-accounts-annual` | `datasets/french-national-accounts-annual/dataset-contract.yaml` | `8ce8ed5887dcc40df828e92bb2ae80ee74dde715beb69dd20e743a349b198745` | `5fd5fdc42a4eecdb7c3169d2d76394b8c244ce36c98d30d5558ef64efac84414` |
| `french-branch-value-added` | `datasets/french-branch-value-added/dataset-contract.yaml` | `21218e72b68de5ae44c7c0f875dcd436a90d78da8c8e0bfb723e24d4ee61faa8` | `01a17b8b4d626dae8c04dc0a903d6c28c2e992363c8b282904267752664f20e2` |
| `french-gdp-quarterly` | `datasets/french-gdp-quarterly/dataset-contract.yaml` | `2da28f548a9fee86b7b45edba2061f988b498f2d1326c9c71f7b4165b9ef5bcb` | `68c04fd2c5a1f4182741d286411f7a949f29c3d6e4a358df62e71860e2f4f85c` |
| `french-gdp-dollar-decomposition` | `datasets/french-gdp-dollar-decomposition/dataset-contract.yaml` | `033a4ca980d2f5ced29ddc7342913d5a437b19e957063d7d5bbbda295e3afa0f` | `27166c835b5e7cc31d683250e1e996174304ed68765519636db62e9cc1c2aeba` |
| `oecd-productivity-comparison` | `datasets/oecd-productivity-comparison/dataset-contract.yaml` | `2d3f91181afa44d1c14e695742c1b3cf2155254ecebddc62d25ae860d80c0234` | `41be82d51da91677b771ff73c221205b2a29e92feffe8514295fa6341a7a5533` |
| `french-departement-gdp` | `datasets/french-departement-gdp/dataset-contract.yaml` | `e83d4d4bb58d06315f2cb88ebc0cdc5fb85c7991ad6060b779bdff71fa2a9f09` | `e9f6ecb6d8877325b6d0ac9a6f28bc0df951d73818a8b84392de93e812aee11b` |
| `french-departement-geometry` | `datasets/french-departement-geometry/dataset-contract.yaml` | `4797195b41af039d42d6e50a8015613d7b80166408968e804df8b9b1d702848f` | `5fde9f7a26ab8796f8a0076e302ea16709b8fd039e49fede82591c2b82db4861` |
| `world-demography-age-structure` | `datasets/world-demography-age-structure/dataset-contract.yaml` | `d2dc0ee7714be3ab27efa945d5594f1517486b6a5b1983dd24a02bc817fb42b0` | `60bea39c5c1cfb9f3ae285d6039f247e4bf1d3b27b2e62a60e2d13607d174872` |

Each dataset also has a prose contract at `datasets/<id>/dataset-contract.md`.
**Read all eight.** They record the provider quirks the rows do not explain on
their own, and they are where the traps are written down.

Inspect the Parquet directly under `publish/public/data/<id>/dataset.parquet`.
Use its actual schema, periods, values, nulls, ragged edges and precision. Do
not invent fields, and do not design against the representative arrays in the
evidence file when the real rows are on disk.

---

## Who is reading, and in what order

The reader is an economist. Definitions of GDP, chained volumes, PPP, the
income approach or a wage share need no explanation, and the design must not
supply any: a sentence telling this reader how to read a contribution or why
two denominators differ is condescending. What the reader does need is every
quirk of the data itself — a series that stops a year earlier, a residual that
is derived, an area whose hours are not published, a projection mixed with
estimates.

The reader comes first for the headline: how large GDP is, how fast it grew in
the latest year and in the latest quarter, and which year and quarter those
are. They then take the report apart in its own order — where growth came from
on the demand side, how production is spread across branches (and down to
individual industries), how income is shared — before turning outward: what
French GDP is worth in dollars and why that moves, how France compares with
other OECD economies in growth and in living standards, what drives the gap in
GDP per inhabitant, and finally how unevenly GDP is spread across the country.

They return after each INSEE annual release (end of May) and each quarterly GDP
release. **Each section's represented period — its own latest year or quarter —
must be legible without interaction.**

---

## Standing questions

| ID | Question | Datasets |
| --- | --- | --- |
| `headline-output` | How large is French GDP, in total and per inhabitant, and how fast has it grown in volume each year and over the most recent quarters? | `french-national-accounts-annual`, `french-gdp-quarterly` |
| `demand-contributions` | Which expenditure components (household consumption, government consumption, investment, net trade, inventories) have carried or held back GDP volume growth in each year? | `french-national-accounts-annual` |
| `branch-structure` | How is value added distributed across branches of activity, and how has that distribution shifted, from broad sectors down to individual industries? | `french-branch-value-added` |
| `income-split` | How is value added shared between labour, capital and net taxes, once the self-employed are credited with a wage? | `french-national-accounts-annual` |
| `dollar-output` | How has French GDP measured in US dollars at market exchange rates evolved, and how much of each year's change comes from real growth, domestic price change and the euro-dollar exchange rate? | `french-gdp-dollar-decomposition` |
| `international-standing` | How do French GDP volume growth and GDP per inhabitant at purchasing power parity compare with those of other OECD economies? | `oecd-productivity-comparison` |
| `per-capita-drivers` | How much of the level and evolution of GDP per inhabitant, in France and in other OECD economies, comes from productivity per hour worked, hours per worker, the employment rate of the working-age population and the working-age share of the population? | `oecd-productivity-comparison`, `world-demography-age-structure` |
| `territorial-spread` | How unevenly is GDP per inhabitant spread across the French departements? | `french-departement-gdp`, `french-departement-geometry` |

### Decisions already taken with the requester

These are settled; design within them.

1. **Headline: annual history with a quarterly tail.** Annual observations from
   1949, then quarters for the most recent years, on one time axis. Quarterly
   levels are shown **annualised** (`gdp_chained_annualised_eur_mn`), quarterly
   growth **year on year** (`gdp_year_on_year_growth_pct`), so both sit on the
   annual scale; quarter-on-quarter growth belongs in the selected-values
   readout, not on the axis. The seam is defined **relative to the latest
   published quarter** — quarters for the last N years before it, never a
   calendar date — and quarters replace the annual points for every year they
   cover. **Choose N** (the requester suggested 6–8 so that 2020 appears
   quarter by quarter) and state it as a design decision. Only headline GDP
   gets the tail; per-inhabitant figures stay annual.
2. **Demand side from the published contributions**, which add up to GDP
   growth. Never stack chained component levels.
3. **Branches drill A10 → A38 → A88**, each level on its own span: A10 from
   1949, A38 from 1959, A88 from 1999 and a year behind the other two. Shares
   are at current prices.
4. **Income split with the AMECO adjustment**: labour income credited to
   non-employees at the average employee's compensation. Labour, capital, and
   the two net-tax layers close on GDP.
5. **Dollar GDP and PPP are both shown**: dollar GDP at market rates with its
   annual change decomposed (real growth + deflator change + exchange-rate
   change, in log points, stacked), and GDP per inhabitant at PPP for the
   international comparison.
6. **Country selector**: France always shown and not removable; all 38 OECD
   members selectable; **Germany, United Kingdom and United States selected by
   default with no interaction**. Aggregates (OECD, euro area, EU27) are
   available as reference lines but are never ranked among countries.
7. **GDP-per-inhabitant decomposition** shown both for France over time and
   across the selected countries.
8. **Departement GDP per inhabitant as a map** on the existing geometry.

---

## Real values you are designing against

From the evidence file and the Parquet, on the 2026 releases:

- Annual accounts reach **2025**; the quarterly series reaches **2026-Q2**.
  GDP was €2,991bn at current prices in 2025, growth 0.8%. The deepest annual
  contraction is 2020 (−7.4%), then 2009 (−2.8%), 1975 (−0.9%) and 1993
  (−0.4%); the fastest growth is 8.6% (1950).
- 2020 quarter by quarter: −5.0% and −12.2% quarter on quarter, then +15.1%;
  year-on-year growth runs from −17.0% (2020-Q2) to +17.1% (2021-Q2).
- Single contributions reach −4.5 points (final consumption, 2020), −3.6
  (imports, 2000) and −3.0 (inventories, 1975); signs mix within a year.
- The adjusted wage share runs from 55.1% (2007) to 68.5% (1949); the
  unadjusted share from 44.3% (1949) to 55.6% (1981). The gap between them is
  widest in 1949 (24 points) and narrowest in 2007 (4.8).
- Branches: A10 has 10 branches, A38 37 (UZ carries no value added), A88 86
  industries including 5 derived residual rows. The longest A88 label is 127
  characters. In 1949 industry was 28% of value added and agriculture 17.5%; in
  2025 agriculture is 1.6%.
- Dollar GDP: exchange-rate terms reach +26.0 log points (1986) and −25.2
  (1981); in 2015 dollar GDP fell 15.8 log points almost entirely through the
  exchange rate (−18.0). The deflator term peaks at 12.9 (1975).
- 2025 GDP per inhabitant at current PPP: United States $89,985, Germany
  $75,385, United Kingdom $64,465, OECD $64,170, France $63,974. GDP per hour:
  US $104.7, Germany $102.7, France $96.1, UK $85.6, OECD $71.1. Hours per
  worker: Germany 1,336, France 1,500, UK 1,533, US 1,773. Employment per
  inhabitant: France 0.444, the lowest of the five.
- Departements, 2024: Paris 314 and Hauts-de-Seine 281 (France = 100); Mayotte
  31, Guyane 42; the median departement is 79 and the ninth decile 109.

---

## Facts that must shape the design

These are measured, not assumed. Each is a way the report could mislead if the
design ignores it.

1. **Adjusted quarters do not sum to the annual accounts.** The quarterly
   series is seasonally *and working-day* adjusted; the annual accounts are
   not working-day adjusted. Four annualised quarters sit up to 0.14% above the
   annual total (2019, 2023, 2025). Where annual points give way to quarters the
   level steps by that much with no economic event behind it. Decide how the
   seam is marked so the reader never reads the step as growth.
2. **Two edges in the headline.** The annual series stops at the latest annual
   release (2025); quarters run on to 2026-Q2. Each must carry its own latest
   period.
3. **The branch levels have different spans and one is a year shorter.**
   Drilling from A38 into A88 shortens the time axis to 1999 onward and ends a
   year earlier than the parent. The change of span must be visible, never
   silent.
4. **Five A88 rows are derived residuals.** INSEE publishes no separate series
   for printing (18), basic metals (24), security activities (80), coal and
   metal-ore mining (05+07, one row) and households' own-use production (98).
   Their value is the A38 parent less its published industries, at current
   prices only — they have no volume series. They must be distinguishable from
   published industries.
5. **Chained volumes do not add up.** Only current-price shares partition the
   economy; no view may stack chained branch or component volumes.
6. **The income split carries owner-occupiers' imputed rent.** It sits inside
   operating surplus, hence in capital income; the imputation of labour income
   to non-employees exceeds published mixed income in 28 years (1975–2025), so
   part is taken from corporate surplus. These are data facts for the reader.
7. **Dollar GDP is on the World Bank's vintage, not INSEE's.** Its euro GDP
   matches INSEE to 1999 and 2019 but sits 0.5% (2024) and 0.4% (2025) below
   the latest INSEE release. Dollar GDP must not be presented as INSEE GDP
   converted.
8. **The euro changeover is a unit change in the provider's exchange rate.**
   It has been converted (francs at 6.55957 per euro); 1999 is an ordinary year
   in the decomposition (−4.2 log points on the exchange-rate term).
9. **Current PPP compares areas; constant PPP follows one area.** Cross-country
   levels in a year use current PPP; paths over time use constant 2020 PPP.
10. **Ragged starts and a ragged edge.** Hours begin in 1970 for France, 1980
    for the UK, 1987 for the US, 1991 for Germany, 1996 for the OECD total, and
    later for many members; GDP per capita for Australia, Bulgaria and Costa
    Rica stops at 2024 and Brazil at 2021. A country line begins and ends where
    its data do, and says so.
11. **New Zealand and Peru have no hours-based figures.** Their published hours
    fail the dataset's plausibility screen (`labour_input_is_plausible` false):
    New Zealand in every year from 1989, Peru 2007–2021. Both stay selectable;
    their GDP and GDP per inhabitant are real, their productivity and hours
    factors render an explicit *not published* state.
12. **The working-age split comes from a second provider, and part of it is a
    projection.** The employment rate of the working-age population and the
    working-age share need the UN 15–64 share, joined by ISO3 code and year to
    the OECD rows; it must be applied to the **OECD population** so the four
    factors still multiply to GDP per inhabitant. UN values after 2023 are
    **medium-variant projections** (`series_kind`), not estimates — 2024 and
    2025 in every selected country. The UN has no share for the OECD, euro-area
    or EU27 aggregates, so for aggregates the decomposition stops at employment
    per inhabitant.
13. **GDP is counted where people work, population where they live.** Paris and
    Hauts-de-Seine sit at about three times the national level because of
    commuters, which flattens any linear colour scale; half the departements
    lie between 72 and 89. Choose the scale deliberately. Mayotte has no
    per-inhabitant figure before 2014; 2022–2024 are provisional.

---

## Required controls and state

The report owns all state; visuals receive plain rows and display inputs only.

- **Represented period.** Preset windows plus an explicit custom range whose
  start and end the reader sets independently, on every time-series section.
  Sections whose data start later (A38, A88, PPP, hours, departements) clip to
  their own span and say so.
- **Shared observation selection.** The reader picks one year — from a control
  in the report's control row *or* by clicking any point on any figure — and
  every annual figure shows its values for that year. The quarterly tail
  follows the selection through its year; a section that publishes nothing for
  the selected year (A88 in the latest year, a country before its hours start,
  a departement before 2014) says where it stops rather than showing another
  year's value. Selection is report-owned state passed to visuals as a display
  input; a visual draws its marker and emits a selection event and never holds
  the selection itself.
- **Selected values go in one fixed strip.** Use `valueStrip` from
  `site/visuals/report-shared.js`, between the caption and the plot, in the same
  place on every figure, one strip per panel on a small multiple. Never a box
  beside the selected point. Give each value the unit a reader would say aloud,
  and keep the strip to the measures that figure answers for. `placeChips` is
  for labels a mark carries permanently (a series name at a line end, the year
  a series stops), never for selected values. The French consumer-prices report
  wires both; match that vocabulary rather than reinventing it.
- **Branch drill-down.** From an A10 branch into its A38 branches and from an
  A38 branch into its A88 industries, and back, keyboard-operable.
- **Comparator selection.** France fixed; Germany, United Kingdom, United
  States by default; all 38 members reachable without leaving the page;
  aggregates available as reference, never ranked among countries.
- **Departement selection.** Choosing a departement shows its values for the
  selected year and its path over time.

Interaction state — selections, drill level, focus, scroll position, open
disclosures, partially entered input — **must survive an asynchronous data
refresh**.

---

## Copy carries meaning, never measurements

A built report has no intelligence at run time: it renders dataset rows and
regenerates no text. A sentence asserting a value, direction, magnitude,
ranking, comparison or period is a hardcoded claim that goes false at the next
release. The real values above are for designing against, not for prose.

- Definitional copy — what a measure counts, what a residual row is, what the
  seam marks, what a control does — is what prose is for.
- Values belong in figures, tiles, direct labels, the selected-values strip and
  accessible tables, which render from the rows. A standfirst or caption
  restating a number shown on the same screen is redundant on release day and
  wrong a period later.
- Prose carries only what no figure on the page can show. Data warnings that no
  mark carries stay (the working-day seam, the World Bank vintage, UN
  projections, the screened countries, the commuting effect); method lessons go.
- A sentence that genuinely needs a live number is a derivation: declare it in
  the owning visual's contract with the columns it reads, so implementation
  computes it from the rows that draw the figure.

A returned design that ships narrative numbers in prose will be sent back.

---

## Deliverables

Decide the narrative sequence, layout, indicator framing, precision, and
interaction model. Design purpose-built visuals that answer the questions
above. Do **not** select a generic dashboard vocabulary or inherit chart types
from an existing Pulse report; derive presentation from these questions and
this data.

Every identifiable visual section needs a **Visual Contract v1** declaration:

- a stable lowercase kebab-case ID;
- consumer schema and display schema;
- inputs `rows`, `display`, `provenance`;
- fixture rows **selected from the supplied real Parquet**, including the
  boundary cases named above;
- validation behaviour;
- focused cleanup ownership.

Where a visual draws on more than one dataset (the headline's annual and
quarterly rows; the decomposition's OECD and UN rows; the map's measure and
geometry), name the dataset that decides which rows must appear — its row
spine — and the joins the report performs before the visual is called. The
map's spine is the geometry, so a departement with no figure still renders.

Return a self-contained HTML/SVG/CSS/JS prototype with working controls, the
design decisions and rationale, all contracts and fixtures, and every local
asset.

### States every visual must treat

`ready`, `loading`, `empty`, `suspect`, `stale`, `query-error`,
`schema-incompatibility`, `render-error`, `shared-engine-failure`.

Show **slot-local failure isolation**: one section failing must not take the
report down.

### Views

Desktop, narrow smartphone landscape, and 400% zoom / reflow, with no
horizontal page scroll at any of them.

---

## Binding constraints

- Ordinary DOM and hand-authored SVG through Visual Contract v1. **No chart or
  visualisation library**, the map included: it is hand-authored SVG from
  GeoJSON rows the report supplies.
- The report owns data access, parameter-bound SQL, row mapping, joins, state,
  routing and shared resources. Visuals only validate and draw supplied plain
  rows plus display and provenance inputs. No visual may reference SQL, DuckDB,
  Parquet paths, routes, or framework globals.
- **WCAG 2.2 AA**: semantic structure, logical keyboard operation, visible
  focus, sufficient contrast and target size, non-colour-only cues, reduced
  motion, zoom/reflow, and an accessible table or text equivalent for **every**
  visual — for the map, a sortable table of departements.
- Use the existing semantic roles in `site/design/tokens.css`. Keep one-off
  palette, geometry and layout local to the visual that needs them. Flag any
  proposed **shared** role for separate human approval.
- The prototype runtime is review-only. Identify design-only support files,
  remote assets and representative data so none is ported into production.
- **Provenance and licence must be visible**, per section:
  - INSEE: Licence Ouverte 2.0 — "Source: INSEE, comptes nationaux annuels,
    base 2020" and "… comptes nationaux trimestriels, base 2020".
  - World Bank: CC BY 4.0 — "Source: World Bank, World Development Indicators";
    the franc conversion and decomposition are changes, which CC BY requires be
    indicated.
  - OECD: CC BY 4.0 — "Source: OECD Productivity Database. This is an
    adaptation of an original work by the OECD." The adaptation notice is a
    licence obligation.
  - UN: CC BY 3.0 IGO — "Source: United Nations, Department of Economic and
    Social Affairs, Population Division, World Population Prospects 2024."
  - Eurostat: reuse with acknowledgement — "Source: Eurostat, gross domestic
    product at current market prices by NUTS 3 region (nama_10r_3gdp)."
  - IGN for the departement boundaries, as recorded in the geometry contract.
- Specify exact copy, layout, styling, geometry, behaviour, state, responsive
  and accessibility requirements. **These become binding after approval.**

### A note on the map's payload

The geometry table is 101 rows of unsimplified provider GeoJSON (about 1.75
million characters). If the design needs a lighter payload, say so explicitly
as a design decision with a stated tolerance; do not assume simplification
exists.

---

## Packaging

Package the result using the field structure in
`.claude/skills/pulse-add-visual/assets/handoff-manifest.json`, writing to
`claude-design-output/french-gdp/`.

**Do not mark it approved.** Approval is a separate human action.
