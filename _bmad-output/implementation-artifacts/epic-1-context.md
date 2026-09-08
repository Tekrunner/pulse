# Epic 1 Context: Open and Trust the First Public Report

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the first complete public French macroeconomic report: Yann can open a curated, multi-angle view of current indicators, explore the underlying data where enabled, inspect provenance and represented dates, and understand health or freshness warnings. The public pipeline must acquire INSEE data automatically or on demand, preserve immutable snapshots, rebuild and test source data reproducibly, publish static browser-readable artifacts, and expose failures or suspect/stale output without concealing them.

## Stories

- Story 1.1: Establish a Reproducible Pulse Workspace
- Story 1.2: Prove the Portable Report Experience
- Story 1.3: Select, Acquire, and Archive the First INSEE Dataset
- Story 1.4: Transform and Publish the First INSEE Dataset
- Story 1.5: Render Real Data Through the Visual Contract
- Story 1.5a: Expand the INSEE CPI Dataset for Category Analysis
- Story 1.5b: Establish Independent Source and Dataset Package Boundaries
- Story 1.6: Compose and Explore the French Macroeconomic Report
- Story 1.7: See Pipeline Health and Data Freshness
- Story 1.8: Run the INSEE Pipeline Automatically and On Demand
- Story 1.9: Build and Deploy a Reproducible Public Site

## Requirements & Constraints

The implementation uses locked Python 3.13/uv and Node 24/npm environments, frozen installs, and smoke coverage for the CLI, dlt, dbt-duckdb, DuckDB, Observable, and DuckDB-WASM. The external-Parquet mechanism must prove dbt `ref()` plus passing and failing `not_null` tests before source work relies on it.

The INSEE source is discoverable from its acquisition-only package, with stable identity, acquisition method, cadence, expected publication advancement, licence, attribution, source-native schema, and snapshot contract. Public acquisition is independently scheduled, idempotent, retryable, and manually triggerable. Each observation receives an opaque acquisition ID; retries reuse it, while later observations receive new IDs. Every acquisition ends at an immutable validated snapshot. Source packages contain no analytical transformation or report-facing schema.

Datasets are independently discovered from `datasets/<dataset-id>/`. Each package declares the snapshot contract it consumes and owns analytical transformations, dbt models/tests, semantic metadata, fixtures, and its committed report-facing contract. A dataset build works from snapshots alone, never invokes acquisition, and never imports source-package code. Shared runtime discovers and orchestrates package contracts generically and contains no INSEE IDs, CPI columns, formulas, or hard-coded dataset shapes. V1 datasets still depend on exactly one source, but their identity and ownership are source-neutral.

The first report is a French consumer-price inflation analysis. The INSEE CPI scope must use mutually comparable Base-2025 IPC series for headline CPI, food, energy, actual rents paid, and the required annual basket weights; do not substitute IPCH, another base/geography/population, property-sale prices, or incomparable measures. The category expansion creates a new immutable snapshot without altering the original three-series snapshot. Independent dataset packages preserve the headline contract and publish the category/weight analysis contract from those snapshots. All added indicators require provider identity, title, definition, unit, precision, base, source, licence, and attribution. Any component calculation must state and test its formula, time alignment, coverage, rebasing behavior, and limits; source-provided weights or a transparent approximation must never be represented as an official INSEE contribution or a causal claim.

Published datasets are wide, typed, single-source Parquet with committed machine-readable dataset, column, and indicator contracts. Versioned snapshot and dataset artifacts are the only inter-package APIs and validate strictly, including lineage, hashes, represented period, URLs, visibility, and sanitized diagnostics. Dataset-private staging is disposable and not a source/dataset boundary. Static output must work locally and under a repository subpath with same-origin Parquet, without special headers. Status distinguishes source acquisition, dataset build/publication, and site stages.

The report is a standing, pre-composed analysis rather than a generic dashboard. Its content is intentionally decided in an authoring session against the enriched real dataset: the standing questions, chosen indicators, precision, comparisons, arrangement, and visual treatments must not be inferred from a chart vocabulary. It contains at least three purpose-built visuals that answer distinct or complementary questions. Each visual is first designed against fixture data with a declared schema; Claude Design may produce the HTML/SVG/CSS/JS design without a visualization library, after which a coding agent mechanically connects that design to the real query through the visual contract. Do not start report design until the enriched fixture schema and representative category values are published.

## Technical Decisions

Pulse is a pipes-and-filters system separated by immutable, versioned artifacts: source acquisition → snapshot contract/artifact → independent dataset transform/test → dataset contract/Parquet → static site → browser query/render. Dataset-private staging, DuckDB databases, and generated site output are disposable. Source packages own provider access and faithful decoding; dataset packages and dbt-duckdb own analytical typing, semantics, tests, and publication. Public raw snapshots use Git LFS, and pointer stubs are rejected before consumption.

Observable Framework is the v1 shell behind a portability seam. Keep portable modules free of Observable globals and generated paths. The shell owns one shared DuckDB-WASM worker and connection; the data client alone resolves manifest-relative data, registers it, binds query parameters, normalizes errors, and handles request-scoped cancellation. Reports own dataset selection, parameterized SQL, exploration state, provenance plumbing, routing, and annotations; visuals receive only validated rows, display inputs, and provenance inputs and return DOM/SVG. Each visual slot independently contains loading, no-row, query, schema-incompatibility, and render errors.

Each `site/reports/<report-id>/report.yml` is the canonical owner of the stable lowercase-kebab-case identity, nested route, requested visibility, dataset dependencies, visual slots, column-level lineage, and exploration setting. The compiled report catalog records resolved visibility and a substantive data-or-content-change value that routine regeneration must not modify. IDs and routes must be unique. Dataset URLs are always resolved against the browser manifest, never from the current route.

All default-branch mutations pass through one serialized repository writer; source acquisition, dataset builds, and site builds have distinct ownership. A single repository-local Pulse CLI is used by local runs, agents, and thin Actions workflows.

## UX & Interaction Patterns

Use the existing dark-default semantic theme tokens and visual-language contract, with restrained motion and reduced-motion support. Visuals and controls must be container-responsive, readable in narrow smartphone landscape, and meet WCAG 2.2 AA through semantic structure, keyboard operation, visible focus, non-color-only state cues, contrast, zoom/reflow, adequate targets, and an accessible data equivalent. Keep the indicator, represented period, provenance, and status context available at every layout.

Exploration is an explicit report opt-in. When enabled, it issues supported parameterized queries locally through the shared DuckDB-WASM session without a server round trip, while the pre-composed report remains the complete default experience. Do not introduce cross-visual filtering unless the report-design session explicitly selects it; its query topology remains a deferred decision.

## Cross-Story Dependencies

The report depends on the locked runtime and portable browser substrate, the INSEE snapshot contract, independently published dataset contracts, browser-data catalog, and visual contract. Story 1.5b is the direct prerequisite for Story 1.6: it migrates Story 1.4/1.5a outputs to the independent package architecture, proves neutral conformance and snapshot-only replay, preserves the explicit live INSEE test, and removes exemplar knowledge from shared runtime. Report design and Claude Design begin only after that gate passes. Production report performance is re-measured during final deployment work against the established budget: cold page load at most 5 seconds and first readable visual at most 10 seconds.
