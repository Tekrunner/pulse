---
title: 'Story 2.4: Author and Register a Purpose-Built Visual'
type: 'feature'
created: '2026-09-12'
status: 'done'
baseline_commit: '3f638b74ee88c2a093f2cd72f3d1835da80c3bbc'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/epic-2-report-workflow-lessons.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The successful INSEE report used a deliberate two-agent pipeline, but Pulse has not encoded it for reuse. Claude Design first designed the complete report and visuals from real dataset contracts and Parquet; only after human approval did the coding agent preserve that design while wiring real queries. A template-only coding workflow would lose the design specialization and fidelity gate that made this work.

**Approach:** Add `pulse-add-visual` as a staged orchestration skill. It verifies prerequisites, prepares a producer-shaped Claude Design prompt with the story, contracts, real Parquet, neutral visual contract, and shared styles, then pauses for external design and human approval. It records the returned report/visual prototype as binding before handing mechanical data wiring and verification to a coding agent. Story 2.5 reuses this approved report-level handoff.

## Boundaries & Constraints

**Always:** Give Claude Design verified report-facing contracts and corresponding real Parquet. Ask it to decide standing questions, narrative, indicators, precision, periods, at least three purpose-built visuals, fixture schemas/rows, layout, controls/parameterized queries, provenance, accessible equivalents, and all states. Preserve its HTML/SVG/CSS/JS prototype, contracts, fixtures, rationale, and assets with a digest. Obtain human approval and record permitted changes. The coding handoff treats approved copy, layout, styling, geometry, and behavior as requirements; it substitutes validated query rows without redesigning. Prove numeric conversion and one real-data figure end to end before expanding, then compare matching desktop, narrow, state, and zoom/reflow views.

**Ask First:** Proceeding without Claude Design or human design approval; changing the approved design beyond recorded permissions; adding dependencies/shared roles; changing a contract major; or weakening accessibility, isolation, lineage, or shared-client ownership.

**Never:** Ask the coding agent to invent or simplify the design; treat prototype runtime as production code; port design-only support files, remote assets, or representative data; use chart libraries; let visuals own SQL, DuckDB, routes, storage, framework globals, or shared resources; declare completion from green tests without rendered comparison; implement Story 2.5's report workflow; alter Stories 2.2/2.3 or their `review` states.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Prepare design | Questions plus verified schema/values | Self-contained Claude Design prompt and fixture pack | Missing prerequisites route to `pulse-add-dataset` |
| External handoff | Claude Design output | Complete prototype, decisions, contracts, fixtures, digest | Pause if absent/incomplete; never improvise it |
| Approve/implement | Human-approved design | Coding handoff, fidelity checklist, permitted changes | Unapproved deviation returns to human/design |
| Real-data proof | Pinned rows and registered slot | Stored/query/display values agree; design is preserved | Numeric, behavior, or fidelity gaps remain open |

</frozen-after-approval>

## Code Map

- `claude-design-output/french-consumer-prices/README.md:1-327` and sibling design/contracts/fixtures -- complete Story 1.6 handoff shape; binding evidence, not a template to copy.
- `_bmad-output/planning-artifacts/epic-2-report-workflow-lessons.md:7-37` -- design-preservation, numeric-boundary, interaction/fidelity, and evidence gates.
- `datasets/*/dataset-contract.yaml`, `publish/public/data/*/dataset.parquet` -- inputs Claude Design reads directly after dataset verification.
- `site/visuals/line.contract.js`, `site/style.css`, `docs/visual-contract-v1.md` -- neutral contract/style inputs named by the proven prompt.
- `site/reports/french-consumer-prices/{report.yml,report.js}`, `site/visuals/*.js` -- implemented handoff evidence: registration, mapped queries, isolated rendering, local drawing.
- `tests/browser/pilot.spec.js:275-525`, `tests/node/report-contract.test.mjs` -- pinned numeric paths, interaction retention, responsive inspection support, and runtime boundaries.

## Tasks & Acceptance

**Execution:**
- [x] `.agents/skills/pulse-add-visual/` -- implement prerequisite, Claude Design prompt/export, external-output intake, human approval, coding handoff, registration, and evidence stages with agent metadata and focused references.
- [x] `.agents/skills/pulse-add-visual/assets/` -- add the proven prompt structure plus handoff manifest/digest, permitted-change record, implementation brief, numeric-boundary harness, and fidelity checklist templates.
- [x] `tests/` -- forward-test routing/pause gates, required prompt inputs, output completeness/digest, approval locking, no-library/runtime boundaries, numeric proof, registration, interaction retention, and rendered-comparison evidence.
- [x] Existing INSEE handoff, report, and tests -- validate the workflow read-only against the complete case; do not rewrite its visuals or call the workflow reusable unless the new gates accept its evidence.

**Acceptance Criteria:**
- Given a story plus verified contracts and Parquet, when `pulse-add-visual` reaches design, then it emits the proven producer-shaped Claude Design prompt and pauses until external output and human approval exist.
- Given approved Claude Design output, when implementation begins, then the complete handoff is binding, only recorded changes are allowed, and mock arrays are replaced by validated real query rows without changing presentation or interaction.
- Given the first real-data figure, when boundary verification runs, then pinned stored, browser-query, and displayed values agree for decimal scale, negatives, nulls, precision, and every distinct conversion path before remaining figures proceed.
- Given implementation completion, when review runs, then every design requirement maps to behavior evidence or recorded rendered inspection at matching viewports/states; unexplained differences and unchecked requirements keep work open.

## Spec Change Log

## Design Notes

Golden prompt structure: tell Claude Design this is a design/authoring session against real data before implementation; have it read the story, dataset contracts, Parquet, neutral visual contract, and styles; ask it to decide the narrative and visual/report surface listed above; require no chart library, DOM/SVG through Visual Contract v1, report-owned data/state/routing, and WCAG 2.2 AA. The skill may adapt paths and domain wording, but must preserve this division of labor.

## Verification

**Commands:**
- `python3 /home/yfontana/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/pulse-add-visual` -- expected: valid skill bundle.
- `npm run verify` -- expected: numeric, interaction, state, accessibility, and fidelity-supporting gates pass.
- `uv run --no-sync pulse verify` -- expected: full offline repository verification passes.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Staged design handoff**

- Start here: external design and human approval remain mandatory boundaries.
  [`SKILL.md:8`](../../.agents/skills/pulse-add-visual/SKILL.md#L8)

- Producer prompt gives Claude Design real data and full authorship responsibility.
  [`claude-design-prompt.md:3`](../../.agents/skills/pulse-add-visual/assets/claude-design-prompt.md#L3)

- Detailed stages preserve the prototype before mechanical implementation begins.
  [`workflow.md:17`](../../.agents/skills/pulse-add-visual/references/workflow.md#L17)

**Trust and completion gates**

- Intake validates complete, contained artifacts and matching per-visual contracts.
  [`handoff_gate.py:62`](../../.agents/skills/pulse-add-visual/scripts/handoff_gate.py#L62)

- Approval locks both design files and the human's permitted-change decision.
  [`handoff_gate.py:120`](../../.agents/skills/pulse-add-visual/scripts/handoff_gate.py#L120)

- Numeric evidence checks exact values across every declared conversion path.
  [`numeric-boundary-harness.mjs:6`](../../.agents/skills/pulse-add-visual/assets/numeric-boundary-harness.mjs#L6)

- Fidelity remains open until requirements, interactions, and rendered views have evidence.
  [`fidelity-checklist.md:6`](../../.agents/skills/pulse-add-visual/assets/fidelity-checklist.md#L6)

**Conformance evidence**

- Forward tests cover pauses, mutation rejection, real Parquet values, and INSEE evidence.
  [`visual-workflow.test.mjs:93`](../../tests/node/visual-workflow.test.mjs#L93)

- Cross-browser captures exercise desktop, narrow, zoom, and designed report states.
  [`visual-workflow.spec.js:3`](../../tests/browser/visual-workflow.spec.js#L3)

- Normal verification now includes the visual-workflow contract.
  [`package.json:20`](../../package.json#L20)
