# Report workflow gates

The coordinator advances only in this order:

1. `questions` — stable question IDs, indicators, context, reading behavior, privacy expectation, and exploration need are recorded.
2. `source-selection` — every candidate records authority, coverage, granularity, stability, access method, format, licence, attribution, cadence, publication schedule, redistribution constraints, selection rationale, and the no-default-provider decision.
3. `dependencies` — each required `pulse-add-source` and `pulse-add-dataset` output exists and its recorded digest matches.
4. `real-data` — representative rows and numeric-boundary cases come from verified published Parquet.
5. `design-handoff` — one complete Claude Design export covers the report and all visual sections, states, views, and interactions.
6. `design-approval` — a human locks the handoff digest and explicitly lists permitted changes.
7. `infrastructure` — report declaration, queries, visual schemas, annotations, state topology, route, and tests exist without presentation decisions.
8. `visual-implementation` — every visual records implementation, numeric, and fidelity evidence tied to its shared-handoff section.
9. `verification` — contract, repository, browser, accessibility, exact-value, responsive, and rendered-comparison checks pass.
10. `complete` — the status command finds no missing or digest-mismatched evidence.

## Resume and invalidation

Artifact paths are repository-relative and cannot escape the repository. Recompute each SHA-256 digest on resume. A missing or changed dependency, handoff, approval target, implementation, or evidence file reopens that gate and all later gates. The approval is a separate digest-validated JSON artifact naming the report, approved handoff digest, approver, time, and permitted changes. Never overwrite an approval to accommodate a changed handoff; obtain a new explicit approval. Record failures safely and leave the first incomplete gate visible.

## Design handoff

Provide questions, report and dataset contracts, actual representative rows including negative/null/precision cases, annotation content and provenance, interaction/state requirements, tokens, visual-language guidance, viewport targets, and accessible data-equivalent requirements. Require one coherent report and named sections for each visual. The implementation may replace representative values with verified real values only when approval permits it; all other copy, hierarchy, layout, geometry, styling, and behavior remain locked.

## Evidence

For each visual, compare the same pinned observations across stored Parquet, browser query output, mapped JavaScript values, and displayed text. Test distinct numeric conversion paths. Exercise interactions at left/middle/right observations and verify focus, viewport, partial input, selections, and open disclosures survive asynchronous refresh. Capture ready and failure states at desktop, narrow landscape, and 400% zoom/reflow and reconcile differences with the approved handoff.
