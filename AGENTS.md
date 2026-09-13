# Pulse agent instructions

## Verification strategy

- `uv run --no-sync pulse verify` is the single full-repository gate. It runs the status and workflow contracts, the full Python suite, and `npm run verify:frontend`.
- Do not run the full Python suite or `npm run verify:frontend` immediately before or after `pulse verify`; that duplicates work already performed by the aggregate gate.
- During implementation, run the smallest relevant tests. Expand to the affected subsystem only after focused tests pass.
- After the final code change and consolidated review fixes, run `uv run --no-sync pulse verify` once. Rerun it only when it fails or later changes invalidate the result.
- Use `npm run verify:frontend` by itself only when intentionally verifying the frontend without the Python, status, and workflow gates.

