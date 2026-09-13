# Completion gates

Before expanding beyond the first implemented figure, populate a copy of `assets/numeric-boundary-evidence.json` from actual pinned observations and run:

```bash
node .agents/skills/pulse-add-visual/assets/numeric-boundary-harness.mjs <numeric-evidence.json>
```

Declare every distinct DuckDB/Arrow-to-JavaScript conversion path. Cover decimal scale, a negative value, null handling, and display precision. The harness checks the evidence structure and exact expected values; the browser test that produces the evidence must query the real pinned dataset and assert the displayed text. Do not substitute arbitrary universal value bounds.

Before completion:

1. Run `handoff_gate.py verify` against the approval record.
2. Exercise selection near the left, middle, and right of every plot using its actual margins and SVG scaling.
3. Exercise every report control and asynchronous update, preserving viewport, keyboard focus, partial input, selected period, and open disclosures.
4. Exercise ready, loading, empty, suspect, stale, query error, schema incompatibility, render error, and shared-engine failure on the actual route. Verify slot-local isolation and accessible equivalents.
5. Complete `assets/fidelity-checklist.md` with behavior assertions or rendered evidence. Compare approved and implemented output at matching desktop, narrow smartphone landscape, designed states, and 400% zoom/reflow. Explain and approve every difference.
6. Verify no chart-library dependency and no visual-owned SQL, DuckDB, routes, storage, framework globals, fetching, or shared resource lifecycle.
7. Run:

```bash
python3 .agents/skills/pulse-add-visual/scripts/fidelity_gate.py <completed-fidelity-checklist.md>
python3 /home/yfontana/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/pulse-add-visual
uv run --no-sync pulse verify
git diff --check
```

Map every design requirement and acceptance criterion to evidence. Passing tests without completed rendered comparison is not completion; leave the work open and report what remains unchecked.
