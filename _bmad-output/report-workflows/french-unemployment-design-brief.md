# Claude Design production brief: French unemployment

This is a design and authoring session against real report-facing data, before
production implementation. Produce the complete report surface and every
purpose-built visual in it, for human review. Do not write a coding-agent brief
and do not defer content or visual decisions to implementation.

One report, one handoff. Every section below is part of the same reading
experience and must be composed together, not designed as independent widgets.

---

## Read these inputs in full

| Input | Path | SHA-256 |
| --- | --- | --- |
| Report work record (questions, source decisions) | `_bmad-output/report-workflows/french-unemployment.json` | `119ce07ef6fb8619a27851f2279e071d4f9c0e59f713190df26c96aa2e7c2048` |
| Real-data evidence (representative rows, boundary cases) | `_bmad-output/report-workflows/french-unemployment-real-data.json` | `516215e9d3bec9d269b86223e8e01a87b7b8933d164a5291dcb0adeb69343f07` |
| Renderer boundary | `docs/visual-contract-v1.md` | `94bf9eb5b1fbe5a1b868179bb2a056cbf757841f5ebfccb39f3bb82e87f3d054` |
| Semantic tokens | `site/design/tokens.css` | `ca67d12d7f99021913affe2ebf03ea18fdf1f12bff75f4215631fe3c41593a5c` |
| Visual language | `site/design/visual-language.md` | `bbd8e1ce3909bef84efe8e80d46e0b2f6dc1be547d2227d68e347bfb9efc021b` |
| Shared report styles | `site/visuals/report-shared.js` | `abdcac8333f106876ee476a6120b696808087b73437defdedb25397d0d98c34e` |
| Neutral visual template (baseline, not an exemplar) | `site/workflows/add-visual/template/visual.js` | `fb16e98839719c35340346d8713a6245730d2b1e0efaeb857e96b2cfa6be9987` |

### Dataset contracts and their real Parquet

| Dataset | Contract | Contract SHA-256 | Parquet SHA-256 |
| --- | --- | --- | --- |
| `french-labour-market-quarterly` | `datasets/french-labour-market-quarterly/dataset-contract.yaml` | `e4decf2c16335f012a97b4a88bd0b207f1dac52ad8a92b3213681c9a7e2d1ebb` | `8d984b3ecae6373d58c9f9f2ce361a2b31cbb8869bcd564eeabc0c1837cbb883` |
| `french-departement-unemployment` | `datasets/french-departement-unemployment/dataset-contract.yaml` | `30c96f70abdbf861c59579cc18f3fc9eb2d34d510992bbd4c7fdaa4593605ec9` | `4c4ce328448ad9d8e22ceceea4ac1788c26b88f0e0517f8f2753fcbab3802799` |
| `french-departement-geometry` | `datasets/french-departement-geometry/dataset-contract.yaml` | `a7088d53ca9d38774708930a275987f2750fc536ad35652d0abca726300d8421` | `5fde9f7a26ab8796f8a0076e302ea16709b8fd039e49fede82591c2b82db4861` |
| `oecd-unemployment-comparison` | `datasets/oecd-unemployment-comparison/dataset-contract.yaml` | `9dfb7135d01acb9220ff6a682ea58677f53099f9f53b7eba1d0489c502461061` | `0779ab7e5c146e56a0f0b54341026ba595cd2cdfd722cb4f0136e3a053d27138` |
| `oecd-participation-comparison` | `datasets/oecd-participation-comparison/dataset-contract.yaml` | `b9fe77dc8551354252798870f3ffd0197096224daff9d8e69be93daec20209ac` | `e65bee2ba5c955a41f6a842f24a9956d186b9e73333b56926289f54119c0c870` |

Each dataset also has a prose contract at `datasets/<id>/dataset-contract.md`
which states its comparability limits in detail. **Read all five.** They are
where the traps are written down.

Inspect the Parquet directly. Use its actual schema, periods, values, nulls,
ragged edges and precision. Do not invent fields and do not design against the
representative arrays below when the real rows are on disk.

---

## Who is reading, and in what order

The reader arrives with a headline rate already in mind from the news. They
first check the current level, the direction of the last move, and **which
quarter it refers to**. They then test that headline against the wider slack
measures — the gap between the ILO rate and the halo is the point of that
section. Next they look for themselves: their age band, then their département,
then their sex in the participation figures. International comparison is read
last and comparatively: the question is whether France sits above or below its
usual peers.

They return each quarter on release day, so **the represented period and the
freshness of each section must be legible without interaction**.

---

## Standing questions

The report must answer all seven. Their IDs are stable and must survive into
whatever you produce.

| ID | Question |
| --- | --- |
| `headline-level` | How many people in France are unemployed on the ILO definition, and how has that number moved? |
| `headline-rate` | What share of the active population is unemployed, and how has that share moved? |
| `labour-slack-composition` | Beyond headline ILO unemployment, how large are long-term unemployment, the halo around unemployment and underemployment, each as a count of people and as its own published rate? |
| `age-gap` | How far apart are the unemployment rates of under-25s, 25-to-49-year-olds and people aged 50 or over, and is the gap widening? |
| `territorial-spread` | How unevenly is unemployment spread across the French départements, and where are the extremes? |
| `participation-gap` | What share of the population takes part in the labour market, and how far apart are men and women? |
| `international-standing` | How do France's unemployment rate and participation rate compare with those of other OECD economies? |

### Scope decision already taken

"Categories of unemployment" means **INSEE's own ILO family** — ILO
unemployment, long-term unemployment, the halo, underemployment — because every
item in it has an officially published count *and* an officially published rate.
France Travail categories A to E were considered and **deliberately excluded**:
they are a register-based administrative population with no official expression
as a share of the active population. Do not reintroduce them.

---

## Real values you are designing against

Read from the published Parquet on 2026-09-14. These are illustrative of
magnitude and shape; the full evidence file has more, including every boundary
case.

**National, 2026-Q2** — headline rate **8.3 %**, **2 677** thousand unemployed,
under-25 **21.6 %**, 25–49 **7.5 %**, 50+ **5.5 %**, long-term rate **2.1 %**,
halo **1 825** thousand (**4.4 %** of the 15–64 population), underemployment
**4.4 %**, participation 15–64 **75.4 %** (men **78.0**, women **72.8**).

**Range over the 94 published quarters (2003-Q1 – 2026-Q2)** — headline between
**7.2 %** and **10.5 %**. The men/women participation gap on the 15–64 basis
narrowed from **10.6 points** (2003-Q4) to **5.1 points** (2020-Q4).

**Départements, 2026-Q1** — highest Guyane **19.3 %**, La Réunion **19.0 %**,
Guadeloupe **15.2 %**; lowest Cantal **4.7 %**, Lozère **4.9 %**, Manche
**5.5 %**. A fourfold spread, with the overseas départements occupying the top.

**OECD, each country at its own latest month** — France **8.3 %** (2026-07),
Germany **4.0 %** (2026-07), Spain **10.0 %** (2026-07), Italy **5.8 %**
(2026-07), **United Kingdom 4.9 % (2026-05)**.

---

## Eight facts that must shape the design

These are measured, not assumed. Each one is a way this report could lie to a
reader if the design ignores it.

1. **Four slack rates, four different denominators.** ILO unemployment and
   long-term unemployment are shares of the *labour force*; the halo is a share
   of the *population aged 15–64*; underemployment is a share of *employment*.
   Stacking these four rates, or reading their differences as one quantity,
   would be wrong. Their **counts** share a unit (thousands of people) and may
   be compared directly, but they **overlap** — a long-term unemployed person is
   also an unemployed person, so they are not parts of a whole either.

2. **The national headline and the map's national line are different numbers.**
   `french-labour-market-quarterly` is France *including* Mayotte: **8.3 %** at
   2026-Q2. `french-departement-unemployment` publishes metropolitan France at
   **7.9 %** and France excluding Mayotte at **8.1 %**, both at 2026-Q1. A
   département must be compared against the country rows in **its own** table.

3. **The map trails the national series by a quarter.** National data reaches
   2026-Q2; localised data reaches 2026-Q1. Any view showing both must say which
   quarter each is at rather than implying they are simultaneous.

4. **The territorial panel is not rectangular.** The 96 metropolitan
   départements run from 1982-Q1; Guadeloupe, Martinique, Guyane and La Réunion
   only from **2014-Q1** — 128 quarters with 96 départements, 49 with 100. If a
   reader can reach a quarter before 2014, those four must read as *unpublished*,
   never as zero and never as silently absent shapes.

5. **Mayotte has a shape but no rate.** The geometry table has 101 rows; only 100
   départements carry a localised rate. The map must decide explicitly what
   Mayotte looks like.

6. **The OECD edge is ragged, and the UK is the problem.** On 2026-09-14 the
   United States had reached 2026-08, 38 areas 2026-07, and the **United Kingdom
   only 2026-05**. A chart drawing all five defaults "to the latest month" either
   stops at the slowest or implies the UK line ended. Choose, and say which.

7. **Switzerland and New Zealand are OECD members absent from the monthly
   unemployment data.** They are present in the quarterly participation data.
   The requester decided on 2026-09-14 that they **stay in the selector** and
   render an explicit *not published at this frequency* state. They must not
   vanish.

8. **Three participation bases, two of which are comparable.** France's
   **all-ages** activity rate (**56.9 %** at 2026-Q2) is the *same* 15-or-over
   basis as the OECD figure (**56.9 %**): across all 94 shared quarters they
   differ by at most **0.7 points**, average **0.49**, and coincide in only 4.
   France's **15-to-64** rate (**75.4 %**) is a *different* basis — about 18
   points higher because it excludes the retired population. Putting the 15-to-64
   rate on an axis with an OECD figure would manufacture an enormous gap out of
   nothing but the denominator. Likewise France's own headline (8.3 %, INSEE) and
   OECD's France (8.3 %, harmonised) agree closely but not always: across 94
   quarters they differ by up to **0.4 points**.

---

## Required controls and state

The report owns all state; visuals receive plain rows only.

- **Represented period / time window.** The reader must be able to change the
  window on the time-series sections. Decide the control and the default.
- **Observation selection.** Reading a specific quarter's values is a primary
  behaviour, not a hover affordance. It must be keyboard-operable.
- **Département selection.** Choosing a département, and reading its series over
  time, is question `territorial-spread`'s second half.
- **International comparator selection.** Default to **France, Germany, United
  Kingdom, Italy, Spain** with **no interaction required**. All 38 OECD members
  must be reachable **without leaving the page**. Aggregates (`EA`, `EU`, `G7`,
  `OECD`) are available and useful — a reader comparing France to "the OECD"
  wants exactly that — but must never be ranked among countries.
- **Sex selection** on participation: men, women, both.

Interaction state — selections, focus, scroll position, open disclosures,
partially entered input — **must survive an asynchronous data refresh**.

---

## Deliverables

Decide the narrative sequence, layout, indicator framing, precision, and
interaction model. Design purpose-built visuals that answer the questions above.
Do **not** select a generic dashboard vocabulary or inherit chart types from the
existing French consumer-prices report; this report's questions are different.

Every identifiable visual section needs a **Visual Contract v1** declaration:

- a stable lowercase kebab-case ID;
- consumer schema and display schema;
- inputs `rows`, `display`, `provenance`;
- fixture rows **selected from the supplied real Parquet**, including the
  boundary cases named above;
- validation behaviour;
- focused cleanup ownership.

Return a self-contained HTML/SVG/CSS/JS prototype, the design decisions and
rationale, all contracts and fixtures, and every local asset.

### States every visual must treat

`ready`, `loading`, `empty`, `suspect`, `stale`, `query-error`,
`schema-incompatibility`, `render-error`, `shared-engine-failure`.

Show **slot-local failure isolation**: one section failing must not take the
report down.

### Views

Desktop, narrow smartphone landscape, and 400 % zoom / reflow.

---

## Binding constraints

- Ordinary DOM and hand-authored SVG through Visual Contract v1. **No chart or
  visualisation library.** This includes the map: the choropleth is hand-authored
  SVG from GeoJSON rows the report supplies.
- The report owns data access, parameter-bound SQL, row mapping, state, routing
  and shared resources. Visuals only validate and draw supplied plain rows plus
  display and provenance inputs. No visual may reference SQL, DuckDB, Parquet
  paths, routes, or framework globals.
- **WCAG 2.2 AA**: semantic structure, logical keyboard operation, visible focus,
  sufficient contrast and target size, non-colour-only cues, reduced motion,
  zoom/reflow, and an accessible table or text equivalent for **every** visual —
  including the map, where a sortable table of départements is the equivalent.
- Use the existing semantic roles in `site/design/tokens.css`. Keep one-off
  palette, geometry and layout local to the visual that needs them. Flag any
  proposed **shared** role for separate human approval.
- The prototype runtime is review-only. Clearly identify design-only support
  files, remote assets and representative data so none is ported into production.
- Provenance and licence must be visible. INSEE data is *Licence Ouverte 2.0*.
  **OECD data is CC BY 4.0 and its attribution must carry the adaptation
  disclaimer** — "This is an adaptation of an original work by the OECD" — which
  is a licence obligation, not a stylistic choice.
- Specify exact copy, layout, styling, geometry, behaviour, state, responsive and
  accessibility requirements. **These become binding after approval.**

### A note on the map's payload

The geometry table is 101 rows totalling about **1.75 million characters** of
GeoJSON, the largest single geometry being about 43 000. Nothing is simplified
upstream — the provider's own small-scale generalisation was chosen at
acquisition. If your design needs a lighter payload, say so explicitly as a
design decision with a stated tolerance; do not assume simplification exists.

---

## Packaging

Package the result using the field structure in
`.claude/skills/pulse-add-visual/assets/handoff-manifest.json`, writing to
`claude-design-output/french-unemployment/`.

**Do not mark it approved.** Approval is a separate human action.
