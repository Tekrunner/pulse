# Epic 2: Requirements for a reusable report implementation workflow

Recorded: 2026-09-08. Input to Stories 2.1 (design foundation), 2.4 (visual authoring), and 2.5 (report authoring).

Story 1.6 exposed a gap between passing technical checks and delivering an approved report. Apply the following requirements when designing Epic 2's reusable workflow. This note records future workflow requirements; it does not certify or close Story 1.6.

## Preserve the approved design

- Treat approved copy, layout, styling, chart geometry, and interactions as implementation requirements. Adapting a prototype's runtime must preserve its presentation and behavior.
- Record permitted changes explicitly. For Story 1.6, replacing representative services/manufactured data and removing the associated disclaimers did not authorize rewriting other copy or simplifying figures.
- Keep the complete design handoff available to implementers and reviewers. A short spec must reference it as binding and include a fidelity checklist; compression must not remove acceptance obligations.

## Prove the data boundary before building every figure

- Complete one real-data figure end to end before expanding the report. Compare stored dataset values, browser query results, and displayed values for the same observations.
- Define and test numeric conversion at the DuckDB/Arrow-to-JavaScript boundary, including decimal scale, negative values, nulls, and display precision. Finite-number validation alone is insufficient.
- Use exact expected values from a pinned dataset in browser tests. Cover each distinct numeric conversion path, including component data rather than only headline data. Do not introduce arbitrary universal CPI bounds.

## Verify behavior and fidelity

- Test chart selection at known months near the left, middle, and right of each plot. Hit testing must use the same margins, SVG scaling, and panel coordinates as drawing.
- Preserve viewport position, keyboard focus, partially entered values, and open disclosures across every control and asynchronous query update. Test the whole interaction matrix; a month-click fix alone does not cover component, period, or calculator changes.
- Verify required visual elements and relationships: axes and labels, separate contribution lanes, basket-weight strips, readable value chips, and control layout.
- Exercise calculator results, period changes, selection retention, and all report/slot states on the actual report route. Legacy pilot tests do not establish coverage for a new report.
- Compare rendered output with the approved design at matching viewport sizes and states. Include desktop, narrow layout, and zoom/reflow; record and resolve unexplained differences.
- Use behavior assertions and rendered inspection as completion evidence. Source-text searches and counts of figure containers are supporting checks only.

## Gate implementation completion on evidence

- Map each design requirement and acceptance criterion to a passing behavior test or a recorded rendered inspection.
- Require both numeric correctness evidence and design-fidelity evidence before declaring implementation complete or advancing it to the review checkpoint.
- Keep the coordinating agent accountable for validating delegated work. An implementer's completion report and a green test suite do not replace this check.
- Report what was actually verified and what remains unchecked. Leave tasks open when evidence is missing; never equate “tests passed” with “approved design reproduced.”

## Epic 2 deliverable

Encode these requirements in the report-authoring workflow and its handoff/review templates, with a reusable numeric-boundary test harness and a design-comparison checklist. Validate the workflow against an implemented report before treating it as reusable.
