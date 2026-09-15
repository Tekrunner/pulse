# Claude Design handoff — Pulse "French unemployment"

Design output for report `french-unemployment`, produced against the published
Parquet listed in `_bmad-output/report-workflows/french-unemployment-design-brief.md`.

**Not approved.** Approval is a separate human action and is recorded outside
this directory.

## What is here

| Path | What it is |
| --- | --- |
| `unemployment-in-france.html` | The seeded design canvas. Published at <https://claude.ai/code/artifact/f921001b-000e-4c02-8ad2-2387a23eac12> |
| `design/Main.dc.html` | The composed report, desktop, ready state — the deliverable |
| `design/Map.dc.html` | Territorial section in full: choropleth, legend, insets, ranked equivalent |
| `design/International.dc.html` | International section in full — **working controls** |
| `design/States.dc.html` | All nine declared states, slot-local isolation, focus/target spec |
| `design/Narrow.dc.html` | Narrow smartphone landscape (740 px) |
| `design/Zoom.dc.html` | 400 % zoom / reflow (320 CSS px) |
| `design/Decisions.dc.html` | Decisions, rationale, costs, open questions |
| `design/canvas.json` | Canvas layout and annotations |
| `contracts/*.contract.js` | Six Visual Contract v1 declarations with validators |
| `fixtures/*.json` | Real published rows, including every boundary case |

## The six visuals

| Visual ID | Answers | Dataset |
| --- | --- | --- |
| `headline-trend-pair` | `headline-level`, `headline-rate` | `french-labour-market-quarterly` |
| `slack-multiples` | `labour-slack-composition` | `french-labour-market-quarterly` |
| `age-band-lines` | `age-gap` | `french-labour-market-quarterly` |
| `participation-gap-band` | `participation-gap` | `french-labour-market-quarterly` |
| `departement-choropleth` | `territorial-spread` | `french-departement-unemployment` + `french-departement-geometry` |
| `international-lines` | `international-standing` | `oecd-unemployment-comparison` + `oecd-participation-comparison` |

## Design-only — must NOT be ported into production

- **`design/*.dc.html` in their entirety.** They are review artboards. The
  production report is built from the contracts, the fixtures and the
  specification, not by porting this markup.
- **The map outlines on `Map.dc.html`** are decimated to roughly 30 vertices per
  département so the review canvas stays light. Production renders the published
  IGN geometry unchanged.
- **`geometry_geojson_excerpt`** in `contracts/departement-choropleth.contract.js`
  and `fixtures/french_departement_geometry.json` is truncated for review. The
  real column is `geometry_geojson` and carries the full geometry.
- **The `DATA` constant inside `design/International.dc.html`** is a copy of real
  rows made so the artboard's controls work offline. Production queries the
  dataset.

Everything else is real: every number on every artboard was read from the
published Parquet on 2026-09-14.

## Remote assets

None. No webfont, script, stylesheet or image is loaded from any remote host.
Type is the site's existing `Inter, system-ui, sans-serif` stack.

## Shared design roles

None proposed. The report uses the existing semantic roles in
`site/design/tokens.css` and the existing layout vocabulary in `site/style.css`.
All series palettes, class ramps and chart geometry are local to this report.

## Colour was computed, not chosen

Run against this report's own surface (`#232532`), not a default:

| Palette | Gate | Result |
| --- | --- | --- |
| First hand-picked set | categorical, adjacent | **FAILED 4 of 5** — outside the lightness band, below the chroma floor, CVD ΔE 3.1, normal-vision ΔE 9.0 |
| Documented order, slots 1–3 | categorical, **all pairs** | PASS — worst CVD ΔE 9.4, normal-vision 20.9 |
| Documented order, slots 1–8 | categorical, adjacent | PASS — worst CVD ΔE 8.4, normal-vision 19.3 |
| Blue ordinal, 3 steps (age bands) | ordinal | **FAILED** — darkest step 1.87:1 against this surface |
| Blue sequential, 6 steps (map) | ordinal | **FAILED** — adjacent ΔL 0.047 between two pairs |
| Blue sequential, **5 steps** (map) | ordinal | PASS — monotone, ΔL ≥ 0.06, recessive end 2.29:1 |

Final assignments: series `#3987e5 #d95926 #199e70 #c98500 #d55181 #008300
#9085e9 #e66767`; map classes `#1c5cab #3987e5 #6da7ec #9ec5f4 #cde2fb`
ascending with the rate; not-published `#3f424d` with a dashed edge.

## The three absence treatments

None of them is ever drawn as zero:

1. **Mayotte** — has a boundary, has no localised rate at any date.
2. **The four overseas départements before 2014-Q1** — the panel is not
   rectangular; INSEE begins publishing them in 2014.
3. **Switzerland and New Zealand** — OECD members absent from the monthly
   unemployment series; they stay in the selector with an explicit
   not-published-monthly state, and they do appear in the quarterly
   participation series.

## Open questions for the approver

1. The international chart caps at **eight concurrent series**. Past eight the
   palette has no ninth colour a colour-blind reader can separate, so a ninth is
   refused rather than served with a colour that lies. The ranked table is the
   answer for "compare everything". Confirm the trade.
2. The headline section defaults to **ten years**. Five would emphasise the
   recent rise; all 23 would put the 2015 peak of 10.5 % on screen.
3. Map class breaks are **round numbers** (6, 7, 8, 10) rather than quintiles, so
   the legend is memorable at the cost of uneven class populations.
4. `Main.dc.html` summarises the territorial and international sections rather
   than repeating them at full size; they have their own artboards. Confirm that
   is how you want to review the composition.

## Interaction fidelity

`design/International.dc.html` has **working controls** — add and remove a
comparator and watch the others keep their colours. Every other artboard is a
static specification of a state or a view; the behaviour those artboards imply is
written out in `design/Decisions.dc.html` and in the contracts, and becomes
binding on approval.

## Attribution obligations that must survive into production

- INSEE series (national and localised): Licence Ouverte / Open Licence 2.0.
- IGN boundaries: Licence Ouverte / Open Licence 2.0.
- OECD series: **CC BY 4.0, and the adaptation disclaimer is a licence
  obligation** — "This is an adaptation of an original work by the OECD" must
  appear wherever OECD data is shown, and the OECD logo and visual identity must
  not be used.
