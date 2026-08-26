---
title: 'Story 1.1: Establish a Reproducible Pulse Workspace'
type: 'feature'
created: '2026-08-26'
status: 'done'
review_loop_iteration: 0
baseline_commit: '939a58bf0af4f7e7706b6ac2b7871222f7cc1ba1'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pulse has no reproducible runtime workspace, locked dependencies, repository-local automation entry point, compatibility proof, or clean-install CI. Later stories therefore depend on global state and an unproven dbt publication mechanism.

**Approach:** Establish minimal Python 3.13/uv and Node 24/npm projects, committed locks, one extensible `pulse verify` CLI, fixture-only smoke suites, and frozen-install CI. Ratify dependencies only after proving dlt/dbt/DuckDB, external-Parquet publication, Observable Framework, and DuckDB-WASM together.

## Boundaries & Constraints

**Always:** Keep `uv run pulse` as the sole local/CI automation API; use frozen installs; isolate smoke artifacts in temporary or ignored paths; report actionable failures; lock compatible dlt, dbt-core, dbt-duckdb, DuckDB, Observable, and DuckDB-WASM releases; prove successful and intentionally failing dbt tests.

**Ask First:** If external Parquet cannot support downstream `ref()` plus passing/failing `not_null` tests, stop for approval of one shared fallback and an architecture update. Ask before replacing a named substrate or changing planned tool roles.

**Never:** Add production sources/data/reports/visuals/site output, private or fetched source data, chart libraries, a second automation entry point, or undeclared globals. Never weaken a failed compatibility gate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Clean install | Clean clone; supported toolchains | Frozen uv/npm installs reproduce environments | Non-zero prerequisite plus remediation |
| Verification | Installed workspace | `uv run pulse verify` runs every smoke stage | Identify stage and preserve diagnostic |
| Publication gate | Isolated valid and invalid dbt fixtures | Parquet and downstream `ref()` work; valid test passes; invalid test demonstrably fails | Missing behavior blocks acceptance pending approved fallback |

</frozen-after-approval>

## Code Map

- `README.md:1`, `.gitignore:97,150` -- document clean install/verification; ignore generated state while preserving locks.
- `_bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md:35,103,109,115,137-177,218` -- read-only one-CLI, offline-fixture, version, structure, publication-gate, and fallback rules.
- `_bmad-output/planning-artifacts/epics.md:188-236` -- read-only Story 1.1 acceptance source.
- `pyproject.toml`, `uv.lock`, `.python-version`; `package.json`, `package-lock.json`, `.node-version` -- new locked Python/Node workspaces.
- `runtime/pulse/cli.py`, `runtime/pulse/verify.py` -- new extensible CLI and staged verifier.
- `tests/data_tools/`, `tests/fixtures/dbt_external/`, `tests/node/` -- new imports, dbt publication gate, expected-failure, and Node checks.
- `.github/workflows/verify.yml` -- new clean-checkout frozen verification using the same CLI.

## Tasks & Acceptance

**Execution:**
- [x] `pyproject.toml`, `.python-version`, `uv.lock` -- define Python 3.13 package, CLI, data/test dependencies, and lock.
- [x] `package.json`, `.node-version`, `package-lock.json`, `tests/node/verify-baseline.mjs` -- lock Node 24 browser dependencies and verify imports/dependency policy.
- [x] `runtime/pulse/cli.py`, `runtime/pulse/verify.py` -- implement extensible staged verification with actionable non-zero failures.
- [x] `tests/data_tools/`, `tests/fixtures/dbt_external/` -- prove imports, dbt parse/build/test, external Parquet, downstream `ref()`, and both `not_null` outcomes.
- [x] `.github/workflows/verify.yml`, `.gitignore`, `README.md` -- automate and document clean frozen verification without generated or local state.

**Acceptance Criteria:**
- Given isolated fixtures, when the data smoke suite runs, then dlt, dbt-core, dbt-duckdb, and DuckDB load and dbt parse/build/test completes without source-data network access.
- Given locked Node dependencies, when baseline verification runs, then Observable and DuckDB-WASM import and no chart library is adopted or invoked by Pulse.
- Given a clean CI checkout, when verification runs, then frozen installs and Story 1.1 checks pass without private data, author state, fetched source data, or committed generated output.
- Given the resulting tree, when inspected, then it contains only Story 1.1 runtime, configuration, fixtures, tests, docs, and CI scaffolding.

## Spec Change Log

## Design Notes

The CLI orchestrates independently testable checks. The dbt project is a fixture, not a production source slice, and writes beneath a temporary directory. Its invalid case counts as evidence only when dbt returns the expected test failure.

## Verification

**Commands:**
- `uv sync --frozen`; `npm ci` -- expected: both environments reproduce from locks.
- `uv run pulse verify`; `uv run pytest`; `npm run verify` -- expected: all smoke, unit, publication, and Node checks pass.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Automation entry point**

- One ordered stage registry keeps local and CI verification on the same extensible API.
  [`verify.py:113`](../../runtime/pulse/verify.py#L113)

- CLI failures become actionable diagnostics and reliable non-zero exit codes.
  [`cli.py:18`](../../runtime/pulse/cli.py#L18)

**Publication compatibility gate**

- Exact Parquet and downstream rows prove external materialization preserves data through `ref()`.
  [`test_dbt_external.py:79`](../../tests/data_tools/test_dbt_external.py#L79)

- Exact expected failure proves `not_null` detection cannot pass on unrelated dbt errors.
  [`test_dbt_external.py:97`](../../tests/data_tools/test_dbt_external.py#L97)

**Locked toolchain policy**

- Python dependencies and uv itself are constrained as one reproducible environment.
  [`pyproject.toml:1`](../../pyproject.toml#L1)

- Node, npm, Observable, and DuckDB-WASM versions form the browser baseline.
  [`package.json:1`](../../package.json#L1)

- Dependency-name and alias checks enforce the no-chart-library boundary.
  [`dependency-policy.mjs:1`](../../tests/node/dependency-policy.mjs#L1)

**Verification evidence and operations**

- CI performs frozen installs, one high-level verification, and a clean-worktree assertion.
  [`verify.yml:8`](../../.github/workflows/verify.yml#L8)

- Focused tests preserve stage ordering, timeouts, diagnostics, and prerequisite rejection.
  [`test_verify.py:13`](../../tests/runtime/test_verify.py#L13)

- Clean-clone instructions expose the same commands developers and CI run.
  [`README.md:3`](../../README.md#L3)
