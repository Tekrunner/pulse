# Claude Design production brief: __REPORT_TITLE__

This is a design and authoring session against real report-facing data, before production implementation. Produce the complete report surface and its purpose-built visuals for human review. Do not write a coding-agent brief or defer content and visual decisions to implementation.

## Read these inputs in full

- Approved story and questions: `__STORY_PATH__` (SHA-256 `__STORY_SHA256__`)
- Dataset contracts: __DATASET_CONTRACT_PATHS_AND_SHA256__
- Corresponding real Parquet: __PARQUET_PATHS_AND_SHA256__
- Neutral renderer boundary: `docs/visual-contract-v1.md`
- Semantic tokens: `site/design/tokens.css`
- Visual language: `site/design/visual-language.md`
- Relevant shared styles: __SHARED_STYLE_PATHS__

Inspect the Parquet directly. Use its actual schema, periods, values, negative values, null behavior, and precision. Do not invent fields or base design decisions on representative arrays when report-facing rows exist.

## Decide and produce

Decide the standing questions, narrative sequence, indicator definitions, units, precision, represented periods, layout, and interaction model. Design at least three purpose-built visuals that answer the questions rather than selecting a generic dashboard or inherited chart vocabulary. Define parameterized query needs and report-owned controls/state. Specify provenance and a complete accessible data equivalent for every visual.

For every visual, return a Visual Contract v1 declaration with a stable lowercase kebab-case ID, consumer schema, display schema, inputs (`rows`, `display`, `provenance`), fixture rows selected from the supplied real Parquet, validation behavior, and focused cleanup ownership. Keep calculations and non-additive relationships explicit.

Return a self-contained HTML/SVG/CSS/JS prototype, the design decisions and rationale, all contracts and fixtures, and every local asset. Include ready, loading, empty, suspect, stale, query-error, schema-incompatibility, render-error, and shared-engine-failure treatments. Show slot-local failure isolation. Include desktop, narrow smartphone landscape, and 400% zoom/reflow behavior.

## Standard report controls — assume these, do not reinvent them

Two behaviours are expected of every Pulse report that plots a time series.
Design them in, and depart from them only with a stated reason.

- **Represented period.** A `fieldset` offering preset windows *and* an explicit
  custom range: a start and an end control the reader can set independently,
  where changing either moves the selection to "custom". Presets alone are not
  enough.
- **Observation selection, shared across the report.** The reader picks one
  observation — a month, a quarter — and *every* figure at that time grain shows
  its values for the same one. Selection is made two ways, both required:
  a control in the report's own control row, and **clicking any point on any
  figure**. The label says so: "Observation quarter — or click any point on a
  figure".

Selection is report-owned state. A visual receives the selected index as a
display input, draws its own marker, and emits a selection event when a reader
clicks it; it never holds the selection, and never reaches for another visual.

**A figure at a different time grain follows the selection too**, resolved
through the coarser grain: a selected quarter is read at its last month in a
monthly panel, and a month picked there selects the quarter containing it. A
figure that opts out of the shared selection and always shows its own latest
value is the one figure on the page answering a different question from the
others, which reads as a bug. Where a series publishes nothing at the selected
observation, say so on the mark — "<series> — to <last published period>", computed from the rows — rather than
showing a value from a period the reader did not choose.

**The selected values go in one strip, in the same place on every figure,**
immediately above the plot and below the caption. `valueStrip` in
`site/visuals/report-shared.js` builds it: the selected period, then one
entry per series with its own colour swatch, label and value. A small
multiple gets one strip per panel, in that panel's own header.

The strip's position is fixed and identical everywhere, and that is the
point. A box placed beside the selected point moves as the reader scrubs,
flips from one side of the line to the other at the midpoint, and on a small
multiple covers the plot it annotates — so the reader hunts for the number
instead of reading it. A fixed strip costs a short, predictable glance. A
readout *below* the figure is the other failure: the reader travels past the
plot for every observation they try.

The strip is how a measurement reaches the reader without being written into
prose, and it usually removes the need for a second figure: a rate curve
whose strip carries both the rate and the headcount makes a second plot of
the headcount pure repetition.

`placeChips` in the same module places a label beside a mark. It is for a
label a mark carries permanently — a series name at the end of its line, a
peak, the year a series stops — never for the selected values.

Give a value the unit a reader would say out loud. A headcount published in
thousands reads as "2.68M", not "2,677 thousand"; scale the axis with it. Do
not pile every measure into one chip — a label with five numbers in a row is
unparseable, and a number that another figure already answers for is padding,
not information.

`site/visuals/report-shared.js` already implements the click-to-select seam
(`enablePicking` emits `pulse-select`), and the French consumer-prices report
wires it to a period fieldset and an observation slider. Read both before
designing the controls; match that vocabulary rather than inventing another.

## Copy states meaning, never measurements

A built Pulse report has no intelligence at run time. It renders rows from
published datasets and does nothing else: no text is regenerated, recomputed or
reviewed when the data refreshes. Every sentence you write is therefore either
durable or wrong at the next release.

- **Durable copy is definitional.** What a measure counts, what its denominator
  is, why two series must not share an axis, what an absence treatment means,
  where the data comes from, what a control does. It stays true when the data
  updates. Write as much of it as the reader needs.
- **A value, a direction, a magnitude, a ranking, a comparison or a period is
  not copy — it is an output.** "8.3% in Q2 2026", "up 0.2 of a point", "the
  highest since 2015", "another 1,825 thousand", "a fourfold spread": these
  belong in a figure, a stat tile, a direct label or the accessible table, all of
  which are rendered from the rows. Written into a sentence they become a
  hardcoded assertion that silently goes false on the next release, and no part
  of the running report can notice.
- **Do not write a standfirst, section introduction or caption that restates
  what the tiles and figures on the same screen already show.** It is redundant
  the day it ships and false a quarter later. The test is sharp: *prose carries
  only what no figure on the page can show.* A quirk visible in a direct label,
  a legend, an axis or a table row needs no sentence — a series ending early is
  already legible from its own label. A fact that spans figures, or that no mark
  can carry — this national reference is a different geography and quarter from
  the headline three sections up; these figures are harmonised rather than
  as-published — has nowhere else to live, so it stays.
- **Do not explain method to the reader.** Pulse reports are read by someone
  trained in the subject. Sentences of the form "these two rates have different
  denominators so do not compare them", "do not put these on one axis", "the
  bands partition the labour force" are condescending and add reading load for
  no information. Put the denominator in the indicator's own label where it is
  needed. Warnings about *this data* — a territory with no published value, a
  series that starts late, a member absent at one frequency — are the opposite,
  and belong on the page.
- **If a sentence genuinely must carry a live number, it is not copy — it is a
  derivation.** Declare it in the visual's contract with the columns it reads,
  so implementation computes it from the same rows that draw the figure.

Values shown *inside* a figure, tile, label, legend or table are exactly right —
they come from the data. This rule is about prose. Where an artboard needs an
illustrative value to be legible, mark it plainly as representative and keep it
out of any sentence that would ship.

## Binding constraints

- Use ordinary DOM and hand-authored SVG through Visual Contract v1; no chart or visualization library.
- **Put no dynamic text inside an SVG `<text>` element in the prototype.** The
  canvas runtime wraps every interpolated text node in a `<span>`, which an SVG
  `<text>` does not render, so every `{{hole}}` inside one is silently blank on
  the artboard while the surrounding static labels look right. Draw dynamic
  labels in an HTML layer positioned over the plot, which is what
  `overlayLabel` in `site/visuals/report-shared.js` does in production; static
  SVG text is fine.
- The report owns data access, parameter-bound SQL, row mapping, state, routing, and shared resources. Visuals only validate and draw supplied plain rows plus display/provenance inputs.
- Meet WCAG 2.2 AA: semantic structure, logical keyboard use, visible focus, sufficient contrast and targets, non-color-only cues, reduced motion, zoom/reflow, and accessible tables/text equivalents.
- Use existing semantic roles. Keep one-off palette, geometry, and layout local; flag any proposed shared role for separate human approval.
- The prototype runtime is review-only. Clearly identify design-only support files, remote assets, and representative data so none is ported into production.
- Specify exact copy, layout, styling, geometry, behavior, state, responsive, and accessibility requirements. These become binding after approval. Copy built from row values binds its template, not the value it renders today.

Package the result using the field structure in `assets/handoff-manifest.json`. Do not mark it approved; approval is a separate human action.
