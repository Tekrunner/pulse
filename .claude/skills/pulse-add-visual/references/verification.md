# Completion gates

Before expanding beyond the first implemented figure, populate a copy of `assets/numeric-boundary-evidence.json` from actual pinned observations — a one-time record at the `dataset_revision` it names — and run:

```bash
node .agents/skills/pulse-add-visual/assets/numeric-boundary-harness.mjs <numeric-evidence.json>
```

Declare every distinct DuckDB/Arrow-to-JavaScript conversion path. Cover decimal scale, a negative value, null handling, and display precision. The harness checks the evidence structure and exact expected values. The browser spec then proves the same concerns against the data the artifact serves: it reads rows with `publishedRows` from `tests/browser/published-data.mjs` and asserts displayed text formatted from them. It must not repeat the pinned displays, which the next scheduled refresh would falsify (`AGENTS.md` › Tests over published data). Do not substitute arbitrary universal value bounds.

Before completion:

1. Run `handoff_gate.py verify` against the approval record.
2. Exercise selection near the left, middle, and right of every plot using its actual margins and SVG scaling, taking the expected periods from the served range rather than naming them.
3. Exercise every report control and asynchronous update, preserving viewport, keyboard focus, partial input, selected period, and open disclosures.
4. Exercise ready, loading, empty, suspect, stale, query error, schema incompatibility, render error, and shared-engine failure on the actual route. Verify slot-local isolation and accessible equivalents.
5. Complete `assets/fidelity-checklist.md` with behavior assertions or rendered evidence. Compare approved and implemented output at matching desktop, narrow smartphone landscape, designed states, and 400% zoom/reflow. Explain and approve every difference.
6. Verify no chart-library dependency and no visual-owned SQL, DuckDB, routes, storage, framework globals, fetching, or shared resource lifecycle.
7. During implementation, run the browser specification for the report that owns
   the visual:

   ```bash
   npm run browser:test:report -- <report-id> --project=chromium
   ```

   Omit the project option only when the current evidence needs both supported
   browsers. Do not run the complete browser suite for ordinary visual iteration.
8. After the final code change and consolidated review fixes, run:

```bash
uv run --no-sync python .agents/skills/pulse-add-visual/scripts/fidelity_gate.py <completed-fidelity-checklist.md>
uv run --no-sync pulse verify
git diff --check
```

Run the complete repository gate once; it already includes the full browser suite.
Do not run the full frontend or Python suites separately before or after it.

Map every design requirement and acceptance criterion to evidence. Passing tests without completed rendered comparison is not completion; leave the work open and report what remains unchecked.
