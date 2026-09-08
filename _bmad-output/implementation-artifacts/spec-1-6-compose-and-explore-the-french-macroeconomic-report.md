---
title: 'Story 1.6: Compose and Explore the French Macroeconomic Report'
type: 'feature'
created: '2026-09-07'
status: 'done'
baseline_commit: '36feeb0b5e6bb5cc8bdda034d2f474afc1a23520'
review_loop_iteration: 0
context: ['_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pulse has a one-visual pilot, not the approved French consumer-price report. Category data lacks real services/manufactured inputs, and public Parquet is ignored.

**Approach:** Complete the source-to-report slice: publish missing INSEE series, LFS-track canonical Parquet, catalog the report, and reproduce the approved four-figure Nocturne design with parameterized browser queries and Visual Contract v1 modules.

## Boundaries & Constraints

**Always:** Treat `Pulse Story 1.6 report design.zip` (SHA-256 `056c4ec2fe7967c88aa81ebec6a7402a1ac22f146dcaff98d25e327d1b8af6fd`) README/prototype as authority; the decisions page is rationale. Replace representative services/manufactured values and labels with official index, annual-change, and annual-weight series. Preserve precision/provenance, weight years, rent-as-Pulse-calculation labelling, and its non-additive lane. Reports own queries/state/routing/measurement/tables/provenance/errors; visuals accept validated rows/display/provenance and return DOM/SVG. Measure wrappers after render/identity changes; ignore zero widths; use ResizeObserver plus changed-width-only fallback; pair `overflow-x:auto` with `overflow-y:hidden`. Match all six states and WCAG 2.2 AA. LFS-track canonical public Parquet; keep manifests in Git and generated site copies disposable.

**Ask First:** Stop for provider incompatibility; changes to approved questions, geometry, controls, default five-year/“From start” periods; cross-filtering, contract-major changes, remote dependencies, or chart libraries.

**Never:** Ship prototype `support.js`, representative/reconstructed data, remote assets, snapshot reads, route-derived URLs, SQL/DuckDB/framework-aware visuals, implicit cross-filtering, stacked rent, generated site files, or generic chart vocabulary.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Publication | Existing inputs plus services `011813906/908/011814579` and manufactured `011813780/782/011814496` | Immutable snapshot; expanded typed data; LFS Parquet | Reject incompatible/missing/title mismatch; never reconstruct |
| Normal | Two datasets; latest/default five years | Scorecards, four figures, controls, calculator, provenance, queries, tables | Loading/empty/query retain context/selection |
| Explore | Dates/categories/month selection | Supported local queries; selection is query-free and period-keyed | Clamp crossed bounds; empty categories may retain headline |
| Slot failure | Bad schema or render exception | Siblings/navigation survive; schema is identified; render retains table | Escalate only shared engine/delivery failure |

</frozen-after-approval>

## Code Map

- `Pulse Story 1.6 report design.zip` -- approved design/contracts/extracts/style; inspect, do not port runtime.
- `sources/insee-cpi/{source.yaml,acquire.py,snapshot-contract.yaml}` -- add six verified France/all-households/Base-2025 series.
- `datasets/insee-cpi-category-analysis/{dataset-contract.yaml,dataset-contract.md,dbt/models/insee_cpi_category_analysis.sql}` -- add service/manufactured level, change, weight/year semantics.
- `runtime/pulse/{datasets.py,catalog.py,cli.py}` -- publication and strict report catalog.
- `site/reports/`, `site/visuals/`, `site/style.css`, `site/data/` -- portable report and isolated states.
- `.gitignore`, `.gitattributes`, `scripts/build-site.mjs`, `tests/` -- storage/build policy and verification.

## Tasks & Acceptance

**Execution:**
- [x] `sources/insee-cpi/`, `datasets/insee-cpi-category-analysis/`, `tests/{sources,datasets}/` -- publish all real inputs with strict semantics and no reconstruction.
- [x] `.gitattributes`, `.gitignore`, `_bmad-output/planning-artifacts/architecture.md`, `README.md` -- codify LFS Parquet, normal-Git manifests, disposable outputs.
- [x] `runtime/pulse/{catalog.py,cli.py}`, `tests/runtime/` -- deterministic report catalog; validate IDs/routes, visibility/lineage, substantive-change stability.
- [x] `site/reports/`, `site/visuals/`, `site/style.css`, `site/data/` -- implement approved report/contracts, measurement/overflow, no external assets.
- [x] `tests/{node,browser}/` -- cover queries, six states, slot isolation, controls, reload/subpath, accessibility/reflow, tables/provenance, and forbidden artifacts.

**Acceptance Criteria:**
- Given expanded contracts and the design, when the nested report loads, then four real-data visuals answer its questions with correct precision, periods, provenance, tables, and defaults.
- Given exploration, when controls change, then supported queries remain local, selection stays stable without implicit cross-filtering, and controls remain accessible.
- Given catalog regeneration, collisions, or a failed slot, when validation/rendering runs, then collisions fail, substantive-change is stable, and unaffected content remains usable.

## Spec Change Log

- 2026-09-08: User requested correction after observing design/copy deviations, missing visual elements, incorrect click mapping, and unscaled component decimals. Reopened report and verification tasks. Preserve approved copy and presentation except representative-data disclaimers; verify pinned values through the browser, plot-relative selection at left/middle/right, basket strips and separate rent geometry, and rendered fidelity at desktop/narrow sizes. Keep the official source/dataset expansion and public Parquet LFS policy. Earlier passing smoke tests did not establish completion.

## Verification Evidence

- `npm run verify` passed all 54 Chromium/Firefox browser tests, including component, period, calculator, focus, disclosure, and scroll-retention interactions.
- Public artifact scan passed; `git diff --check` passed.

## Suggested Review Order

**Report state and interaction preservation**

- Report-owned state, measurement, focus, and viewport restoration across every control.
  [`report.js:1`](../../../site/reports/french-consumer-prices/report.js#L1)

- Shared visual contracts keep slot rendering isolated and measurements stable.
  [`report-shared.js:1`](../../../site/visuals/report-shared.js#L1)

**Data and publication boundaries**

- Category query casts decimal inputs explicitly, preventing scaled component values.
  [`insee_cpi_category_analysis.sql:1`](../../../datasets/insee-cpi-category-analysis/dbt/models/insee_cpi_category_analysis.sql#L1)

- Catalog and publication code enforce report identity and LFS-backed artifacts.
  [`catalog.py:1`](../../../runtime/pulse/catalog.py#L1)

**Verification**

- Browser coverage exercises pinned values, visual selection, all controls, reflow, and failure states.
  [`pilot.spec.js:1`](../../../tests/browser/pilot.spec.js#L1)

- Contract checks reject forbidden remote assets and validate the portable report bundle.
  [`report-contract.test.mjs:1`](../../../tests/node/report-contract.test.mjs#L1)

## Design Notes

Recreate the prototype. README/prototype establish “From start” and no download, overriding stale decisions-page text. Expand provisional enums for real services/manufactured data. Preserve identity through colour plus dash, prose, and tables.

## Verification

**Commands:**
- `PULSE_LIVE_INSEE=1 uv run --no-sync pytest -m live tests/sources/test_insee_cpi_live.py -q` -- provider series validate.
- `uv run --no-sync pulse dataset build all && uv run --no-sync pulse verify && uv run --no-sync pytest` -- replay, contracts/catalogs, Python pass.
- `npm run verify` -- report, portability, state, accessibility, subpath, performance, scans pass.
- `git lfs ls-files && git diff --check` -- canonical Parquet is LFS-backed; manifests normal Git; tree cleanly formatted.
