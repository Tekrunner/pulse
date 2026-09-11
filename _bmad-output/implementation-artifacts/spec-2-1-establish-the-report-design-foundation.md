---
title: 'Story 2.1: Establish the Report Design Foundation'
type: 'feature'
created: '2026-09-11'
status: 'done'
baseline_commit: 'cf34ccf10b060553ce5a53546c393d3f49cf07f7'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pulse's reusable presentation values and visual conventions are mixed with report-specific code, so an agent cannot author a coherent visual without studying or copying the CPI implementation.

**Approach:** Add canonical semantic tokens, concise visual-language guidance, and a source-neutral template with an independent reference harness. Migrate only shared theme roles, preserving existing appearance and local design choices.

## Boundaries & Constraints

**Always:** Keep `site/design/tokens.css` canonical for dark-default color, local typography, spacing, state, focus, and motion roles. Shared visual code consumes semantic roles; series and one-off choices remain local. The template accepts declared-schema fixture rows plus display/provenance inputs, returns accessible responsive DOM/SVG, communicates states without color alone, and provides focused cleanup. Test every shared-role consumer when roles change.

**Ask First:** Adding a dependency; changing an existing report's intended appearance or interaction; publishing a new shared role that is not demonstrably useful across existing consumers; changing the v1 visual contract.

**Never:** Add chart types/libraries, a component catalog, fixed layouts/content/designs, remote fonts, SQL, storage paths, framework protocols, or existing-visual imports to the template. Do not copy the prototype design system or rewrite unrelated visuals for uniformity.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Normal / interactive | Valid rows, display, provenance | Indicator, provenance, keyboard interaction, responsive output, and data table | Invalid interaction preserves the last valid view |
| Loading / empty | Pending rows or valid empty rows | Named, non-color-only loading or empty state with stable layout | No misleading marks or fabricated values |
| Suspect / stale | Valid rows with affected provenance | Usable data plus a named, non-color-only warning | Preserve indicator, provenance, and table |
| Error | Query, schema, render, or engine failure | Distinct named error scoped to the visual | No page crash; cleanup stays idempotent |
| Constrained viewport | Desktop, zoom, or narrow landscape | Readable, operable content and visible focus | Essential content remains available |

</frozen-after-approval>

## Code Map

- `site/style.css:1-50` -- duplicate global roles/focus/motion; import tokens here and keep report selectors at `:52+` local.
- `site/visuals/report-shared.js:1-14,88-251` -- responsive primitives plus shared theme literals; preserve local series colors.
- `site/reports/french-consumer-prices/report.js:237-307,435-570,685-730` -- read-only evidence for isolated states, keyboard use, tables, and input handoff.
- `site/visuals/line.contract.js:3-23` -- fixture/contract precedent only; its chart vocabulary is not neutral.
- `docs/visual-contract-v1.md` -- existing renderer boundary; link rather than duplicate guidance.
- `scripts/public-site-sources.mjs:35-76` -- public source closure and publication seam.
- `tests/node/public-site-sources.test.mjs`, `tests/browser/pilot.spec.js` -- reusable staging and browser assertion patterns.
- `claude-design-output/french-consumer-prices/` -- read-only design evidence, never a dependency.

## Tasks & Acceptance

**Execution:**
- [x] `site/design/tokens.css`, `site/style.css`, `site/visuals/report-shared.js` -- centralized and consumed shared roles without restyling CPI.
- [x] `site/design/visual-language.md`, `docs/visual-contract-v1.md` -- documented current rules, non-scope, shared-role review, and canonical paths.
- [x] `site/workflows/add-visual/template/` -- added an independent renderer, schema fixture, inputs, styles, states, responsive accessible output, and cleanup.
- [x] `site/design/reference.md` -- independently renders canonical roles and every required state.
- [x] `scripts/public-site-sources.mjs`, `tests/node/public-site-sources.test.mjs` -- publish exact design/template inputs without exemplar dependencies.
- [x] `tests/node/design-foundation.test.mjs`, `package.json` -- enforce ownership, independence, forbidden content, and normal/public verification.
- [x] `tests/browser/design-foundation.spec.js` -- tests state cues, contrast, keyboard/focus, motion, viewports, provenance, table, and cleanup in both browsers.

**Acceptance Criteria:**
- Given an agent reads the documented inputs, when it prepares a visual, then tokens, current conventions, template, and explicit exclusions suffice without an existing visual.
- Given shared roles change, when conformance runs, then every consumer is tested, local design remains local, and unrelated appearance/behavior stays stable.
- Given all required states, when the harness renders, then WCAG 2.2 AA contrast/focus, non-color cues, accessible data, provenance, and reduced motion hold.
- Given desktop, zoomed, and narrow-landscape viewports, when the template runs, then it remains operable with indicator, provenance, focus, and data equivalent.
- Given normal and public verification, when canonical inputs are validated, then their documented paths work without loading an existing report or visual.

## Spec Change Log

## Design Notes

Use `site/workflows/add-visual/template/` for the application-owned scaffold and `site/design/reference.md` for executable evidence. Tokens may alias current values: canonical ownership does not require redesign.

## Verification

**Commands:**
- `node tests/node/design-foundation.test.mjs` -- expected: ownership and independence pass.
- `npm run build && npm run browser:test -- --grep "design foundation" --reporter=list` -- expected: both browsers pass.
- `npm run verify` -- expected: full suite passes.
- `uv run --no-sync pulse public build --output dist && npm run public:verify` -- expected: public artifact validates canonical inputs.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Foundation contract**

- Canonical semantic roles now own typography, focus, and motion baselines.
  [`tokens.css:3`](../../site/design/tokens.css#L3)

- Neutral renderer accepts only declared rows, display, provenance, and state.
  [`visual.js:35`](../../site/workflows/add-visual/template/visual.js#L35)

- Executable reference imports the template without relying on an existing visual.
  [`reference.md:5`](../../site/design/reference.md#L5)

**Publication boundary**

- Public staging explicitly publishes guidance and only the canonical template root.
  [`public-site-sources.mjs:35`](../../scripts/public-site-sources.mjs#L35)

- The visual contract directs authors to current tokens, guidance, and scaffold.
  [`visual-contract-v1.md:18`](../../docs/visual-contract-v1.md#L18)

**Conformance evidence**

- Browser coverage exercises states, accessibility, motion, interaction, and responsive behavior.
  [`design-foundation.spec.js:7`](../../tests/browser/design-foundation.spec.js#L7)

- Node coverage guards ownership, neutral dependencies, and canonical reference wiring.
  [`design-foundation.test.mjs:16`](../../tests/node/design-foundation.test.mjs#L16)
