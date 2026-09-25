# Design fidelity evidence: french-gdp

Approved handoff digest: `658cf8a0a38649ea12b03f5db5b8d97a8db5be21f77a970eaacceecc6af79daa`  
Implementation revision: working tree on `dd29a63`, uncommitted

Every row needs a passing behaviour assertion or a recorded rendered inspection. The per-figure differences are listed in each `<visual>.fidelity.json`. Each difference names the approval item that covers it: P1 and P2 from the approval record, R1 and R2 requested by the approver, A1 accepted by the approver on 2026-09-25.

| Requirement | Approved reference | Implementation evidence | Result | Difference / permitted-change ID |
| --- | --- | --- | --- | --- |
| Narrative, headings, and copy | design/Main.dc.html (with the approver's edits) | view-desktop.png; section copy in site/reports/french-gdp/report.js | Pass | Projection note year read from data; prototype footer line removed (A1, accepted) |
| Indicators, units, precision, and periods | design/Main.dc.html, Decisions.dc.html | *.numeric.json (8 files, harness verified); tests/browser/french-gdp.spec.js | Pass | P1 |
| Layout, hierarchy, and control placement | design/Main.dc.html, Narrow.dc.html, Zoom.dc.html | view-desktop.png, view-narrow-smartphone-landscape.png, view-zoom-400.png | Pass | Responsive widths; OECD chip wraps below about 1335 px (A1, accepted) |
| Every visual element, label, axis/lane/strip, and relationship | design/Main.dc.html sections 1–8 | section captures inspected at 1280 px; view-desktop.png | Pass | Added data tables for income, dollars and OECD (A1, accepted) |
| Selection and parameterized-query behavior | Decisions.dc.html, Selection beyond a section's edge | spec: left/middle/right click selection; map nearest-year banner; comparators; branch drill | Pass | |
| Keyboard, focus, partial-input, disclosure, and viewport retention | States.dc.html, Focus and targets | spec: focus, scroll and open disclosures survive an update; comparator select keeps focus | Pass | |
| Provenance and accessible data equivalents | design/Main.dc.html source lines and tables | spec: every figure carries a data table, provenance and labelled SVGs | Pass | Map source line per P2 |
| Ready/loading/empty/suspect/stale states | States.dc.html | view-state-loading.png, view-state-empty.png, view-state-suspect.png, view-state-stale.png; spec | Pass | Qualification cue placement (A1, accepted) |
| Query/schema/render/shared-engine failures and isolation | States.dc.html, Slot-local failure isolation | view-slot-local-failure.png, view-state-query-error.png, view-state-schema-error.png, view-state-render-error.png, view-state-shared-engine-failure.png; spec | Pass | |

## Matching rendered comparisons

| View/state | Approved capture | Implementation capture | Result | Explained difference |
| --- | --- | --- | --- | --- |
| Desktop ready | design/Main.dc.html | view-desktop.png | Pass | See per-figure records |
| Narrow smartphone landscape ready | design/Narrow.dc.html | view-narrow-smartphone-landscape.png | Pass | Control row folds into its disclosure, as drawn |
| 400% zoom/reflow | design/Zoom.dc.html | view-zoom-400.png | Pass | One column, no horizontal page scroll |
| Loading and empty | design/States.dc.html | view-state-loading.png, view-state-empty.png | Pass | |
| Suspect and stale | design/States.dc.html | view-state-suspect.png, view-state-stale.png | Pass | Cue above the affected figure |
| Query error | design/States.dc.html | view-state-query-error.png | Pass | |
| Schema incompatibility and sibling isolation | design/States.dc.html | view-state-schema-error.png, view-slot-local-failure.png | Pass | |
| Render error with accessible equivalent | design/States.dc.html | view-state-render-error.png | Pass | |
| Shared-engine failure | design/States.dc.html | view-state-shared-engine-failure.png | Pass | |

## Interaction matrix

- [x] Every plot selects years near its left, middle, and right using the same margins/scaling as drawing, with the expected periods read from the served range. Exercised on the contributions plot; every year axis uses the same shared year bands (`yearHits`), which carry their own year.
- [x] Browser evidence derives displayed values from the served Parquet; no spec names a release's latest value, period or stopping point.
- [x] Every control and asynchronous update retains viewport and keyboard focus.
- [x] Partially entered values, selected period/year/comparators, and open disclosures survive updates.
- [x] Narrow and zoomed controls remain operable and the indicator/provenance remain available.
- [x] Each captured view records its measured horizontal page overflow, and it is zero.
- [x] Slot-local isolation is shown by a scenario failing exactly one slot: that slot errors with a retry, every sibling stays ready, and the report does not enter an error state.

Reviewer: Claude (implementer); differences accepted by yann.fontana@hardis-group.com  
Reviewed at: 2026-09-25  
Verdict: COMPLETE
