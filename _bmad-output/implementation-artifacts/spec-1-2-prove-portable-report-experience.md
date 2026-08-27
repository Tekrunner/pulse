---
title: 'Story 1.2: Prove the Portable Report Experience'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
baseline_commit: '19efd50b2590dc85e01f1d948214174419a70594'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/epics.md'

---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pulse has locked browser dependencies but no proven report shell, nested deployment path, same-origin Parquet query, portable data/visual modules, or evidence that Observable can meet accessibility and performance requirements.

**Approach:** Build a small Observable Framework pilot around committed fixture Parquet, a shared single-threaded DuckDB-WASM data client, and framework-neutral DOM/SVG modules. Verify it in a minimal Vite harness and with browser, accessibility, portability, performance, and public-artifact checks before ratifying the site substrate.

## Boundaries & Constraints

**Always:** Use the repository-local Pulse CLI as the documented local-serve/build/verification entry point; keep fixture data offline and same-origin; resolve manifest-relative assets from an application-owned base rather than `document` routes; use one shell-owned worker/connection per page session; expose distinct safe loading, empty, startup, query, schema, and render states; use semantic dark-default tokens, visible focus, keyboard operation, non-color-only cues, reduced motion, responsive layout, and an accessible data equivalent; record reproducible cold-load and first-readable-visual measurements and derive a numeric architecture budget.

**Ask First:** Stop for approval if the pilot requires replacing Observable, adding special headers or a threaded/coi architecture, changing the shared data-client/visual contracts, or accepting a failed mandatory exit criterion.

**Never:** Add a chart or visualization library; put SQL, DuckDB, Parquet URLs, routing, Observable globals/protocols, or generated paths in visual modules; let reports dispose shared resources; use remote data, private paths, credentials, committed generated site residue, or Evidence as an automatic fallback.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal pilot | Fixture Parquet and valid manifest | Nested report queries and renders an interactive DOM/SVG visual | Visible safe diagnostics only |
| Empty/query failure | Empty fixture or failed query | Distinct useful no-row/query-error state; sibling shell remains usable | No blank output or secret details |
| WASM startup failure | DuckDB-WASM initialization rejected | Distinct report-level startup state | Explain safe recovery/action |
| Direct nested reload | Production subpath build and nested URL | Scripts, worker, manifest, and Parquet resolve correctly | Fail verification on route-derived URLs |

</frozen-after-approval>

## Code Map

- `package.json:1-24`, `package-lock.json` -- locked Observable 1.13.4 and DuckDB-WASM 1.31.0 dependencies; extend scripts without weakening Node 24/npm 11 policy.
- `runtime/pulse/cli.py:1-55`, `runtime/pulse/verify.py:1-112` -- sole automation API and staged verifier; add site pilot commands/stages here rather than a second entry point.
- `tests/node/verify-baseline.mjs:1-31`, `tests/node/dependency-policy.mjs:1-80` -- existing import and no-chart policy patterns for Node checks.
- `README.md:1-33` -- clean-install and verification documentation; add the one-command local serve/build procedure and measured budget evidence.
- `site/` -- architecture-reserved home for catalog, design tokens, reports, visuals, and data client; currently absent, so create the pilot with explicit application-owned imports and paths.
- `tests/` -- existing pytest/Node offline verification roots; add browser, portability, artifact-scan, and fixture tests without network source data.
- `_bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md:75-121,137-176,208-216` -- read-only constraints for Observable’s exit seam, dependency direction, accessibility, locked runtimes, and deferred numeric performance budget.
- `_bmad-output/implementation-artifacts/epic-1-context.md:1-35` -- authoritative Epic 1 goals, contracts, and Story 1.2 dependency/consumer context.

## Tasks & Acceptance

**Execution:**
- [x] `site/` -- create the Observable shell, nested report route, manifest-relative asset base, dark semantic tokens, responsive accessible layout, and fixture-backed data client.
- [x] `site/data/`, `site/visuals/`, `site/reports/` -- implement shared-resource ownership and a nontrivial interactive DOM/SVG visual using explicit imports; keep modules framework-neutral and contract-bound.
- [x] `tests/browser/`, `tests/node/`, `tests/portability/` -- cover normal/empty/startup/query states, nested reload/subpath URLs, one-worker lifecycle, keyboard/accessibility/responsive behavior, Vite reuse, and public-artifact scans.
- [x] `runtime/pulse/cli.py`, `runtime/pulse/verify.py`, `README.md` -- expose and document frozen install, serve/build, browser/portability/artifact checks, and reproducible performance measurement.
- [x] `_bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md` -- record the measured numeric cold-load and first-readable-visual budget only after the clean pilot measurement succeeds.

**Acceptance Criteria:**
- Given the locked workspace and fixture Parquet, when the documented one-command serve runs, then an Observable nested report queries same-origin Parquet with the single-threaded EH bundle and no special headers.
- Given a real repository-subpath production build, when homepage and nested report URLs are opened or reloaded directly, then all assets, workers, manifests, and Parquet resolve from the application base and never the current document route.
- Given navigation within the pilot, when the shell initializes and routes change, then exactly one shared worker/connection is reused; reports never dispose it and only page unload does.
- Given fixture rows, when the visual renders in Observable and a minimal Vite harness, then unchanged explicit-import modules return ordinary DOM/SVG and contain no forbidden coupling.
- Given normal, loading, empty, startup-failure, query-failure, accessibility, zoom, and narrow-landscape cases, when browser checks run, then each state is distinct, safe, keyboard-operable, responsive, contrast-compliant, reduced-motion aware, and has an accessible data equivalent.
- Given a clean clone and cold-cache production build, when install, build, browser, portability, artifact, and performance checks run, then they pass with frozen dependencies, no private/remote residue, and a recorded numeric budget; any mandatory failure blocks acceptance and reopens the architecture decision.

### Review Findings

- [x] [Review][Patch] Ensure Observable copies the EH worker, WASM, and fixture Parquet into resolvable production-artifact paths [site/data/client.js:3]
- [x] [Review][Patch] Make clean-clone verification build a fresh artifact before inspecting `dist/` [package.json:15]
- [x] [Review][Patch] Route build, verification, and one-command local serving through the repository-local Pulse CLI [runtime/pulse/cli.py:11]
- [x] [Review][Patch] Add real browser coverage for direct nested reloads, same-origin DuckDB queries, navigation, and asset resolution [tests/browser/pilot.spec.js:3]
- [x] [Review][Patch] Implement and exercise a genuine minimal Vite portability harness with unchanged client and visual modules [tests/portability/vite/main.js:1]
- [x] [Review][Patch] Record reproducible observed cold-load and first-readable-visual measurements and enforce the resulting budget [docs/report-pilot-performance.md:3]
- [x] [Review][Patch] Replace the static polyline with the required nontrivial keyboard-operable interactive visual [site/visuals/line.js:2]
- [x] [Review][Patch] Implement distinct loading, empty, startup, query, schema, and render states with safe diagnostics and recovery [site/reports/report.js:8]
- [x] [Review][Patch] Resolve dataset IDs and Parquet URLs from the browser manifest rather than hardcoded client values [site/data/client.js:26]
- [x] [Review][Patch] Move report-owned SQL out of the data client and implement parameter binding and request-scoped cancellation [site/data/client.js:31]
- [x] [Review][Patch] Harden shared DuckDB lifecycle against failed initialization, disposal races, and close failures [site/data/client.js:13]
- [x] [Review][Patch] Validate visual input, eliminate duplicate IDs and data-driven `innerHTML`, and preserve readable narrow-layout output [site/visuals/line.js:3]
- [x] [Review][Patch] Scan and test the complete public artifact rather than only three generated HTML files [tests/browser/artifact-scan.mjs:1]

## Design Notes

The shell owns lifecycle and adaptation; reports own queries and state; visuals receive plain rows, display metadata, and provenance. This boundary is the portability proof and must remain unchanged when fixture queries later become real report queries.

## Verification

**Commands:**
- `uv sync --frozen && npm ci && uv run pulse verify` -- expected: all pilot stages pass from a clean locked workspace.
- `npm run verify` -- expected: dependency, build, browser, portability, performance, and artifact checks pass.
- `git diff --check` -- expected: no whitespace errors or generated residue.

## Suggested Review Order

**Browser data boundary**

- The shell owns one EH worker and connection, with local URLs independent of document routes.
  [`client.js:1`](../../site/data/client.js#L1)

- Reports borrow the shared client and expose safe loading and query-failure states.
  [`report.js:1`](../../site/reports/report.js#L1)

**Portable visual and experience**

- The visual accepts plain rows and returns accessible SVG plus a data table.
  [`line.js:1`](../../site/visuals/line.js#L1)

- The production subpath and custom semantic stylesheet keep output local, dark, responsive, and focused.
  [`observablehq.config.js:1`](../../observablehq.config.js#L1)
  [`style.css:1`](../../site/style.css#L1)

**Verification and evidence**

- Nested pages and portability contracts guard routes, imports, lifecycle, and forbidden coupling.
  [`pilot.spec.js:1`](../../tests/browser/pilot.spec.js#L1)
  [`main.js:1`](../../tests/portability/vite/main.js#L1)

- The architecture records the pilot’s reproducible cold-load and first-readable-visual ceilings.
  [`ARCHITECTURE-SPINE.md:210`](../planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md#L210)

- Locked commands and local serving instructions make clean-clone verification repeatable.
  [`package.json:12`](../../package.json#L12)
  [`README.md:15`](../../README.md#L15)
