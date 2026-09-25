# Staged workflow

## 1. Prerequisite gate

Resolve the requested questions to existing report-facing dataset IDs. For each dataset, require a verified `datasets/<id>/dataset-contract.yaml` and `publish/public/data/<id>/dataset.parquet`. Read both: inspect the Parquet schema, representative real rows, range, negatives, nulls, and precision rather than inferring them from a contract. Run the repository's offline verification before exporting design inputs. Missing acquisition is outside this workflow; route missing report-facing data to `pulse-add-dataset` (which may in turn route acquisition).

Record exact paths and SHA-256 digests. Reject identity/path collisions and unsupported Visual Contract majors. Do not inspect an unrelated report to choose its visual vocabulary.

## 2. Design on a canvas

Copy `assets/claude-design-prompt.md` into a work area and replace every `__...__` marker, naming the exact story, contracts, Parquet, neutral visual contract, visual language, token sheet, and shared styles. The brief is producer-shaped: it is the request you then design against, yourself, on a Design canvas (Artifact tool, `quickstart` with `intent: "design"`, then the Design type's instructions), producing a complete, reviewable report/visual design rather than advice for a coder. Build the canvas from real rows: generate a data script from the published Parquet, upload it as a canvas asset, and compute figures, strips and tables from it. Use Pulse's tokens and `site/visuals/report-shared.js` vocabulary; an organization-default design system does not apply.

The design must decide standing questions, narrative, indicators, units and precision, periods, at least three purpose-built visuals, fixture schemas and real rows, layout, controls and parameterized query needs, provenance, accessible equivalents, and every normal/degraded/error state. It must use plain DOM/SVG through Visual Contract v1, no chart library, report-owned data/state/routing, and WCAG 2.2 AA.

Do not stop at the brief or ask the human to run an external design tool: the design stage ends when the canvas is published. Composed reports need report-owned state across figures, so the composed report is one interactive artboard; states, narrow landscape, 400% zoom/reflow and decisions are artboards of their own.

The canvas runtime renders every `{{hole}}` as an HTML `<span>`, which draws nothing inside SVG. Never put a hole in an SVG `<text>` or `<title>`. Put every label that changes (tick values, units, series names, values) in an absolutely positioned HTML overlay above each plot. Position only the overlay's direct children (`.ov > span`), because the runtime wraps each hole in a span of its own that a descendant selector would also move. Align each label with an explicit box width and `text-align`.

Before publishing, render every artboard locally with the canvas's own runtime. Serve the Design type's `artifact-type/dc-runtime.js` as `support.js` beside the artboards, together with a local copy of the data script, and inspect every section in the browser, including after changing each control. Logic checks and contract checks do not show what the runtime draws.

## 3. Handoff intake

Place the canvas files and the rest of the handoff in a dedicated directory (`claude-design-output/<report-id>/`) and complete a copy of `assets/handoff-manifest.json`. Paths are relative to the handoff root and must remain inside it. Run:

```bash
uv run --no-sync python .agents/skills/pulse-add-visual/scripts/handoff_gate.py inspect \
  --root <handoff-directory> --manifest <handoff-manifest.json>
```

Intake requires a prototype, design decisions, rationale, at least three visual IDs and contracts, fixture data, all specified states, and desktop/narrow/zoom-reflow designs. It records local assets and separately identifies remote assets — the canvas URL among them — so implementation cannot port them accidentally. A complete intake is still unapproved.

## 4. Human approval

Show the complete prototype and decisions to the human. Ask for approval and exact permitted changes. Do not treat silence, an implementer's opinion, or green validation as approval. After explicit approval, run:

```bash
uv run --no-sync python .agents/skills/pulse-add-visual/scripts/handoff_gate.py approve \
  --root <handoff-directory> --manifest <handoff-manifest.json> \
  --approval <approval.json> --approved-by "<human identity>" \
  --permit "<narrow change>"
```

Omit `--permit` when no changes are allowed. The approval contains the canonical manifest digest, every declared file digest, and an approval-decision digest covering the approver, timestamp, and permitted changes. Record both digests in the implementation brief. Never edit an approved handoff or approval. `verify` must pass immediately before implementation/review; a mismatch pauses work for renewed approval.

## 5. Coding handoff and implementation

Fill `assets/implementation-brief.md`, link the complete locked handoff, and enumerate—not summarize away—each obligation. Implement one real-data figure first. Compare its pinned stored Parquet values, browser query output, and rendered strings in the numeric-boundary record before building the remaining figures; the browser spec derives its own expectations from the served data. Then expand without redesign.

The report owns dataset resolution, parameter-bound SQL, query/state/routing, row mapping, status, and shared-client lifecycle. Each visual owns local validation and drawing only. Fixture arrays stay in the authored contract/tests; production render paths receive validated query rows. Visual failures stay slot-local and preserve accessible equivalents and sibling content.

## 6. Registration and evidence

Follow `references/registration.md`, then run the numeric and fidelity gates in `references/verification.md`. Record actual evidence paths. Source searches and container counts can support review but cannot satisfy behavior or rendered-fidelity requirements.
