---
title: 'Story 2.5: Build a Report from Questions, Sources, Visuals, and Annotations'
type: 'feature'
created: '2026-09-13'
status: 'done'
baseline_commit: '0009f38e26d96fc89326adbca42d8c2e5ee737ae'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/epic-2-report-workflow-lessons.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pulse has one hand-built report but no reusable workflow for turning questions into verified data, approved design, declarative queries, accessible states, and data-owned annotations. Its report contract also skips private declarations before validation and cannot express those responsibilities.

**Approach:** Add a resumable `pulse-add-report` coordinator invoked once by the user. It plans from questions and real data, invokes Story 2.2–2.4 skills as gated sub-workflows, records their outputs, and gives Claude Design responsibility for the complete report and every visual in one coherent handoff. After human approval, create design-free contract, data-wiring, state, accessibility, and test files, then implement the locked handoff faithfully.

## Boundaries & Constraints

**Always:** Keep `pulse-add-report` responsible for sequencing/resume and persist every gate in a work record; reuse stable dataset/column IDs; keep one source per dataset; compare sources without a default provider; invoke `pulse-add-source` for missing snapshots and `pulse-add-dataset` for missing report-facing contracts; resume only from verified outputs; let Claude Design author the report and every visual; apply `pulse-add-visual` implementation/evidence gates to every visual from the shared handoff; join annotations before visual mapping; resolve privacy transitively and unknown lineage fail-closed; leave Stories 2.2–2.4 in review.

**Ask First:** Unresolved rights, cross-dataset shared state, shared-contract changes, new dependencies, approved-design deviations, or existing-report migrations.

**Never:** Put layout, styling, visual hierarchy, chart choices, or presentation decisions in templates; copy an existing report; duplicate data semantics; hardcode annotation coordinates; let code redesign approved output; let visuals own SQL, storage, routing, or engine lifecycle; add a chart library; hand-edit catalogs; weaken isolation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Missing dependency | Missing snapshot or report-facing contract | Coordinator invokes `pulse-add-source` or `pulse-add-dataset`, records verified output, and resumes | Remain paused with the missing/invalid contract named |
| Annotation join | Versioned rows with IDs, anchors, provenance, and dependencies | Parameterized query joins data before visual mapping; renderer stays unchanged | Reject invalid identity, anchor, dependency, or join |
| Private/unknown lineage | Private or unresolved dependency | Resolve private or fail closed; exclude from public artifacts | Reject visibility weakening |
| Runtime failure | Any declared report/slot state | Accessible state; local failure preserves siblings and interaction context | Offer safe retry where applicable |

</frozen-after-approval>

## Code Map

- `.agents/skills/pulse-add-{source,dataset,visual}/` -- binding dependency routes; do not duplicate them.
- `runtime/pulse/catalog.py:53,247` -- report discovery/compiler seam; validate before public filtering and resolve inherited visibility, annotations, and change metadata.
- `runtime/pulse/datasets.py:288` -- consumer inventory must discover query, schema, lineage, and annotation dependencies.
- `site/data/client.js:47`, `site/data/status-client.js:121` -- parameterized queries and lineage-qualified states.
- `scripts/build-site.mjs:67`, `scripts/public-site-sources.mjs:35` -- public static packaging seam.
- `site/reports/french-consumer-prices/` and `claude-design-output/french-consumer-prices/` -- read-only evidence, never template input.
- `tests/runtime/test_catalog.py:108`, `tests/browser/pilot.spec.js:157` -- contract, state, and interaction patterns.

## Tasks & Acceptance

**Execution:**
- [x] `.agents/skills/pulse-add-report/` -- implement single-entry orchestration, discovery, source selection, dependency invocation/resume, shared design approval, infrastructure generation, registration, and evidence stages.
- [x] `.agents/skills/pulse-add-report/assets/report-workflow.json` -- define durable phase, dependency, artifact-path/digest, approval, per-visual gate, verification, and safe-resume state without embedding report design.
- [x] `runtime/pulse/reports.py` and `runtime/pulse/catalog.py` -- add typed discovery/validation, questions, queries, schemas, annotations, state topology, inherited visibility, and declared change metadata while preserving the existing report.
- [x] `site/workflows/add-report/template/{report.yml,report.js,annotations.json,state.js,test.js}` -- provide design-free contract, query, annotation, state/accessibility, registration, and synthetic-test infrastructure.
- [x] `site/data/report-runtime.js`, `scripts/build-site.mjs`, and `scripts/public-site-sources.mjs` -- join annotations before rendering, isolate failures, and package only reachable public assets.
- [x] `tests/runtime/test_reports.py`, `tests/node/report-workflow.test.mjs`, `tests/browser/report-workflow.spec.js`, and `package.json` -- cover orchestration, contracts/privacy/annotations, static navigation/isolation, numeric/fidelity evidence, WCAG states, interaction retention, responsive rendering, and regressions.

**Acceptance Criteria:**
- Given a report starting with no data, when `pulse-add-report` runs or resumes, then the coordinator records source decisions, invokes each required source/dataset sub-workflow, verifies its output, and advances without requiring the user to sequence skills manually.
- Given an approved real-data handoff, when implemented, then report and visuals preserve it, every visual has a question/schema, annotations remain joined versioned data, and catalogs register the route.
- Given privacy, lineage, or runtime failures, when conformance runs, then visibility fails closed, accessible states are distinct, affected slots are qualified, and siblings remain usable.
- Given the design-free fixture and CPI evidence, when verification runs, then both conform without copying and Stories 2.2–2.4 remain in review.

## Spec Change Log

## Design Notes

Workflow order: questions → source evaluation → `pulse-add-source` as needed → `pulse-add-dataset` as needed → verified real data → one report-level Claude Design handoff → digest-locked human approval → implementation and per-visual `pulse-add-visual` gates → report verification. Control always returns to `pulse-add-report`, whose work record resumes at the first incomplete gate.

Claude Design owns overall composition and every visual using complete questions, contracts, and real rows. Its shared handoff contains the report layout and identifiable visual sections/contracts. `pulse-add-visual` consumes those sections for implementation and evidence without new design sessions. Templates cannot constrain presentation. Map `schema-incompatibility` and `shared-engine-failure` to established `schema-error` and `engine-error` states.

## Verification

**Commands:**
- `python3 /home/yfontana/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/pulse-add-report` -- expected: valid skill bundle.
- `uv run pytest tests/runtime/test_catalog.py -q` -- expected: report declarations, visibility, annotations, collisions, and legacy compatibility pass.
- `npm run verify` -- expected: build, isolation, browser behavior, accessibility, and rendered conformance pass.
- `uv run pulse verify` -- expected: full offline repository verification passes.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Coordinator and approval gates**

- Start with the single-entry workflow and its explicit dependency/design boundaries.
  [`SKILL.md:6`](../../.agents/skills/pulse-add-report/SKILL.md#L6)

- Inspect the persisted discovery, dependency, approval, and evidence contract.
  [`report-workflow.json:7`](../../.agents/skills/pulse-add-report/assets/report-workflow.json#L7)

- Verify missing artifacts reopen the first incomplete workflow gate safely.
  [`workflow.py:257`](../../.agents/skills/pulse-add-report/scripts/workflow.py#L257)

- Review the shared Claude handoff and fidelity evidence requirements.
  [`workflow.md:20`](../../.agents/skills/pulse-add-report/references/workflow.md#L20)

**Report contracts and privacy**

- Typed loading enforces queries, schemas, optional annotations, states, and change metadata.
  [`reports.py:221`](../../runtime/pulse/reports.py#L221)

- Visibility resolves every dataset and annotation dependency before public filtering.
  [`reports.py:300`](../../runtime/pulse/reports.py#L300)

- Public closure and catalog compilation now share fully validated declarations.
  [`catalog.py:52`](../../runtime/pulse/catalog.py#L52)

**Design-free runtime and packaging**

- Annotation data joins analytical rows before any visual mapping occurs.
  [`report-runtime.js:55`](../../site/data/report-runtime.js#L55)

- Slot execution isolates failures while preserving design ownership and safe retry.
  [`report-runtime.js:128`](../../site/data/report-runtime.js#L128)

- The synthetic declaration demonstrates infrastructure without prescribing presentation.
  [`report.yml:1`](../../site/workflows/add-report/template/report.yml#L1)

- Static staging includes only annotations reachable from resolved-public reports.
  [`public-site-sources.mjs:35`](../../scripts/public-site-sources.mjs#L35)

**Conformance evidence**

- Runtime tests prove optional annotations, fail-closed lineage, and neutral catalog compilation.
  [`test_reports.py:40`](../../tests/runtime/test_reports.py#L40)

- Workflow tests exercise missing dependencies, digest invalidation, and gate-bound evidence.
  [`report-workflow.test.mjs:146`](../../tests/node/report-workflow.test.mjs#L146)

- Browser tests cover isolation, retained interaction, narrow layout, zoom, and states.
  [`report-workflow.spec.js:26`](../../tests/browser/report-workflow.spec.js#L26)
