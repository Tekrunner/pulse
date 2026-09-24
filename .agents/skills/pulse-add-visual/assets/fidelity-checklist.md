# Design fidelity evidence: __REPORT_ID__

Approved handoff digest: `__DIGEST__`  
Implementation revision: `__REVISION__`

Every row needs a passing behavior assertion or a recorded rendered inspection. `Pending`, an empty evidence cell, an unexplained difference, or a difference outside the permitted-change record keeps implementation open.

| Requirement | Approved reference | Implementation evidence | Result | Difference / permitted-change ID |
| --- | --- | --- | --- | --- |
| Narrative, headings, and copy | __REFERENCE__ | __EVIDENCE__ | Pending | |
| Indicators, units, precision, and periods | __REFERENCE__ | __EVIDENCE__ | Pending | |
| Layout, hierarchy, and control placement | __REFERENCE__ | __EVIDENCE__ | Pending | |
| Every visual element, label, axis/lane/strip, and relationship | __REFERENCE__ | __EVIDENCE__ | Pending | |
| Selection and parameterized-query behavior | __REFERENCE__ | __EVIDENCE__ | Pending | |
| Keyboard, focus, partial-input, disclosure, and viewport retention | __REFERENCE__ | __EVIDENCE__ | Pending | |
| Provenance and accessible data equivalents | __REFERENCE__ | __EVIDENCE__ | Pending | |
| Ready/loading/empty/suspect/stale states | __REFERENCE__ | __EVIDENCE__ | Pending | |
| Query/schema/render/shared-engine failures and isolation | __REFERENCE__ | __EVIDENCE__ | Pending | |

## Matching rendered comparisons

| View/state | Approved capture | Implementation capture | Result | Explained difference |
| --- | --- | --- | --- | --- |
| Desktop ready | __PATH__ | __PATH__ | Pending | |
| Narrow smartphone landscape ready | __PATH__ | __PATH__ | Pending | |
| 400% zoom/reflow | __PATH__ | __PATH__ | Pending | |
| Loading and empty | __PATH__ | __PATH__ | Pending | |
| Suspect and stale | __PATH__ | __PATH__ | Pending | |
| Query error | __PATH__ | __PATH__ | Pending | |
| Schema incompatibility and sibling isolation | __PATH__ | __PATH__ | Pending | |
| Render error with accessible equivalent | __PATH__ | __PATH__ | Pending | |
| Shared-engine failure | __PATH__ | __PATH__ | Pending | |

## Interaction matrix

- [ ] Every plot selects months near its left, middle, and right using the same margins/scaling as drawing, with the expected periods read from the served range.
- [ ] Browser evidence derives displayed values from the served Parquet; no spec names a release's latest value, period or stopping point.
- [ ] Every control and asynchronous update retains viewport and keyboard focus.
- [ ] Partially entered values, selected period/month/components, and open disclosures survive updates.
- [ ] Narrow and zoomed controls remain operable and the indicator/provenance remain available.
- [ ] Each captured view records its measured horizontal page overflow, and it is zero.
- [ ] Slot-local isolation is shown by a scenario failing exactly one slot: that slot errors with a retry, every sibling stays ready, and the report does not enter an error state.

Reviewer: __HUMAN_OR_REVIEWER__  
Reviewed at: __UTC_TIMESTAMP__  
Verdict: OPEN until every item above passes and every difference is explained and permitted.
