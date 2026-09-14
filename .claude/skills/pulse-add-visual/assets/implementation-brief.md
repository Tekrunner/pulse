# Fidelity-locked implementation brief: __REPORT_ID__

## Locked design

- Handoff root: `__HANDOFF_ROOT__`
- Manifest: `__MANIFEST_PATH__`
- Approval: `__APPROVAL_PATH__`
- Locked handoff digest: `__DIGEST__`
- Locked approval decision digest: `__APPROVAL_DIGEST__`
- Permitted changes: `__PERMITTED_CHANGES_PATH__`

Run `handoff_gate.py verify` immediately before work. The full prototype, decisions, contracts, fixtures, rationale, and assets are binding; this brief does not replace them.

## Preserve exactly

- Copy and narrative: __REQUIREMENTS_OR_LINKS__
- Layout and responsive behavior: __REQUIREMENTS_OR_LINKS__
- Styling and visual geometry: __REQUIREMENTS_OR_LINKS__
- Controls and interactions: __REQUIREMENTS_OR_LINKS__
- States and failure isolation: __REQUIREMENTS_OR_LINKS__
- Accessibility and equivalents: __REQUIREMENTS_OR_LINKS__

## Mechanical data wiring

- Owning report and route: __REPORT_PATH_AND_ROUTE__
- Dataset IDs and contract versions: __DATASETS__
- Parameter-bound queries: __QUERIES__
- Query-to-consumer row mappings: __MAPPINGS__
- Display and provenance inputs: __INPUTS__
- Declared conversion paths: __CONVERSION_PATHS__

First implement only `__FIRST_VISUAL_ID__`. Prove pinned stored Parquet values, browser-query values, and displayed strings—including decimal scale, negatives, nulls, and precision—for every conversion path it exercises. Do not expand until that proof passes.

## Production exclusions

Do not port prototype runtime, design-only support files, remote assets, representative rows, or reconstruction/disclaimer copy tied to representative rows. Do not add a chart library. Keep SQL, DuckDB, Parquet/storage paths, route/state ownership, framework globals, data fetching, and shared resource lifecycle out of visual modules.

## Registration and evidence

- Visual files/contracts: __PATHS__
- Report declaration and lineage changes: __PATHS__
- Numeric evidence: __PATH__
- Behavior tests: __PATHS__
- Rendered comparison checklist: __PATH__

Completion requires the locked-handoff check, numeric proof, behavior tests, and completed rendered comparison. Unchecked requirements remain open.
