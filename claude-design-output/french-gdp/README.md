# Design handoff — Pulse "French GDP"

Design output for report `french-gdp`, produced on a Design canvas against the
published Parquet listed in `_bmad-output/report-workflows/french-gdp-design-brief.md`.
Canvas: <https://claude.ai/artifact/LveKNV5Bi5XFPrkG95ZSMa>.

**Not approved.** Approval is a separate human action and is recorded outside
this directory.

## What is here

| Path | What it is |
| --- | --- |
| `design/Main.dc.html` | The composed report, desktop, ready state, with working controls — the deliverable |
| `design/States.dc.html` | The nine declared states, slot-local isolation, data-driven states, focus and targets |
| `design/Narrow.dc.html` | Narrow smartphone landscape (740 px) |
| `design/Zoom.dc.html` | 400 % zoom / reflow (320 CSS px) |
| `design/Decisions.dc.html` | Decisions and rationale |
| `design/canvas.json` | Canvas layout |
| `design/gdp-data.js` | Review-only data script: real published rows and simplified outlines |
| `contracts/*.contract.js` | Eight Visual Contract v1 declarations with validators |
| `fixtures/*.json` | Real published rows, including every boundary case |

## The eight visuals

| Visual ID | Answers |
| --- | --- |
| `output-growth-tail` | How large is French GDP, in total and per inhabitant, and how fast has it grown in volume each year and over the most recent quarters? |
| `demand-contribution-bars` | Which expenditure components have carried or held back GDP volume growth in each year? |
| `branch-share-panels` | How is value added distributed across branches of activity, and how has that distribution shifted, from broad sectors down to individual industries? |
| `income-share-panels` | How is value added shared between labour, capital and net taxes, once the self-employed are credited with a wage? |
| `dollar-decomposition` | How has French GDP measured in US dollars at market exchange rates evolved, and how much of each year's change comes from real growth, domestic price change and the euro-dollar exchange rate? |
| `oecd-standing` | How do French GDP volume growth and GDP per inhabitant at purchasing power parity compare with those of other OECD economies? |
| `per-capita-drivers` | How much of the level and evolution of GDP per inhabitant comes from productivity per hour, hours per worker, the employment rate of the working-age population and the working-age share? |
| `departement-choropleth` | How unevenly is GDP per inhabitant spread across the French departements? |

## Design-only — must NOT be ported into production

- `design/*.dc.html` and `design/gdp-data.js` in their entirety. They are review
  artboards and a review data file. Production is built from the contracts, the
  fixtures and the specification in the artboards, with data from the report's
  own queries.
- The simplified map outlines in `gdp-data.js`: the tolerance is a design
  decision (see Decisions); production applies it in its own row mapping.
