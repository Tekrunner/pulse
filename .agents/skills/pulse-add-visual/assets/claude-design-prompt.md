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

## Binding constraints

- Use ordinary DOM and hand-authored SVG through Visual Contract v1; no chart or visualization library.
- The report owns data access, parameter-bound SQL, row mapping, state, routing, and shared resources. Visuals only validate and draw supplied plain rows plus display/provenance inputs.
- Meet WCAG 2.2 AA: semantic structure, logical keyboard use, visible focus, sufficient contrast and targets, non-color-only cues, reduced motion, zoom/reflow, and accessible tables/text equivalents.
- Use existing semantic roles. Keep one-off palette, geometry, and layout local; flag any proposed shared role for separate human approval.
- The prototype runtime is review-only. Clearly identify design-only support files, remote assets, and representative data so none is ported into production.
- Specify exact copy, layout, styling, geometry, behavior, state, responsive, and accessibility requirements. These become binding after approval.

Package the result using the field structure in `assets/handoff-manifest.json`. Do not mark it approved; approval is a separate human action.
