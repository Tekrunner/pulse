# Epic 1 Context: Open and Trust the First Public Report

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the first complete public French macroeconomic report: Yann can quickly read and explore current indicators, verify their provenance and represented periods, and see whether every expected source and pipeline stage is healthy. The public pipeline must acquire INSEE data automatically or on demand, preserve immutable history, rebuild reproducibly from committed snapshots, and publish a verified static site while making suspect, failed, or stale states visible.

## Stories

- Story 1.1: Establish a Reproducible Pulse Workspace
- Story 1.2: Prove the Portable Report Experience
- Story 1.3: Select, Acquire, and Archive the First INSEE Source
- Story 1.4: Build and Publish the First Independent Dataset
- Story 1.5: Render Real Data Through the Visual Contract
- Story 1.5a: Expand the INSEE CPI Dataset for Category Analysis
- Story 1.5b: Establish Independent Source and Dataset Package Boundaries
- Story 1.6: Compose and Explore the French Macroeconomic Report
- Story 1.7: See Pipeline Health and Data Freshness
- Story 1.8: Run INSEE Acquisition and Downstream Builds Automatically and On Demand
- Story 1.9: Build and Deploy a Reproducible Public Site

## Requirements & Constraints

Use locked Python 3.13/uv and Node 24/npm environments with frozen CI installs. A clean clone must rebuild every public dataset and the site from committed snapshots without network acquisition, prior warehouse state, private data, generated site files, or author-machine state. Public raw snapshots and published dataset Parquet are canonical repository artifacts; Parquet payloads use Git LFS, and consumers must reject unresolved pointer stubs.

The INSEE source declaration owns stable identity, acquisition method, independent cadence, expected publication advancement, licence, attribution, faithful decoding, assertions, and its snapshot contract. Each logical scheduled or manual observation has an opaque acquisition ID reused by retries: matching retries no-op and conflicting content fails. Every valid acquisition produces an immutable snapshot; later observations receive new IDs even when bytes match. Missed schedules must be recoverable without repairing mutable warehouse state.

Datasets are independently discovered packages that declare snapshot dependencies and own analytical typing, semantics, dbt models/tests, metadata, and report-facing Parquet. They build from snapshots alone, never invoke acquisition or import source-package code. Generic orchestration discovers affected datasets from declarations; source workflows contain no dataset IDs, columns, transformations, or publication paths. Contract-compliant but assertion-failing output is published as suspect; failed decoding or transformation retains the last usable dataset.

The first report analyzes comparable INSEE Base-2025 consumer-price series for headline CPI, food, energy, actual rents paid, and annual basket weights. Do not substitute IPCH, incompatible bases or populations, or property-sale measures. Derived component calculations must document and test their formula, alignment, coverage, rebasing, and limits, and must not be presented as official INSEE contributions or causal claims.

The report is a standing, pre-composed analysis with at least three purpose-built visuals. Report declarations own identity, route, visibility, dataset/column lineage, visual slots, and exploration choice. Visuals are authored against declared-schema fixtures, consume validated rows plus display/provenance inputs, return DOM/SVG, and do not use chart libraries. Optional exploration runs parameterized queries locally through DuckDB-WASM while the default experience remains complete without interaction.

Status must cover every declared source and dataset pipeline, distinguish `not-run`, `succeeded`, `suspect`, `stale`, and `failed`, and use precedence `failed > suspect > stale > succeeded`. Freshness follows the source's publication-advancement deadline rather than fetch cadence. Homepage and report status show safe diagnostics, latest usable output, represented period, assertion state, and lineage impact without leaking credentials, private paths, upstream content, or stack traces.

## Technical Decisions

Pulse is a pipes-and-filters system with immutable, versioned boundaries: acquire → snapshot → independent transform/test → dataset Parquet/status → static site → browser query/render. Versioned Pulse JSON manifests are the sole inter-stage API and are strictly validated; unsupported major versions and identity, route, table, or contract collisions fail generation. Dataset-private staging, DuckDB databases, and generated site output are disposable.

Observable Framework is the v1 shell behind a portability seam. Portable application modules use explicit imports and manifest-relative URLs, with no Observable globals or generated-path coupling. The shell owns one shared single-threaded DuckDB-WASM worker/connection. Reports own SQL, routing, exploration state, annotations, and provenance; the data client alone resolves datasets and normalizes startup/query errors; each visual slot isolates loading, empty, query, schema, and render states.

One repository-local Pulse CLI is the high-level API for local use, agents, and thin GitHub Actions adapters. Each source has its own scheduled and manually dispatchable workflow at a non-peak minute. Computation may run concurrently, but all default-branch mutations pass through one shared-concurrency repository writer that begins from the latest default branch and commits one atomic artifact-scoped change set. Site builds never mutate the default branch, use a separate latest-wins group, verify one immutable artifact, enforce the GitHub Pages size ceiling, and deploy that exact artifact.

Ordinary verification is offline and fixture-based. Separate source and dataset conformance suites plus a neutral synthetic pair prove generic discovery and orchestration; the scheduled INSEE run supplies the explicit live integration gate. Workflow credentials and write permissions are least-privilege, and normal automation, archive, and hosting usage must remain within provider free-tier constraints.

## UX & Interaction Patterns

Use the dark-default semantic theme and shared visual-language contract with restrained motion. Reports, visuals, exploration controls, navigation, and health states must meet WCAG 2.2 AA through semantic structure, keyboard operation, visible focus, non-color-only distinctions, contrast, zoom/reflow, adequate targets, reduced motion, and accessible data equivalents. Layouts remain readable in narrow smartphone landscape, with indicator, represented period, provenance, and essential operation preserved. Degraded states are prominent while healthy states remain quiet; one failed slot or status component must not disable sibling visuals or report navigation.

## Cross-Story Dependencies

The locked workspace and portable browser pilot gate later source, dataset, visual, and site work. The INSEE snapshot feeds the independent headline and category dataset contracts; Story 1.5b establishes the package boundaries and consumer-schema migration required before report composition. Pipeline health consumes source/dataset manifests and declared lineage. Automated acquisition triggers generic downstream builds and serialized publication, whose committed artifacts feed the mutation-free site build. Final deployment rechecks the cold-load and first-readable-visual performance budget established by the pilot.
