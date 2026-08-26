# Epic 1 Context: Open and Trust the First Public Report

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the first complete, public French macroeconomic report: a reader can open it, understand current indicators, explore where enabled, inspect provenance and represented dates, and see trustworthy health/freshness status. The complete public pipeline must acquire INSEE data automatically or on demand, preserve immutable snapshots, rebuild and test source data reproducibly, publish static browser-readable artifacts, and expose failures or suspect/stale output without concealing them.

## Stories

- Story 1.1: Establish a Reproducible Pulse Workspace
- Story 1.2: Prove the Portable Report Experience
- Story 1.3: Select, Acquire, and Archive the First INSEE Dataset
- Story 1.4: Transform and Publish the First INSEE Dataset
- Story 1.5: Render Real Data Through the Visual Contract
- Story 1.6: Compose and Explore the French Macroeconomic Report
- Story 1.7: See Pipeline Health and Data Freshness
- Story 1.8: Run the INSEE Pipeline Automatically and On Demand
- Story 1.9: Build and Deploy a Reproducible Public Site

## Requirements & Constraints

The first implementation establishes locked Python 3.13/uv and Node 24/npm environments with frozen installs and smoke coverage for the CLI, dlt, dbt-duckdb, DuckDB, Observable, and DuckDB-WASM. The external-Parquet mechanism must prove dbt `ref()` plus passing and failing `not_null` tests before source work relies on it.

The INSEE source is discoverable from its own declaration and vertical slice, with stable identity, acquisition method, cadence, expected publication advancement, licence, and attribution. Public runs are independently scheduled, idempotent, retryable, and manually triggerable. Each observation receives an opaque acquisition ID; retries reuse it, while later observations receive new IDs. Every acquisition is archived immutably before transformation, and the source slice is fully rebuilt from committed snapshots. Undecodable data remains archived and does not replace the last usable dataset; contract-compliant assertion failures publish as suspect and do not block unrelated work.

Published datasets are wide, typed, single-source Parquet with machine-readable dataset/column/indicator metadata. Versioned manifests are the only inter-stage API and must validate strictly, including lineage, hashes, represented period, URLs, visibility, and sanitized diagnostics. The browser receives plain rows through the visual contract; no rendering layer may use a chart/visualization library. Static output must work locally and under a repository subpath with same-origin Parquet, without special headers. Status must distinguish not-run, succeeded, suspect, failed, and stale, state generation time and validity deadline, and retain visible failure when a replacement site cannot be published.

## Technical Decisions

Pulse is a pipes-and-filters system separated by immutable, versioned artifacts: acquire → snapshot → decode/landing Parquet → dbt transform/test → published Parquet/manifests → static site → browser query/render. Landing files, DuckDB databases, and generated site output are disposable. dlt owns access, faithful decoding, and landing; dbt-duckdb owns analytical typing, semantics, tests, and publication. Use Git LFS for public raw snapshots and reject pointer stubs before decoding.

Observable Framework is the provisional v1 shell only after its repository-subpath, nested reload, same-origin query, accessibility, privacy, clean-clone, and performance pilot passes. Keep portable modules free of Observable globals and generated paths. The shell owns one shared DuckDB-WASM worker/connection; reports own SQL, exploration, provenance, routing, and annotations; visuals know only their declared rows/display/provenance inputs and return DOM/SVG. Each visual slot isolates loading, no-row, query, schema, and render errors.

All default-branch mutations pass through one serialized repository writer; source workflows are independent and site builds are mutation-free. A single repository-local Pulse CLI is used by local runs, agents, and thin Actions workflows.

## UX & Interaction Patterns

Use dark-default semantic theme tokens, restrained motion with reduced-motion support, and purpose-built responsive DOM/SVG visuals. Reports remain readable in narrow smartphone landscape and expose indicator, represented period, provenance, and status context. Meet WCAG 2.2 AA: semantic structure, keyboard operation, visible focus, non-color-only states, contrast, zoom/reflow, adequate targets, and an accessible data equivalent. Exploration is an explicit report opt-in; non-exploring reports remain fully pre-composed.

## Cross-Story Dependencies

Story 1.1 gates all feature work, especially the dbt external-Parquet publication decision and browser substrate. Story 1.2 establishes the portable visual/data-client and site pilot that Stories 1.5–1.6 consume. Stories 1.3–1.4 establish the immutable INSEE snapshot, transformation, tests, metadata, and published dataset consumed by the visual and report stories. Story 1.7 projects source and site health used by the homepage and reports. Story 1.8 operationalizes the source workflow and repository writer; Story 1.9 aggregates, verifies, and deploys the exact static artifact, so its site status can expose failures from earlier stages.
