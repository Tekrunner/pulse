# Staged workflow

## 1. Prerequisite gate

Resolve the requested questions to existing report-facing dataset IDs. For each dataset, require a verified `datasets/<id>/dataset-contract.yaml` and `publish/public/data/<id>/dataset.parquet`. Read both: inspect the Parquet schema, representative real rows, range, negatives, nulls, and precision rather than inferring them from a contract. Run the repository's offline verification before exporting design inputs. Missing acquisition is outside this workflow; route missing report-facing data to `pulse-add-dataset` (which may in turn route acquisition).

Record exact paths and SHA-256 digests. Reject identity/path collisions and unsupported Visual Contract majors. Do not inspect an unrelated report to choose its visual vocabulary.

## 2. Claude Design export

Copy `assets/claude-design-prompt.md` into a work area and replace every `__...__` marker. Attach or make readable the exact story, contracts, Parquet, neutral visual contract, visual language, token sheet, and shared styles named in the prompt. The prompt is producer-shaped: Claude Design receives real constraints and data and returns a complete, reviewable report/visual design rather than advice for a coder.

The design must decide standing questions, narrative, indicators, units and precision, periods, at least three purpose-built visuals, fixture schemas and real rows, layout, controls and parameterized query needs, provenance, accessible equivalents, and every normal/degraded/error state. It must use plain DOM/SVG through Visual Contract v1, no chart library, report-owned data/state/routing, and WCAG 2.2 AA.

Stop after export. External Claude Design work is not simulated by the coding agent.

## 3. External-output intake

Place the returned handoff in a dedicated directory and complete a copy of `assets/handoff-manifest.json`. Paths are relative to the handoff root and must remain inside it. Run:

```bash
uv run --no-sync python .agents/skills/pulse-add-visual/scripts/handoff_gate.py inspect \
  --root <handoff-directory> --manifest <handoff-manifest.json>
```

Intake requires a prototype, design decisions, rationale, at least three visual IDs and contracts, fixture data, all specified states, and desktop/narrow/zoom-reflow designs. It records local assets and separately identifies remote assets so implementation cannot port them accidentally. A complete intake is still unapproved.

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

Fill `assets/implementation-brief.md`, link the complete locked handoff, and enumerate—not summarize away—each obligation. Implement one real-data figure first. Compare its pinned stored Parquet values, browser query output, and rendered strings before building the remaining figures. Then expand without redesign.

The report owns dataset resolution, parameter-bound SQL, query/state/routing, row mapping, status, and shared-client lifecycle. Each visual owns local validation and drawing only. Fixture arrays stay in the authored contract/tests; production render paths receive validated query rows. Visual failures stay slot-local and preserve accessible equivalents and sibling content.

## 6. Registration and evidence

Follow `references/registration.md`, then run the numeric and fidelity gates in `references/verification.md`. Record actual evidence paths. Source searches and container counts can support review but cannot satisfy behavior or rendered-fidelity requirements.
