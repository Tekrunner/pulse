# Design fidelity evidence: french-consumer-prices

Approved handoff digest: `verified by temporary handoff approval lock in visual-workflow.test.mjs`  
Implementation revision: `repository test revision`

| Requirement | Approved reference | Implementation evidence | Result | Difference / permitted-change ID |
| --- | --- | --- | --- | --- |
| Narrative, headings, and copy | `claude-design-output/french-consumer-prices/README.md` | `pilot.spec.js: complete French consumer-price report renders four real-data figures` | Pass | None |
| Indicators, units, precision, and periods | README Data and Figures | `pilot.spec.js: exact pinned July 2026 decimals and negative values` | Pass | Representative data replacement was approved |
| Layout, hierarchy, and control placement | README Layout and Controls | `pilot.spec.js: desktop exploration controls keep period, observation and component controls together` | Pass | None |
| Every visual element, label, axis/lane/strip, and relationship | README Figures 1–4 | `pilot.spec.js` four real-data figures and exact chips/callouts | Pass | None |
| Selection and parameterized-query behavior | README Controls | `pilot.spec.js` left/middle/right selection and calculator tests | Pass | None |
| Keyboard, focus, partial-input, disclosure, and viewport retention | README Accessibility and Controls | `pilot.spec.js` all-controls and disclosure-retention tests | Pass | None |
| Provenance and accessible data equivalents | README Accessibility | `pilot.spec.js` provenance and accessible-equivalent tests | Pass | None |
| Ready/loading/empty/suspect/stale states | README States | `pilot.spec.js` report and qualification-state matrix | Pass | None |
| Query/schema/render failures and isolation | README States | `pilot.spec.js` query, schema, render, and mapped-empty tests | Pass | None |

## Matching rendered comparisons

| View/state | Approved capture | Implementation capture | Result | Explained difference |
| --- | --- | --- | --- | --- |
| Desktop ready | `design/Pulse CPI Report.dc.html`, desktop | `visual-workflow.spec.js` output `insee-desktop-ready.png` | Pass | None |
| Narrow smartphone landscape ready | approved prototype responsive layout | `visual-workflow.spec.js` output `insee-narrow-landscape-ready.png` and no-overflow assertion | Pass | None |
| 400% zoom/reflow | README Accessibility: DOM labels at 400% | `visual-workflow.spec.js` output `insee-400-percent-reflow.png` and no-overflow assertion | Pass | None |
| Loading and empty | approved prototype harness states | `visual-workflow.spec.js` outputs `insee-loading.png` and `insee-empty.png` | Pass | None |
| Suspect and stale | approved prototype state decisions | `visual-workflow.spec.js` outputs `insee-status-suspect.png` and `insee-status-stale.png` | Pass | None |
| Query error | approved prototype query-error state | `visual-workflow.spec.js` output `insee-query.png` | Pass | None |
| Schema incompatibility and sibling isolation | approved prototype schema-error state | `visual-workflow.spec.js` output `insee-schema.png` plus sibling assertions | Pass | None |
| Render error with accessible equivalent | approved prototype render-error state | `visual-workflow.spec.js` output `insee-render.png` plus retained-table assertion | Pass | None |
| Shared-engine failure | Not present in the historical Story 1.6 prototype; required by the current neutral contract | `design-foundation.spec.js` exercises `engine-error` with a named cue, provenance, and data equivalent | Pass | Historical predecessor gap is explicit; `pulse-add-visual` blocks this omission in future handoffs |

## Interaction matrix

- [x] Every plot selects known months near its left, middle, and right using the same margins/scaling as drawing.
- [x] Every control and asynchronous update retains viewport and keyboard focus.
- [x] Partially entered values, selected period/month/components, and open disclosures survive updates.
- [x] Narrow and zoomed controls remain operable and the indicator/provenance remain available.

Reviewer: Story 2.4 read-only conformance audit  
Reviewed at: repository verification  
Verdict: COMPLETE
