# Handoff: Pulse Story 1.6 — French consumer prices standing report

## Overview

A standing monthly report on French consumer price inflation, rebuilt each month from INSEE's
consumer price index (Base 2025). It answers four questions in four figures, lets the reader
explore any period and any month, and ends with an equivalent-amount calculator.

It is a *report*, not a dashboard: every figure has a question as its heading, states its
provenance, and exposes the numbers behind it as a real data table.

## About the design files

`design/Pulse CPI Report.dc.html` is a **design reference created in HTML**. It is a prototype of
the intended look and behaviour, not production code to lift. The task is to recreate it in the
target codebase's existing environment (React, Vue, Svelte, server-rendered templates — whatever
the app already uses), following that codebase's established patterns, data layer and component
library. `design/support.js` is only the runtime that makes the prototype open in a browser; it has
no place in the implementation.

The design is written with inline styles and hand-built SVG on purpose. Two constraints are real
and should carry over:

- **No charting library.** Every figure is plain SVG geometry plus absolutely positioned DOM text.
  Labels are DOM, not `<text>`, so they stay legible and selectable at 400% browser zoom.
- **The report owns the query; the visual owns nothing but drawing.** Each figure receives rows and
  a display object; it never fetches, never derives, never measures the page.

Open the file directly in a browser to interact with it.

## Fidelity

**High fidelity.** Final colours, typography, spacing, states and interactions. Recreate it
pixel-accurately using the codebase's own libraries. All colour and type values come from the
Nocturne design system (`design-system/styles.css`) — link that stylesheet and read
`var(--color-*)` / `var(--font-*)` rather than copying hexes, with the two documented exceptions
under **Design tokens** below.

## Data

Two datasets, contract 1.0.0:

- `insee_cpi_monthly` — `period`, `cpi_index`, `monthly_change_pct`, `annual_change_pct`
- `insee_cpi_category_analysis` — `period`, `food_index`, `food_annual_change_pct`, `energy_index`,
  `energy_annual_change_pct`, `actual_rent_index`, `actual_rent_annual_change_pct`,
  `{food,services,manufactured_products,energy}_official_contribution_pct_points`,
  `actual_rent_pulse_contribution_pct_points`, `food_weight`, `energy_weight`, `actual_rent_weight`
  and their reference years

`period` is `YYYY-MM`, ascending, one row per month, no gaps. Coverage in the prototype is
**1998-01 to 2026-07** (the first month both datasets cover, to the latest published month).
The full extracts are in `fixtures/` and are what the prototype runs on.

Precision is displayed exactly as published: index two decimals, percentages and contributions one
decimal, the rent contribution three.

### Provider-published vs. calculated

| Value | Origin |
| --- | --- |
| Index levels, monthly and annual change, headline / food / energy | Published (series 011814056, 011814057, 011814058, 011813717, 011813719, 011813864, 011813866) |
| Four official contributions | Published (011813664 food, 011813665 services, 011813666 manufactured, 011813668 energy) |
| Rent index, annual weights | Published (011815633, 011815638) |
| Rent annual change | Calculated: `(index ÷ index 12 months earlier − 1) × 100` |
| Rent contribution | Calculated: `weight ÷ 10 000 × rent annual change` |
| Component month-over-month change | Calculated from the component index; no component m/m is published |
| Equivalent amount | Calculated: `amount × (target index ÷ origin index)` |

### Representative series — must be replaced

Services and manufactured products have **no index and no weight** in the datasets yet, only their
contributions. The prototype reconstructs both so the design can be reviewed whole:

```
annual_change  = contribution × 10 000 ÷ representative_weight
index          = chained off its own value 12 months earlier, seeded from the headline
                 index for the first 12 months, then rebased so 2025 averages 100
representative_weight = 4 770 (services), 2 370 (manufactured), per 10 000, held flat
```

Every place they appear is marked "representative" — the component selector, figure 1's
provenance and table caption, the divergence panel readouts, the index-path legend, the table
headers and the method section. **When the dataset publishes the real series, swap the data and
delete the reconstruction and every "representative" marker.** No layout changes.

## Layout

Single column, `max-width: 1180px`, centred, `padding: 22.4px 16.8px 44px`, `display: flex;
flex-direction: column; gap: 22.4px`. Sections top to bottom:

1. **Design harness** (review only — must not ship). A dashed bar switching the six render states.
   Behind the `showDesignHarness` prop.
2. **Header** — kicker, `h1` 40px/500/-0.015em, standfirst, and a definition list of latest month,
   source, licence and datasets. Bottom border `var(--color-divider)`, padding-bottom 16.8px.
3. **Where prices stand** — four scorecards, `grid-template-columns: repeat(auto-fit, minmax(190px, 1fr))`,
   gap 11.2px: annual change, monthly change, index level, largest contribution. Each is kicker
   (10px, 0.1em, uppercase, accent-400) / value (32px/500, tabular-nums) / note (12px, neutral-400).
4. **Exploration controls** — `position: sticky; top: 0; z-index: 5`, surface `var(--color-bg)`,
   1px ring, radius 8px, flex-wrap with 16.8px gaps. Falls back to `position: static` under
   `max-height: 480px`.
5. **Figures** — four `<figure>` cards, gap 33.6px, each `background: var(--color-surface)`,
   `box-shadow: 0 0 0 1px var(--color-neutral-800)`, radius 8px, padding 16.8px.
6. **Equivalent-amount calculator.**
7. **Method, provenance and limits** — three columns, `repeat(auto-fit, minmax(260px, 1fr))`.

Everything reflows: no fixed widths on text containers, `minmax(0, 1fr)` tracks, charts measured
from their wrapper.

## Controls

**Represented period.** Three presets — 2 years / 5 years / From start — as a radio group styled as
a segmented control (44px min-height, 1px divider between options, active label
`var(--color-accent-400)`). Beside them, From and to pickers, each a **month `<select>` plus a year
`<select>`** (1998–2026). Native `<input type="month">` was tried and rejected: its picker will not
reach back to 1998 in every host. Changing start past end (or the reverse) drags the other with it.

**Observation month.** A range input over the current window, plus an `aria-live` readout:
`Jul 2026 · headline +2.1% y/y, +0.6% m/m, index 102.67`. **Clicking anywhere on any figure selects
the nearest month** — the click maps clientX through the SVG's viewBox to a row index. The selection
is stored as a period string, not an index, so it survives a period change.

**Components shown.** Five checkboxes — Food, Services, Manufactured products, Energy, Rents paid —
each with a colour swatch. Drives figures 3 and 4. A warning-coloured note states that services and
manufactured products carry representative values.

**Figure 1's own series selector.** One series at a time (Headline / Food / Services / Manufactured
/ Rents paid), as a segmented radio row inside the figure. Deliberately not a multi-series overlay:
the m/m bar lane below the line only reads for one series.

## Figures

All four share one x scale: `padL = 44`, `padR = 14`, `innerW = max(120, width − 58)`,
`X(i) = padL + i × innerW / (n − 1)`. Tick count is `clamp(2, 7, floor(innerW / 110))`.
Y domains are "nice" — step chosen from 1/2/2.5/5/10 × 10^k so about four gridlines cover the span,
always including zero. Zero gridline `var(--color-neutral-600)`; others
`color-mix(in srgb, var(--color-text) 10%, transparent)`.

### 1. How is inflation evolving?

Line of the selected series' annual change (2.5px, round joins) over a lower lane of
month-over-month bars (bar width `clamp(1.5, 14, innerW/n × 0.62)`, positive in the series colour,
negative `var(--color-neutral-600)`, zero line at the lane's centre). Height
`clamp(190, 300, width × 0.26)`. A dashed vertical line and a 5px ring mark the selected month, with
two bold labels beside it: `+2.1% y/y` next to the point and `+0.6% m/m` in the bar lane, both
flipping to the other side of the line past the halfway point.

### 2. What is carrying the annual rate?

The four official contributions stacked (positives up, negatives down from zero) against the
headline rate as a white dashed line. Stack height `clamp(170, 260, width × 0.22)`, bar width
`clamp(1.5, 16, innerW/n × 0.68)`.

**The rent lane is separate and on its own scale.** Rents paid are already inside the services
contribution, so stacking them would double-count. They sit in a 62px lane below the x axis with its
own zero line, its own maximum labelled in the left gutter, and a `Rents, pp` caption below the zero
line. The lane block reserves 22px for that caption; without it the wrapper overflows, raises a
scrollbar, and rescales the SVG out of step with the DOM label overlay.

A callout box beside the selection line lists every value for that month: the four contributions,
the headline rate and the rent lane, each with its swatch.

### 3. Which components diverge from headline?

One panel per selected component, wrapping at up to three columns (one column under 780px). All
panels share a vertical scale so gaps are comparable. Each panel: the component's annual change
(2.5px), the headline rate (1.5px dashed accent), the area between them filled at 14% opacity, a
dashed selection line and a dot.

Beneath each panel, a **basket-share strip** — 30px tall, the component's weight as a percentage
across the same months, with min and max labelled in the gutter and a dot at the selection. Weights
step once a year, so the strip is a staircase. When the share is flat over the window (short
windows, or the representative components) it emits **one** label, not a min/max pair that would
overlap.

Panel readout: `Basket share 14.9% in Jul 2026 (2026 weights), from 15.5% at the start of this window.`

Note that the three published shares do not sum to 100%: the datasets carry weights for food,
energy and rents only, so the remainder cannot be attributed. Say so; do not imply it is services.

### 4. What has the price level actually done?

Index levels, Base 2025 = 100, one line per selected component plus headline. Dash patterns
distinguish them: headline solid, food `6 4`, services `4 3`, manufactured `1 3`, energy `2 4`,
rents `10 4`. The 100 gridline is drawn in `var(--color-neutral-600)`.

At the selected month, a dot per series and a value chip per series
(`background: color-mix(in srgb, var(--color-bg) 92%, transparent)`, 1px 4px padding, radius 4px).
Chips are pushed apart to a 17px minimum and clamped inside the plot; they flip to the left of the
selection line once it passes the halfway point. The chip background is required — without it the
line strokes run straight through the digits.

## Equivalent-amount calculator

Amount (number input, default 100) · origin month (month + year selects, default twelve months
before the latest published month) · **⇄ Swap** button · target month (default latest published
month) · result card.

Result: `amount × (target index ÷ origin index)`, formatted `€103.24`, with
`+2.1% over 12 months · +2.1% a year` beneath (the annualised figure appears only when the gap is at
least twelve months), and a full sentence naming both index levels. Swap exchanges the two months.

## States

Six, all designed, all switchable in the harness:

- **Ready** — the report.
- **Loading** — `aria-busy`, a line naming the window, three skeleton blocks (300/340/220px) with a
  1.6s opacity pulse, suppressed under `prefers-reduced-motion`.
- **Empty result** — no observations in the window; explains that the datasets stop at the latest
  month both providers publish in full, offers "Show the last five years".
- **Query error** — `role="alert"`, red left border. Shows nothing rather than partial figures,
  names the last successful month, states that the selection was not lost, prints the machine
  detail (`query_failed · datasets · window`), offers Retry.
- **Schema error** (figure 2) — the figure alone is replaced; the rest of the report is unaffected.
  Names the field the visual declared and what arrived: `TypeError · contribution-stack@1.0.0 ·
  row 0 · expected number, received undefined`.
- **Render error** (figure 3) — caught at the figure boundary; the accessible data table is kept so
  the answer is still available.

Errors are per-figure wherever possible. A figure that cannot draw never takes down the report.

## State model

```
w             number | null    measured chart width
startP, endP  "YYYY-MM"        the represented period
selP          "YYYY-MM" | null  selected observation month (null = latest in window)
cats          { food, services, manufactured, energy, rent: boolean }
v1s           series key for figure 1
amount        number | null
calcFrom, calcTo  "YYYY-MM" | null
harness       render state (review only)
```

### Measurement — read this before rebuilding the charts

Charts size themselves from the **chart wrapper's** content box, not from the root element and not
from the viewport. In the prototype this took several attempts to get right; the rules that ended up
mattering:

- Measure on every commit, not only on mount — a width captured during a placeholder phase must
  never stick.
- Re-observe when the measured node changes identity.
- Ignore zero-width reads.
- `ResizeObserver` is not delivered in every host, so a 500ms poll backs it up; it only calls
  `setState` when the width actually changed.
- Any wrapper with `overflow-x: auto` also needs `overflow-y: hidden`. CSS forces `overflow-y` to
  `auto` when `overflow-x` is not `visible`; a stray vertical scrollbar then narrows the SVG while
  the absolutely positioned DOM label overlay keeps its unscaled coordinates, and every label
  drifts.

In a real app with a layout engine you may be able to drop the poll — but keep the "measure the
wrapper, on every commit" rule.

## Accessibility

- Every figure is `role="img"` with an `aria-label` that states the series, the range, the extremes
  and the selected month's values.
- Every figure has a `<details>` disclosure holding the provenance sentence, the parameterised SQL,
  and a full data table with `<caption>`, `scope="col"`/`scope="row"` and tabular numerals.
- The observation-month range input carries `aria-valuetext` and an `aria-live="polite"` readout;
  click-to-select is an addition to it, never a replacement.
- Controls are 44px minimum height. Focus is `2px solid var(--color-accent)` at 2px offset —
  never the browser default.
- Chart labels are DOM text, so they survive 400% zoom.
- `prefers-reduced-motion` disables the skeleton pulse.

## Design tokens

All from Nocturne — `design-system/styles.css`, reproduced here for reference. Link the real one.

Colours used: `--color-bg` #161826, `--color-surface` #232532, `--color-text` #e9e9ed,
`--color-neutral-300` #cfd3e5, `--color-neutral-400` #b2b6ca, `--color-neutral-500` #9397ab,
`--color-neutral-600` #75798c, `--color-neutral-700` #595d6c, `--color-neutral-800` #3f424d,
`--color-neutral-900` #292b31, `--color-accent` #9184d9, `--color-accent-300` #d2cefd,
`--color-accent-400` #b5abfc, `--color-divider`.

Spacing is Nocturne's 0.7× density scale: 2.8 / 5.6 / 8.4 / 11.2 / 16.8 / 22.4 / 33.6 / 44px.
Radius 8px throughout (4px on the small value chips). Type is `var(--font-body)` (Inter):
40px/500 h1, 25px/500 h2, 20px/500 figure headings, 15px body, 13px secondary, 12px captions,
11px table headers, 10px uppercase kickers at 0.1em tracking. Numbers are always
`font-variant-numeric: tabular-nums`.

**Two documented extensions Nocturne does not carry**, and one constraint:

- Categorical chart palette: food `#8fb0d1`, energy `#d09a6a`, rents `#9dc0ae`, share strip
  `#8f93a6`. Services and manufactured products reuse `--color-accent-400` and
  `--color-neutral-500`. If your codebase has a chart palette, use it instead.
- Error red `#ff8a80`.
- SVG fills and strokes are written as literal hexes because SVG presentation attributes cannot
  read CSS variables. If you need them tokenised, resolve the tokens once at runtime and pass the
  resolved values into the drawing code.

## Assets

None. No images, no icon font, no SVG illustration. Inter is loaded from Google Fonts in the
prototype; use however the target codebase loads it.

## Files

```
README.md                        this document
design/Pulse CPI Report.dc.html  the design reference — open in a browser
design/Story 1.6 Design Decisions.dc.html
                                 the written decisions behind it: questions, indicators,
                                 schemas, state treatments
design/support.js                prototype runtime only — do not port
contracts/*.contract.js          Visual Contract v1 declarations for the four figures:
                                 consumer schema, display schema, fixture rows, validators
fixtures/insee_cpi_monthly.json  full extract, 1996-01 to 2026-07
fixtures/insee_cpi_category_analysis.json
                                 full extract, 1998-01 to 2026-07
design-system/styles.css         Nocturne tokens and components (reference copy)
design-system/nocturne-readme.md Nocturne's own guide
```

Start with the four contracts: they define exactly what each visual is allowed to receive, and the
validators show the failure the schema-error state was designed for.
