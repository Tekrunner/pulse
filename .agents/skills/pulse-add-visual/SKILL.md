---
name: pulse-add-visual
description: Author and register purpose-built Pulse visuals through an external Claude Design handoff, human approval, fidelity-locked implementation, real-data numeric proof, and rendered comparison. Use for new report visuals; do not use to invent report design in code.
---

# Add a Pulse visual

Treat this as a staged design-to-implementation workflow. The design stage is external and the approval is human; pause rather than silently crossing either boundary.

1. Read [references/workflow.md](references/workflow.md). Verify the story, every report-facing dataset contract, and its corresponding published Parquet. If any contract or Parquet is absent or fails `pulse verify`, stop and route that prerequisite to `pulse-add-dataset`.
2. Prepare a self-contained Claude Design export from `assets/claude-design-prompt.md`. Supply the actual story, contracts, Parquet paths, `docs/visual-contract-v1.md`, `site/design/tokens.css`, `site/design/visual-language.md`, and relevant shared styles. Ask Claude Design to make the content and visual decisions; do not preselect chart types or simplify the request.
3. Pause. Do not author a substitute design. Intake the returned prototype, decisions, contracts, fixtures, rationale, and local assets with `assets/handoff-manifest.json`, then run `scripts/handoff_gate.py inspect`. Incomplete output remains at the design stage.
4. Pause for explicit human approval. Record the approver and narrowly permitted implementation changes with `scripts/handoff_gate.py approve`. The resulting digest makes the complete handoff binding. Any later digest mismatch or unrecorded design deviation returns to human/design review.
5. Produce the coding handoff from `assets/implementation-brief.md`. The coding agent preserves approved copy, layout, styling, geometry, behavior, and states while replacing fixture rows with validated query rows. It must not port prototype runtime, representative data, design-only support files, or remote assets.
6. Implement and register using [references/registration.md](references/registration.md). Prove one figure end to end before expanding. Use `assets/numeric-boundary-harness.mjs` with actual pinned stored, browser-query, and displayed observations for every distinct conversion path.
7. Review with `assets/fidelity-checklist.md` and [references/verification.md](references/verification.md). Every requirement needs behavior evidence or a recorded rendered inspection at matching desktop, narrow, state, and zoom/reflow views. Unexplained differences or unchecked items keep the work open.

Ask before proceeding without Claude Design or human approval, changing approved presentation or behavior beyond the permitted-change record, adding dependencies or shared design roles, changing a contract major, or weakening accessibility, isolation, lineage, or shared-client ownership.

Never ask the coding agent to design or simplify the visual. Visuals receive only validated plain rows plus display and provenance inputs and return ordinary DOM/SVG. They own no SQL, DuckDB, Parquet/storage paths, routes, framework globals, or shared resources; use no chart library.
