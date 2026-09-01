---
title: 'Story 1.5: Render Real Data Through the Visual Contract'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd12e6001a67d72cb9f284df8bba7fcd8dd2e5f0e'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.2 proves a portable report shell using fixture-only manifest entries and an informal visual boundary, while Story 1.4 now publishes a validated INSEE dataset. Without a versioned contract and compiled browser catalog, the report cannot safely exchange fixture rows for real data.

**Approach:** Define an application-owned Visual Contract v1 with machine-readable validation, compile public `dataset.json` artifacts into a strict browser catalog, and wire the existing portable client and line visual to real INSEE rows without changing its rendering logic. This visual is conformance evidence only; Claude Design-led custom visual and report design begins in Story 1.6.

## Boundaries & Constraints

**Always:** Treat versioned Pulse manifests as the sole inter-stage API; compile only complete public published datasets; include dataset identity, logical table, schema, hash, period, semantic metadata, visibility, and a manifest-relative Parquet URL. Keep one shell-owned DuckDB-WASM worker/connection and parameter binding/cancellation request-scoped. Visuals receive only declared plain rows, display inputs, provenance, and focused cleanup registration; preserve framework-neutral DOM/SVG, accessible data equivalents, responsive behavior, and no-chart-library rules.

**Ask First:** Stop for a visual-contract major version beyond v1, a compatibility adapter/migration that changes existing consumers, a new visual language or report composition decision, non-public/private data handling, or any change that weakens the published dataset contract.

**Never:** Put SQL, DuckDB APIs, Parquet paths, routes, Observable globals, or shell lifecycle objects into a visual; derive data URLs from the document route; silently coerce incompatible consumer rows; let slot cleanup dispose shared browser resources; make a failed slot unusable beyond its own boundary; add a visualization library or manually author a browser catalog that bypasses source manifests; conduct the French macro report's visual-design session, select its final treatments, or compose its production report in this story.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Public publication | Valid public INSEE `dataset.json` and matching Parquet | Deterministic catalog entry and report query returns declared plain rows with matching provenance | Fail the build if the source contract or file is invalid |
| Invalid catalog input | Unsupported contract major, duplicate dataset/table, missing Parquet, or invalid manifest | No catalog is emitted or accepted | Return an explicit safe compatibility/validation error |
| Consumer mismatch | Query rows omit or mistype a declared field | Slot prevents rendering and identifies incompatible fields | Show safe schema-incompatibility state; siblings remain usable |
| Lifecycle failure | Aborted request, visual replacement, or rendering exception | Only the affected request/slot is cancelled, cleaned, or failed | Preserve shared DuckDB-WASM resources and provide retryable safe state |

</frozen-after-approval>

## Code Map

- `runtime/pulse/contracts/dataset.py:11-56` and `runtime/pulse/transform.py:203-234` -- authoritative Dataset Manifest v1 producer/validator and publication shape; consume, do not duplicate or weaken.
- `publish/public/data/insee-cpi/monthly/dataset.json:1-99` -- current real public input: `insee-cpi/monthly`, `insee_cpi_monthly`, four typed columns, semantic metadata, represented period, and status.
- `runtime/pulse/site.py:12-23`, `runtime/pulse/cli.py:12-67`, and `scripts/build-site.mjs:15-25` -- extend the sole automation and static-build seam to compile/copy cataloged public data deterministically, without committing disposable output.
- `site/data/client.js:19-126` and `site/data/browser-shell.js:3-16` -- reuse manifest-relative registration, prepared-statement parameters, request cancellation, normalized errors, and shell-only shared-resource disposal.
- `site/reports/report.js:5-82` -- replace fixture dataset/query/provenance and local row checks with report-side contract consumption and isolated slot-state behavior.
- `site/visuals/line.js:9-40` -- retain unchanged framework-neutral DOM/SVG renderer; adapt fixture and real-query rows at the contract boundary, not inside its rendering logic.
- `tests/node/pilot-contract.test.mjs`, `tests/browser/pilot.spec.js`, and `tests/portability/vite/main.js` -- established contract, browser, accessibility, cancellation/lifecycle, and unchanged-module portability evidence to evolve from fixture-only inputs.

## Tasks & Acceptance

**Execution:**

- [x] `runtime/pulse/contracts/`, `runtime/pulse/catalog.py`, `runtime/pulse/site.py`, `runtime/pulse/cli.py` -- define strict Visual Contract v1 schemas/version validation and deterministic browser-catalog compilation from published Dataset Manifests, rejecting unsupported majors, missing files, invalid public inputs, and identity/table collisions through the repository-local CLI.
- [x] `site/data/`, `scripts/build-site.mjs` -- consume generated manifest-relative catalog entries and package only resolved public Parquet/assets for static subpath delivery, preserving the existing client API, shared connection lifecycle, parameter binding, and request-only cancellation.
- [x] `site/reports/report.js`, `site/visuals/`, and contract documentation -- register the existing line visual as a conformance example with declared fixture/consumer schemas, display/provenance inputs, and focused external-resource cleanup; query real CPI data through a report-owned adapter while keeping its renderer unchanged and slot states distinct. Keep the contract open to arbitrary later DOM/SVG designs.
- [x] `tests/runtime/`, `tests/node/`, `tests/browser/`, `tests/portability/` -- cover compiler validity/collisions/contract majors, fixture-to-real rendering equivalence, typed-consumer rejection, provenance, cancellation/cleanup, slot isolation, accessibility, responsive behavior, and static public artifacts without network access.
- [x] `README.md` and source/report-facing contract documentation -- document the Visual Contract v1, browser catalog generation, safe extension/migration rule, and offline verification path.

**Acceptance Criteria:**

- Given valid published INSEE artifacts, when the catalog is compiled and site is built under a repository subpath, then the client registers the catalog's logical table from its manifest-relative same-origin Parquet URL and returns parameter-bound ordinary rows using the one shell-owned DuckDB-WASM session.
- Given a v1 visual declared against fixture rows, when matching real INSEE query rows replace those fixtures, then it renders the same DOM/SVG logic with correct displayed values and dataset provenance, without importing a chart library or framework/data-routing dependency.
- Given catalog or consumer-contract incompatibility, when validation runs, then unsupported majors, invalid/missing artifacts, collisions, and declared-field/type breaks fail explicitly before incorrect output renders.
- Given loading, empty, query, schema, render, cancellation, and replacement-cleanup cases, when each is exercised, then the affected slot exposes a distinct safe state, siblings and shared browser resources remain usable, and visual cleanup never disposes application-owned resources.

## Spec Change Log

## Design Notes

The catalog is the bridge between immutable source publication and browser registration: compile it once from validated manifests, then resolve all Parquet URLs against that catalog rather than a report route. The report owns the CPI SQL and maps its result to the visual's declared row shape; the visual remains a portable renderer and therefore needs no knowledge of the real dataset. Story 1.6 will use Claude Design to select the real report's questions and treatments, then implement those custom DOM/SVG visuals against this neutral contract.

## Verification

**Commands:**

- `uv run pytest tests/runtime tests/sources -q` -- expected: manifest/catalog and source-publication contract cases pass offline.
- `npm run verify` -- expected: static contract, production build, Vite portability, browser state/accessibility, and artifact-scan evidence pass using only committed fixtures/public inputs.
- `uv run pulse verify` -- expected: aggregate offline workspace, source, and browser-data conformance succeeds.
- `git diff --check` -- expected: no whitespace errors or generated disposable output.

## Suggested Review Order

**Catalog and public-artifact boundary**

- Compile strict browser data only from complete, public source manifests.
  [`catalog.py:35`](../../runtime/pulse/catalog.py#L35)

- Copy every cataloged public Parquet asset instead of coupling build output to INSEE.
  [`public-data-assets.mjs:1`](../../scripts/public-data-assets.mjs#L1)

- Build the catalog before Observable and package its manifest-relative assets.
  [`build-site.mjs:7`](../../scripts/build-site.mjs#L7)

**Browser contract and report handoff**

- Validate catalog majors and resolve data strictly through the shared client.
  [`client.js:16`](../../site/data/client.js#L16)

- Keep the report responsible for parameterized CPI query and provenance adaptation.
  [`report.js:6`](../../site/reports/report.js#L6)

- Declare the portable line visual's fixture and consumer schema separately.
  [`line.contract.js:1`](../../site/visuals/line.contract.js#L1)

**Conformance evidence**

- Exercise malformed manifests, collisions, and public asset identity offline.
  [`test_catalog.py:24`](../../tests/runtime/test_catalog.py#L24)

- Prove cancellation leaves the shared DuckDB connection reusable.
  [`client-contract.test.mjs:1`](../../tests/node/client-contract.test.mjs#L1)

- Verify real 367-row rendering, isolated states, accessibility, and browser budget.
  [`pilot.spec.js:5`](../../tests/browser/pilot.spec.js#L5)
