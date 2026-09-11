---
title: 'Story 1.9: Build and Deploy a Reproducible Public Site'
type: 'feature'
created: '2026-09-10'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd7a1ac09cc109730c88c1e554f7aab50613faddb'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pulse can rebuild datasets, compile catalogs, build the site, and verify browsers, but these are separate operations without a fail-closed public profile or exact-artifact deployment. A clean clone cannot prove the hosted site matches the repository build.

**Approach:** Add one offline public build that reuses independent dataset stages in disposable roots, validates positive-public lineage and complete catalogs, verifies a hashed static artifact, and deploys those bytes through a latest-wins Pages workflow so readers can browse every public report at the repository's GitHub Pages URL.

## Boundaries & Constraints

**Always:** Use frozen Python 3.13/uv and Node 24/npm; require materialized LFS; derive explicit public closure from declarations; rebuild committed snapshots without acquisition in disposable roots; preserve same-origin `/pulse/`; add `system/site` generation, validity, build, and deployment-preparation evidence before hashing; verify before upload; preserve the deployed predecessor on failure.

**Ask First:** Contract-major changes, services beyond GitHub Pages/Actions, credentials/private roots, `/pulse/` route changes, weaker performance budgets, or canonical artifact rewrites.

**Never:** Read private roots; pass credentials into the build; silently omit invalid public lineage; mutate or commit generated output on `main`; acquire network data; modify the artifact after verification; deploy unverified bytes; name dataset IDs in workflow YAML.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean rebuild | Clean clone, frozen installs, committed snapshots | Rebuild all public datasets and complete `/pulse/` artifact | Repeated substantive outputs match except documented metadata |
| Invalid closure | Missing/private/ambiguous reference or unsupported contract | No deployable artifact | Fail safely |
| Missing LFS object | Required snapshot or published Parquet is an unresolved pointer | Do not consume pointer bytes | Fail actionably before packaging |
| Unsafe artifact | Private/secret/remote/residual/oversized content or hash drift | Reject artifact | Retain safe diagnostic |
| Superseded/failed run | Newer run or failed gate | Old site stays live | Cancel or fail without repository mutation |

</frozen-after-approval>

## Code Map

- `runtime/pulse/{cli.py,site.py}` -- add public orchestration and sanitized subprocess entrypoint.
- `runtime/pulse/datasets.py:224`, `:309`, `:415`; `runtime/pulse/archive.py:43` -- reuse LFS/snapshot validation and independent builds; `all` is unprofiled.
- `runtime/pulse/catalog.py:68`, `:162`, `:252`, `:475` -- enforce public closure and complete catalog references.
- `runtime/pulse/contracts/status.py:27`; `site/data/{status-client.js,home.js}` -- extend status for `system/site` while preserving reader-side staleness.
- `scripts/{build-site.mjs,public-data-assets.mjs,serve-site.mjs}` -- parameterize roots/output, package/hash same-origin assets, retain range behavior.
- `tests/browser/{artifact-scan.mjs,pilot.spec.js,serve-artifacts.mjs}` -- artifact scan and production behavior/performance gates.
- `.github/workflows/{verify.yml,insee-cpi.yml}`; `tests/runtime/test_workflows.py` -- locked CI/writer precedents for no-write Pages contracts.
- `README.md`, `docs/report-pilot-performance.md` -- build/serve/deployment procedure and production performance evidence.

## Tasks & Acceptance

**Execution:**
- [x] `runtime/pulse/{public.py,cli.py,site.py}`, `scripts/build-site.mjs` -- add one offline public command with isolated roots/minimal environment; reject LFS pointers; keep tracked files clean.
- [x] `runtime/pulse/{catalog.py,contracts/status.py}`, `site/data/{status-client.js,home.js}` -- emit complete public catalogs and `system/site` generation/validity/outcomes.
- [x] `scripts/{public-data-assets.mjs,build-site.mjs}`, `tests/browser/artifact-scan.mjs` -- generate sorted SHA-256 inventory; reject unsafe content/hash drift.
- [x] `.github/workflows/pages.yml`, `runtime/pulse/verify.py`, `tests/runtime/test_workflows.py` -- verify once, then upload/deploy identical bytes with least privilege and separate latest-wins concurrency; never push.
- [x] `tests/{runtime,node,browser}/` -- cover the matrix, replay, catalogs/status, handoff, ranges, production behavior/accessibility/failures, and both-browser performance.
- [x] `README.md`, `docs/report-pilot-performance.md` -- document LFS, frozen install, one-command rebuild/serve, Pages URL, equivalence exceptions, and measurements.

**Acceptance Criteria:**
- Given a clean clone, when the public command runs, then all public datasets and the site rebuild from committed snapshots without acquisition, private/prior state, or tracked changes.
- Given public declarations, when catalogs compile, then every version, identity, lineage edge, route, table, report, slot, status, and file resolves uniquely and only explicit public closure is emitted.
- Given browser verification, when production behavior, accessibility, failures, and cold-cache performance run, then established budgets pass.
- Given a successful Pages run, when deployment occurs, then the verified inventory identifies the exact immutable `/pulse/` artifact; newer runs supersede older ones and failures preserve the prior site until stale.
- Given a successful deployment, when a reader opens the GitHub Pages URL, then the homepage and every public report work under `/pulse/` through navigation, direct links, and page reloads without a local or continuously running server.

## Spec Change Log

## Design Notes

Inside the immutable artifact, `deploy-site` means successful deployment preparation; the observed Pages result stays workflow evidence because adding it later would mutate verified bytes. Only documented time/preparation metadata may differ across rebuilds; substantive payloads remain byte-equivalent.

## Verification

**Commands:**
- `uv sync --frozen && npm ci` -- locked dependencies install without resolution drift.
- `uv run --no-sync pytest` -- runtime, profile, catalog, status, and workflow contracts pass offline.
- `uv run --no-sync pulse verify` -- repository-wide contracts and clean-worktree checks pass.
- `npm run verify` -- production build, Node contracts, Chromium/Firefox behavior and performance, and artifact scan pass.
- `git diff --check` -- changed artifacts contain no whitespace errors.

## Suggested Review Order

**Public build boundary**

- Start with the offline orchestrator that rebuilds disposable publications and preserves repository state.
  [`public.py:101`](../../runtime/pulse/public.py#L101)

- Declaration closure makes public reports the sole dataset-selection authority.
  [`catalog.py:53`](../../runtime/pulse/catalog.py#L53)

- Filtered source staging excludes undeclared and private report routes and modules.
  [`public-site-sources.mjs:35`](../../scripts/public-site-sources.mjs#L35)

**Catalog, status, and artifact integrity**

- Report compilation validates public lineage, route identity, visuals, and exploration declarations.
  [`catalog.py:227`](../../runtime/pulse/catalog.py#L227)

- Site status derives a validity window from the earliest public-lineage deadline.
  [`catalog.py:608`](../../runtime/pulse/catalog.py#L608)

- Reader-side resolution makes retained deployments visibly stale without rewriting artifacts.
  [`status-client.js:163`](../../site/data/status-client.js#L163)

- Deterministic file inventories and safety scanning guard the immutable Pages handoff.
  [`public-data-assets.mjs:52`](../../scripts/public-data-assets.mjs#L52)

**Deployment and verification**

- Latest-wins Pages automation verifies once, uploads exact bytes, and never writes the repository.
  [`pages.yml:1`](../../.github/workflows/pages.yml#L1)

- Failure and replay tests prove predecessor preservation and substantive build equivalence.
  [`test_public.py:167`](../../tests/runtime/test_public.py#L167)

- Browser coverage verifies public navigation, pipeline health, queries, accessibility, and performance.
  [`pilot.spec.js:548`](../../tests/browser/pilot.spec.js#L548)

- Operator documentation gives the complete LFS, frozen-build, serve, and Pages procedure.
  [`README.md:42`](../../README.md#L42)
