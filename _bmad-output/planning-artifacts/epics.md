---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-pulse-2026-08-07/prd.md
  - _bmad-output/planning-artifacts/prds/prd-pulse-2026-08-07/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-pulse-2026-08-11/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-pulse-2026-08-11/EXPERIENCE.md
---

# pulse - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for pulse, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: A source can be declared with stable identity, acquisition method, fetch cadence, expected publication advancement, licence, and attribution; declarations are discovered without a central registry.

FR2: Each source can run on its own ingestion cadence, and changing cadence requires scheduling changes only.

FR3: Public sources are acquired automatically on schedule and on demand, for one source or the whole pipeline, through idempotent runs that recover from a missed schedule and can update the default branch.

FR4: Private source files can be supplied through a known local-only location and processed without entering the public repository or leaving the local machine.

FR5: Every acquisition creates an immutable pre-transformation snapshot; file sources retain original bytes, other sources retain faithful Parquet, and public snapshots are committed and cloneable.

FR6: Every source slice can be rebuilt fully from committed raw snapshots, and a whole-pipeline run can rebuild all slices without migrating or incrementally mutating a persisted warehouse.

FR7: Declared transformations build wide, properly typed, single-source datasets from snapshots, using the latest usable source publication in v1.

FR8: Every dataset, column, and indicator has machine-readable documentation including unit, definition, source, licence, and attribution, and missing documentation is detectable.

FR9: Datasets have data tests and sources have assertions for schema, row plausibility, and release-calendar-aware freshness; assertion failures are visible without halting unrelated work.

FR10: Every visual receives plain rows and registers on a report through one documented, versioned data-interface contract that defines loading, no-row, query-error, schema-incompatibility, and render-error behavior and detects consumer schema breaks.

FR11: A visual can be authored and tested against declared-schema fixture rows before the warehouse exists, then wired to a real query without changing its rendering logic.

FR12: No visual or rendering layer imports or calls a chart or visualization library or selects from a chart-type vocabulary.

FR13: Cross-visual conventions live in one revisable visual-language contract, while shared render-time roles such as color, typography, spacing, focus, state, and motion are implemented as reusable theme tokens.

FR14: Adding a new kind of data or visual may extend the system but does not require reinventing it or breaking existing visuals.

FR15: A report declares its visuals and arrangement and can render visuals of arbitrary design.

FR16: Annotations are stored and joined as data, never hardcoded as rendering coordinates, so new annotations appear without visual-code changes.

FR17: Source privacy propagates through dataset and report lineage; public builds positively include public artifacts only, and an explicit report setting may tighten but never weaken privacy.

FR18: The system produces immutable static output that is served locally with one command and deployed under the repository subpath to static hosting without special headers, with DuckDB-WASM querying same-origin Parquet in the browser.

FR19: The homepage provides report navigation and shows every expected source and site pipeline's latest canonical stage state, freshness, assertion status, and safe diagnostic information.

FR20: Every report states the date or represented period of the data it displays and exposes its provenance/status context.

FR21: Contract-compliant but assertion-failing data is published as suspect and marked through lineage while unrelated sources, datasets, reports, and site work continue; undecodable data does not replace the last usable dataset.

FR22: Repository-owned workflows define how an agent adds a source, indicator, visual, or report and changes a dataset schema without reading unrelated code.

FR23: Extension work repeats a stable file-layout, naming, and wiring shape while calling shared implementation instead of duplicating logic.

FR24: Every extension workflow starts from neutral templates whose contracts are validated by fixtures and at least one complete working implementation; working implementations are conformance evidence, never scaffolds to copy.

FR25: A report may opt into parameterized, serverless in-browser exploration through its declaration while remaining fully pre-composed when it does not opt in.

FR26: The status surface identifies its own generation time and validity deadline, distinguishes not-run from succeeded, and becomes visibly stale when a failed pipeline cannot replace the deployed site.

### NonFunctional Requirements

NFR1: Agent legibility is the ease metric: agents must be able to follow concise repository workflows, match established shapes, call shared implementation, and recognize rare escape hatches.

NFR2: A clean clone of the public repository must reproduce the warehouse and public site end to end without private data or author-machine state.

NFR3: Private data and reports must be structurally unable to enter public output; privacy must not depend on a person remembering an exclusion.

NFR4: Normal hosting, automation, archive, and delivery operation must stay within provider free tiers, with usage observed at provider limits.

NFR5: No external consumer depends on service continuity; the system may break, change schema, or be rebuilt without uptime or migration guarantees.

NFR6: Opening a report must be fast enough to become habitual; the Observable pilot must measure cold load and time to first readable visual and establish the numeric budget before the substrate is accepted.

### Additional Requirements

- Implement the system as pipes and filters separated by immutable, versioned artifact boundaries: acquire, snapshot, decode/land, transform/test, publish data/status, build site, deploy, query, and render.
- Keep landing Parquet, DuckDB databases, and generated site output disposable; prohibit downstream stages from reaching into another tool's mutable state.
- Organize each source as a discoverable `sources/<source-id>/` vertical slice owning its declaration, dlt reader, decode/schema contract, assertions, dbt models, fixtures, and tests.
- Assign faithful source access and decoding to dlt; assign analytical typing, semantics, tests, disposable DuckDB materialization, and published Parquet exclusively to dbt-duckdb.
- Gate dbt-duckdb `external` publication behind an exemplar smoke test proving `ref()` and passing/failing `not_null` tests against external Parquet; if it fails, select one shared fallback before source work proceeds.
- Give every logical acquisition one opaque platform-independent acquisition ID; retries reuse it, identical retries no-op, conflicting content for the same ID fails, and later observations receive new IDs even when bytes match.
- Run one independently scheduled, idempotent workflow per source and a separate site aggregation workflow, so one source's failure or cadence cannot block another.
- Make versioned Pulse JSON manifests the sole inter-stage API, with UTF-8, well-known filenames, schema IDs, semantic versions, strict validation, and rejection of unsupported major versions.
- Implement immutable `snapshot.json`, linked `landing.json` and `dataset.json`, compiled `browser-data.json`, `report-catalog.json`, source/site pipeline status, and a versioned sanitized error envelope with the fields defined by AD-4.
- Use globally unique dataset IDs `<source-id>/<dataset-id>`, visual-slot IDs `<report-id>/<slot-id>`, source pipeline IDs `source/<source-id>`, reserved `system/*` IDs, unique routes, and unique logical DuckDB table names; fail generation on collisions.
- Resolve report datasets only through IDs and the browser manifest URL; never derive Parquet paths from the current document route.
- Make each report declaration the canonical owner of stable identity, route, requested visibility, dataset/column dependencies, visual slots, and exploration choice; compiled catalogs own resolved visibility and lineage projections.
- Compute suspect impact from declared dataset/column lineage and conservatively report possibly affected when column-level precision is unavailable.
- Discover private inputs only from ignored `private/inbox/<source-id>/`; prohibit source code from reading arbitrary paths, keep private builds in ignored roots, and scan public artifacts as defense in depth.
- Use Observable Framework as the provisional v1 shell only after a pilot proves repository-subpath hosting, nested reload, same-origin Parquet querying, keyboard behavior, distinct engine/query failures, a nontrivial interactive DOM/SVG visual, clean-clone reproduction, privacy, performance, and portability to minimal Vite.
- Keep portable application modules free of Observable globals, implicit imports, generated paths, reactivity protocols, and lifecycle coupling; the same data client and visual must move unchanged to a minimal Vite shell.
- Let the application shell own one shared DuckDB-WASM worker/connection per browser session; reports borrow it, request cancellation cannot terminate shared resources, and only the shell disposes it at unload.
- Let reports own parameterized SQL, exploration/cross-visual state, annotations, provenance, and routing; visuals know none of SQL, DuckDB, Parquet paths, routes, or framework protocols and return DOM/SVG.
- Define visual contract major `v1` with declared-schema fixtures, rows/display/provenance inputs, registration, and consumer validation; require atomic migration or an application compatibility adapter for breaking majors.
- Isolate loading and all failure/empty states per visual slot so sibling visuals remain usable; escalate only shared engine or delivery failures to report scope.
- Provide one repository-local Pulse CLI as the sole high-level automation API for source/whole runs, replay, profiles, verification, site build, and local serving; local use, agents, and thin Actions workflows call it identically.
- Serialize every default-branch mutation through one shared-concurrency repository-writer job starting from the current default branch; keep site builds mutation-free and in a separate latest-wins concurrency group.
- Provide an offline source-conformance suite covering deterministic decode, manifests and semantic metadata, schema drift, raw replay, release-calendar freshness, and profile privacy; use scheduled acquisition as the live integration test.
- Provide visual contract tests and Playwright coverage for a multi-visual nested report, isolated slot failure, reload, keyboard/accessibility behavior, DuckDB-WASM startup/query failures, and public-artifact scanning.
- Lock Python 3.13 with uv/`uv.lock` and Node 24 LTS with npm/`package-lock.json`; the first implementation change creates both lockfiles and passes clean-install CLI, dbt, DuckDB, and Observable smoke tests before ratifying versions.
- Use frozen installs in CI and make dependency upgrades explicit tested changes, never part of ingestion.
- Store public raw snapshots as Git LFS objects; raw-consuming jobs fetch only their source's objects, materialize them, and reject pointer stubs before decoding.
- Keep generated site files off the default branch, verify one exact immutable site artifact, enforce the GitHub Pages 1 GB artifact ceiling, and deploy that exact artifact with browser Parquet under the same site root.
- Use the single-threaded DuckDB-WASM EH bundle without special headers; prohibit `coi-serviceworker` unless profiling later justifies a host/threading architecture change.
- Implement `site/design/tokens.css` and `site/design/visual-language.md` as the application-owned presentation contract, beginning with dark-default semantic theme roles and restrained motion.
- Require every visual to satisfy WCAG 2.2 AA through semantic structure, keyboard operation, visible focus, non-color-only states, contrast, zoom/reflow, adequate targets, reduced motion, and an accessible data equivalent.
- Make visuals container-responsive and readable in narrow smartphone landscape; advanced controls may simplify, but the indicator and provenance remain available.
- Use stable lowercase kebab-case identities, UTC ISO 8601 machine timestamps, distinct source-data/acquisition/build times, Parquet for decoded and report-facing data, and data-driven annotations.
- Record every observed source schema; permit and report compatible additions, flag missing required fields and incompatible types, and fail only when faithful decoding is impossible.
- Keep credentials out of declarations, manifests, logs, repository artifacts, and the browser; inject them only through the executing profile/environment.
- Target roughly 5–50 MB same-origin browser Parquet initially; defer partitioning, compression, and row-group tuning until measured against real datasets.
- No project starter template is specified. The architecture's structural seed and neutral workflow templates establish the project shape; complete working implementations validate those templates without becoming scaffolds to copy. The first implementation work must create the runtime locks and pass the substrate/dbt compatibility gates before feature slices rely on them.

### UX Design Requirements

No actionable UX design requirements were present in the selected UX contract. `DESIGN.md` and `EXPERIENCE.md` both contain frontmatter only and are marked `in-progress`. Actionable presentation, interaction, responsive, and accessibility constraints extracted from the final architecture are recorded under Additional Requirements above.

### FR Coverage Map

FR1: Stories 1.3 and 2.2 - Declare discoverable sources with complete acquisition and attribution metadata through the first implementation and neutral workflow.
FR2: Stories 1.3, 1.8, and 2.2 - Declare and automate independent source cadences and publication schedules.
FR3: Story 1.8 - Acquire public data automatically and on demand through idempotent execution.
FR4: Story 3.1 - Ingest private files through the controlled local-only source path.
FR5: Stories 1.3 and 3.1 - Preserve public and private acquisitions as immutable raw snapshots.
FR6: Stories 1.4 and 1.9 - Rebuild source slices and the complete public system from committed raw snapshots.
FR7: Story 1.4 - Produce a wide, typed, single-source dataset through declared transformations.
FR8: Stories 1.4 and 2.3 - Publish and safely evolve machine-readable dataset, column, indicator, licence, and attribution metadata.
FR9: Stories 1.4, 1.7, and 2.2 - Test transformed data and evaluate source-specific plausibility and release-calendar-aware freshness.
FR10: Stories 1.5 and 2.4 - Establish, use, and extend the versioned visual data-interface contract and defined slot states.
FR11: Stories 1.5 and 2.4 - Author and test visuals against declared-schema fixtures before wiring real queries.
FR12: Stories 1.2, 1.5, 1.6, and 2.4 - Deliver purpose-built DOM/SVG visuals without a chart or visualization library.
FR13: Story 2.1 - Maintain revisable visual-language guidance and reusable semantic design tokens.
FR14: Stories 2.2, 2.3, 2.4, and 2.5 - Extend data, schemas, visuals, and reports without reinventing the system or breaking existing output.
FR15: Stories 1.6 and 2.5 - Compose reports declaratively from visuals of arbitrary design.
FR16: Story 2.5 - Store, join, add, and change report annotations as data without modifying visual rendering code.
FR17: Stories 3.2 and 3.3 - Propagate source privacy through lineage and prove public inclusion cannot weaken it.
FR18: Stories 1.2 and 1.9 - Build, serve, verify, and deploy static output with same-origin browser queries.
FR19: Story 1.7 - Show navigation, freshness, assertions, and canonical pipeline-stage state on the homepage.
FR20: Stories 1.6 and 1.7 - Show represented data periods and provenance/status context on reports.
FR21: Stories 1.4, 1.7, and 1.8 - Publish and mark usable suspect data while isolating failures and retaining the last usable dataset.
FR22: Stories 2.2, 2.3, 2.4, and 2.5 - Define agent workflows for sources, indicators, schema changes, visuals, and reports.
FR23: Stories 2.2, 2.3, 2.4, and 2.5 - Repeat neutral structure while reusing shared contracts and implementation.
FR24: Stories 2.1, 2.2, 2.3, 2.4, and 2.5 - Start from neutral templates and validate them with fixtures and complete working implementations without copying those implementations.
FR25: Story 1.6 - Let a report opt into serverless exploration while retaining its pre-composed default experience.
FR26: Stories 1.7 and 1.9 - Make site status self-dating, state-complete, and visibly stale when replacement fails.

## Epic List

### Epic 1: Open and Trust the First Public Report

Yann can open a deployed French macroeconomic report, read and explore current data, verify its provenance, and see whether every source and pipeline stage is healthy. The complete public pipeline runs automatically, on demand, and reproducibly from immutable snapshots.

**FRs covered:** FR1, FR2, FR3, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR15, FR18, FR19, FR20, FR21, FR25, FR26

### Epic 2: Extend Pulse Through Repeatable Agent Workflows

Yann can use coding agents to add sources, indicators, visuals, reports, and data-driven annotations—or change a dataset schema—by following stable workflows and neutral templates validated by complete working implementations without reinventing the system or breaking existing output.

**FRs covered:** FR13, FR14, FR16, FR22, FR23, FR24

### Epic 3: Use Private Data Without Risking Public Exposure

Yann can ingest local private files and produce private reports while structural lineage and build-profile rules prevent private data or derived artifacts from entering public output.

**FRs covered:** FR4, FR17

## Epic 1: Open and Trust the First Public Report

Yann can open a deployed French macroeconomic report, read and explore current data, verify its provenance, and see whether every source and pipeline stage is healthy. The complete public pipeline runs automatically, on demand, and reproducibly from immutable snapshots.

### Story 1.1: Establish a Reproducible Pulse Workspace

As a builder,
I want to install and verify Pulse from a clean clone using locked toolchains,
So that every subsequent feature is built on a reproducible and proven foundation.

**Acceptance Criteria:**

**Given** a clean clone with the documented Python 3.13 and Node 24 prerequisites
**When** the documented installation commands are run
**Then** Python dependencies install from `uv.lock` and Node dependencies install from `package-lock.json` using frozen installs
**And** no undeclared global project dependency is required.

**Given** the installed workspace
**When** the documented Pulse verification command is run
**Then** the repository-local Pulse CLI starts successfully and reports actionable failures for missing or incompatible prerequisites
**And** its command structure can be extended by later stories without introducing a second automation entry point.

**Given** the locked Python environment
**When** the data-tool smoke suite runs
**Then** compatible versions of dlt, dbt-core, dbt-duckdb, and DuckDB load successfully
**And** dbt configuration, parsing, building, and testing complete against an isolated fixture project.

**Given** an external Parquet model referencing an upstream dbt model
**When** the publication smoke suite runs
**Then** dbt-duckdb materializes the model as Parquet
**And** a downstream `ref()` resolves it correctly
**And** a passing `not_null` test succeeds
**And** an intentionally invalid fixture proves that a failing `not_null` test is detected.

**Given** the external-materialization smoke test does not satisfy all required behaviors
**When** the story is evaluated for completion
**Then** source implementation cannot proceed on that mechanism
**And** one shared fallback must be approved and recorded through an architecture update before this story can be accepted.

**Given** the locked Node environment
**When** its baseline verification runs
**Then** Observable Framework and DuckDB-WASM can be imported at their locked versions
**And** no chart or visualization library is directly adopted or invoked by Pulse code.

**Given** the repository's initial structure
**When** the workspace is inspected
**Then** it contains only the runtime and configuration needed by this story
**And** source, dataset, report, and visual artifacts are created only by the later stories that need them.

**Given** the documented clean-install procedure
**When** it runs in continuous integration
**Then** frozen installation and all Story 1.1 smoke checks pass without private data, author-machine state, network-fetched source data, or generated files committed to the repository
**And** dependency or compatibility failures cause a non-zero result with a useful diagnostic.

### Story 1.2: Prove the Portable Report Experience

As a reader,
I want a fast, accessible report experience that works from Pulse's real deployment path,
So that the chosen site framework is proven before the product depends on it.

**Acceptance Criteria:**

**Given** the locked workspace from Story 1.1 and a representative fixture Parquet file
**When** the documented local-serve command is run
**Then** one command starts an Observable-based report at a nested route
**And** DuckDB-WASM queries the same-origin fixture using the single-threaded EH bundle without special HTTP headers.

**Given** the pilot is built for Pulse's real repository subpath
**When** the built homepage and nested report are opened directly or reloaded
**Then** routes, scripts, workers, manifests, and Parquet URLs resolve correctly
**And** no URL is incorrectly derived from the current document route.

**Given** the application shell initializes browser data access
**When** the reader opens and navigates within the pilot
**Then** the shell creates one shared DuckDB-WASM worker and connection for the page session
**And** report code borrows those resources without disposing them
**And** only the application shell disposes them on page unload.

**Given** a nontrivial interactive visual authored against fixture rows
**When** it renders in the Observable report
**Then** it returns ordinary DOM or SVG through explicit application-owned imports
**And** it uses no chart or visualization library, Observable global, implicit generated path, SQL, DuckDB API, Parquet path, or routing API.

**Given** the same data client and visual modules
**When** they are exercised in a minimal Vite portability harness
**Then** both modules run unchanged
**And** framework-specific adaptation remains outside their implementations.

**Given** normal, loading, empty, DuckDB-WASM startup-failure, and query-failure fixtures
**When** each pilot state is exercised
**Then** the reader sees distinct, useful states rather than blank or broken output
**And** diagnostics exposed in the page contain no secrets or unsafe implementation details.

**Given** keyboard-only operation and assistive-technology semantics
**When** the reader navigates and operates the pilot
**Then** interactive elements have semantic structure, accessible names, logical focus order, visible focus, and non-color-only state cues
**And** the visual provides an accessible data equivalent.

**Given** desktop, zoomed, and narrow smartphone-landscape viewports
**When** the pilot is rendered
**Then** its content reflows without losing the indicator or provenance
**And** targets remain operable, contrast meets WCAG 2.2 AA, and motion respects `prefers-reduced-motion`.

**Given** a clean production build under measured cold-cache conditions
**When** the nested report is loaded and its first visual becomes readable
**Then** cold-load and time-to-first-readable-visual measurements are recorded reproducibly
**And** a numeric acceptance budget is added to the architecture based on the results before Observable is accepted.

**Given** a clean clone with no private data or author-machine state
**When** the pilot's install, build, browser tests, portability check, and public-artifact scan run
**Then** they complete using frozen dependencies
**And** the resulting static artifact contains no private paths, credentials, build residue, or undeclared remote data dependency.

**Given** any mandatory pilot or portability criterion fails
**When** Story 1.2 is evaluated for completion
**Then** report implementation is blocked
**And** the site-substrate decision is reopened through an architecture update without automatically substituting Evidence.

### Story 1.3: Select, Acquire, and Archive the First INSEE Dataset

As a builder,
I want to acquire authoritative INSEE data for the first French macroeconomic report,
So that Pulse begins with a relevant, traceable, and permanently replayable public source.

**Acceptance Criteria:**

**Given** the standing questions intended for the first French macroeconomic report
**When** candidate INSEE datasets and access methods are evaluated
**Then** the selected dataset supplies the indicators needed for the first report
**And** the selection rationale records authority, coverage, granularity, stability, format, access constraints, licence, attribution, fetch cadence, and expected publication schedule
**And** the decision is scoped to this report rather than treating INSEE as the default source for future reports.

**Given** the selected INSEE dataset
**When** its source package is created
**Then** it follows the `sources/<source-id>/` vertical-slice structure with a stable lowercase kebab-case ID
**And** its declaration records public visibility, acquisition method, fetch cadence, expected publication advancement, licence, attribution, and source identity
**And** it is discovered without adding an entry to a central registry.

**Given** an invalid or incomplete source declaration
**When** source discovery and validation run
**Then** missing identity, cadence, publication schedule, licence, attribution, or acquisition configuration causes a clear validation failure
**And** duplicate source IDs are rejected.

**Given** a valid INSEE source declaration
**When** the documented one-source Pulse CLI command is run
**Then** dlt performs the source-specific acquisition through the repository's shared runtime
**And** the acquisition path does not perform analytical typing, semantic transformation, or report-specific processing.

**Given** a successful logical acquisition
**When** Pulse archives the result
**Then** it assigns one opaque, platform-independent acquisition ID and records UTC acquisition time separately from the source-data date
**And** a non-file/API response is preserved as faithful Parquet before analytical transformation
**And** an immutable `snapshot.json` records the source, acquisition, timestamps, original URLs, SHA-256 hashes, observed-schema hash, decoder/tool versions, licence, and attribution.

**Given** the same logical acquisition is retried with the same acquisition ID and identical artifact hashes
**When** the archive writer evaluates it
**Then** the operation succeeds as a no-op without creating or modifying a snapshot
**And** the existing artifact remains byte-for-byte unchanged.

**Given** the same acquisition ID is retried with different content
**When** the archive writer evaluates it
**Then** the operation fails without overwriting the existing snapshot
**And** the diagnostic identifies an acquisition-integrity conflict without exposing secrets.

**Given** a later logical acquisition whose bytes match an earlier acquisition
**When** it receives a new acquisition ID
**Then** a distinct observation is preserved with its own manifest and acquisition time
**And** content equality does not erase the observation history.

**Given** a public snapshot produced by the source
**When** repository storage rules are checked
**Then** raw data objects are tracked through Git LFS
**And** jobs consuming them materialize the required objects and reject unresolved LFS pointer stubs
**And** credentials, tokens, and unsafe response diagnostics are absent from committed artifacts.

**Given** an upstream, transport, decoding, or contract failure during acquisition
**When** the CLI exits
**Then** no partial artifact is accepted as a compliant snapshot
**And** the command returns a non-zero result with a sanitized, actionable diagnostic
**And** any previously archived snapshots remain unchanged.

**Given** the INSEE source fixture and recorded response contract
**When** offline source tests run
**Then** acquisition and snapshot creation are deterministic without contacting INSEE
**And** a separately identified live acquisition can verify upstream integration without becoming a prerequisite for ordinary CI.

### Story 1.4: Transform and Publish the First INSEE Dataset

As a builder,
I want to transform archived INSEE snapshots into a tested and documented dataset,
So that reports can consume trustworthy analytical data without depending on mutable pipeline state.

**Acceptance Criteria:**

**Given** the committed INSEE archive and no existing landing files, DuckDB database, or published dataset
**When** the documented source-replay command runs
**Then** it reconstructs the complete current INSEE dataset slice from the raw archive alone
**And** it does not depend on dlt state, a prior warehouse, a prior publication, or author-machine state.

**Given** a selected INSEE snapshot
**When** the decode stage runs
**Then** dlt produces faithful landing Parquet without applying analytical semantics
**And** a validated `landing.json` references the source and immutable snapshot
**And** the original snapshot remains unchanged.

**Given** an observed source schema with compatible additions
**When** decoding and contract validation run
**Then** the complete observed schema is recorded and the compatible additions are reported
**And** faithful decoding may continue without silently dropping the added data.

**Given** missing required fields, incompatible types, or content that cannot be decoded faithfully
**When** decoding runs
**Then** the stage fails with a versioned sanitized diagnostic
**And** no invalid landing or dataset artifact is accepted
**And** any previously published usable dataset remains selected.

**Given** valid landing Parquet
**When** dbt builds the INSEE models
**Then** dbt-duckdb alone owns analytical typing, semantics, tests, disposable DuckDB materialization, and external Parquet publication
**And** the published dataset is wide, properly typed, and derived from exactly one source
**And** no tall or long observations table is published as the report-facing dataset.

**Given** the transformed dataset definition
**When** metadata validation runs
**Then** every model and column has a machine-readable description
**And** every indicator records its unit, definition, source, licence, and attribution
**And** publication fails when required semantic metadata is absent.

**Given** valid transformation output
**When** publication runs
**Then** it emits report-facing Parquet and a strictly validated `dataset.json` linked to the landing artifact and source snapshot
**And** the manifest records the globally unique `<source-id>/<dataset-id>`, unique logical DuckDB table name, contract version, schema, content hash, represented period, Parquet location, semantic metadata, and public visibility
**And** identity or table-name collisions fail publication.

**Given** source-specific dbt tests and assertions
**When** they evaluate the dataset
**Then** required schema, typing, nullability, domain plausibility, row-count behavior, and release-calendar-aware freshness are tested
**And** an annual or otherwise slow-moving indicator is not marked suspect merely because a fetch occurred before its next expected publication.

**Given** a contract-compliant dataset whose domain or freshness assertion fails
**When** publication completes
**Then** the new dataset remains usable and is published with a structured suspect result
**And** the failed checks and affected columns are recorded for later lineage projection
**And** unrelated source processing is not blocked.

**Given** an undecodable or contract-invalid new snapshot
**When** the source slice is rebuilt
**Then** the failed attempt does not replace the last successfully derived dataset
**And** if no usable dataset has ever existed, no report-facing dataset is selected.

**Given** the same committed archive and locked toolchain
**When** disposable build outputs are deleted and the source slice is rebuilt repeatedly
**Then** the resulting analytical rows, schema, semantic metadata, and content hashes are equivalent
**And** differences in execution timestamps do not alter dataset identity or content equivalence.

**Given** the INSEE fixture suite
**When** offline source conformance runs
**Then** it covers deterministic decode, manifest completeness, semantic metadata, compatible and incompatible schema drift, raw replay, release-calendar freshness, assertion failure, and public-profile behavior
**And** it does not contact INSEE.

**Given** the initial published Parquet file
**When** its browser-delivery characteristics are inspected
**Then** it is suitable for same-origin delivery and its size is recorded against the initial 5–50 MB target
**And** partitioning, compression, or row-group tuning is introduced only if the measured data requires it.

### Story 1.5: Render Real Data Through the Visual Contract

As a visual author,
I want a stable contract between report queries and purpose-built visuals,
So that a visual can move from fixture data to real INSEE rows without rewriting its rendering logic.

**Acceptance Criteria:**

**Given** the application-owned visual contract
**When** contract major version `v1` is defined
**Then** it specifies declared-schema fixtures, plain row inputs, display configuration, provenance input, registration, cleanup, and consumer-schema validation
**And** visuals do not receive SQL, database connections, Parquet locations, routes, or framework lifecycle objects.

**Given** a visual contract document and its machine-readable schemas
**When** producers and consumers validate them
**Then** supported semantic versions are accepted consistently
**And** unsupported major versions fail with an explicit compatibility error
**And** an individual visual cannot introduce a breaking contract major without an atomic migration or application-owned adapter.

**Given** the published INSEE `dataset.json`
**When** the browser-data catalog is compiled
**Then** it contains the dataset ID, unique logical DuckDB table name, contract version, schema, content hash, represented period, semantic metadata, resolved public visibility, and manifest-relative Parquet URL
**And** catalog generation fails on invalid contracts, identity collisions, table-name collisions, or missing files.

**Given** a report-side request for the INSEE dataset ID
**When** the application data client resolves and registers it
**Then** it uses the browser manifest URL as its base rather than the current page route
**And** it registers the same-origin Parquet file under the catalog's logical table name
**And** it reuses the application shell's shared DuckDB-WASM worker and connection.

**Given** a parameterized report query
**When** the data client executes it
**Then** values are bound as parameters rather than interpolated into SQL
**And** the client returns ordinary rows
**And** request-scoped cancellation stops only that request without terminating shared browser resources.

**Given** declared-schema fixture rows for the first purpose-built visual
**When** the visual is authored and tested before querying real data
**Then** it renders as accessible, container-responsive DOM or SVG
**And** it uses no chart or visualization library
**And** it has no dependency on Observable globals, SQL, DuckDB, storage paths, or routes.

**Given** the authored visual and a real data-client query returning the declared schema
**When** fixture rows are replaced with the query result
**Then** the visual renders without changing its rendering logic
**And** its displayed values and provenance correspond to the published INSEE dataset.

**Given** a query result whose columns or types violate the visual's declared consumer schema
**When** the report slot validates the rows
**Then** rendering is prevented before incorrect or silently empty output appears
**And** the slot identifies the incompatible fields through a safe schema-incompatibility state.

**Given** loading, no-row, query-error, schema-incompatibility, and render-error conditions
**When** each condition is exercised independently
**Then** the visual slot displays a distinct and useful state
**And** failure of that slot does not make sibling content unusable
**And** only a shared engine or data-delivery failure escalates to report scope.

**Given** the visual creates resources outside its returned DOM subtree
**When** its host removes or replaces it
**Then** the visual exposes and executes focused cleanup for those resources
**And** it does not dispose of application-owned DuckDB-WASM resources.

**Given** the visual contract test suite
**When** it runs against fixture and real-query adapters
**Then** it verifies schema compatibility, state isolation, provenance input, cancellation, cleanup, accessibility, responsive behavior, and identical rendering logic across fixture and real rows
**And** it detects consumer breakage caused by a changed dataset schema.

### Story 1.6: Compose and Explore the French Macroeconomic Report

As Yann,
I want a pre-composed report that presents French macroeconomic indicators from several useful angles,
So that I can quickly refresh my understanding and investigate the underlying data when needed.

**Acceptance Criteria:**

**Given** the real published INSEE dataset
**When** report design begins
**Then** Yann and the authoring agent select the standing questions, indicators, figures, precision, comparisons, arrangement, and visual treatments in session against the real data
**And** those content decisions are not inferred from a universal chart vocabulary or predetermined by this story.

**Given** the agreed report design
**When** the French macro report is declared
**Then** `site/reports/<report-id>/report.yml` owns its stable lowercase kebab-case ID, name, nested route, requested public visibility, dataset dependencies, visual slots, column-level lineage, and exploration setting
**And** no Observable page metadata or generated file becomes the canonical owner of those values.

**Given** the report declaration and existing catalog entries
**When** the report catalog is compiled
**Then** it records the stable ID, unique route, requested and lineage-resolved visibility, and last substantive data-or-content change
**And** routine site regeneration does not change the substantive-change value
**And** duplicate report IDs or routes fail the build.

**Given** the selected report questions
**When** its visual modules are authored
**Then** the report contains at least three purpose-built visuals answering distinct questions or showing complementary angles
**And** each visual is authored first against declared-schema fixture rows, returns DOM or SVG, and uses the `v1` visual contract
**And** no chart or visualization library is imported or called.

**Given** the report's visual slots
**When** the report loads real data
**Then** the report owns dataset selection, parameterized SQL, display configuration, exploration state, provenance plumbing, and routing
**And** each visual receives only validated plain rows, display inputs, and provenance inputs
**And** replacing fixture rows with real query results does not change visual rendering logic.

**Given** a normal report load
**When** the first readable visual and remaining visuals appear
**Then** each displays the intended INSEE values with its represented period, indicator definition, unit, source, licence, and required attribution available in context
**And** the report stays within the numeric performance budget established by Story 1.2.

**Given** one visual's loading, no-row, query-error, schema-incompatibility, or render-error state
**When** the rest of the report is usable
**Then** the affected slot explains its own state
**And** sibling visuals and report navigation remain available.

**Given** the report is declared with exploration enabled
**When** Yann opens its exploration controls
**Then** he can issue the supported parameterized exploration queries against the report's dataset without a server round trip or leaving the page
**And** exploration uses the shared data client and DuckDB-WASM session
**And** the pre-composed visuals remain the complete default experience when the controls are unused.

**Given** exploration is enabled but cross-filtering has not been explicitly selected during report design
**When** Yann interacts with a visual or exploration control
**Then** no implicit cross-visual filtering behavior is introduced
**And** the deferred query-topology decision remains open until a report genuinely requires shared interactive state.

**Given** keyboard navigation, assistive technology, zoom, reduced motion, and a narrow smartphone-landscape viewport
**When** the report and exploration controls are used
**Then** every visual and control meets the architecture's WCAG 2.2 AA interaction requirements
**And** content reflows without losing the indicator, provenance, accessible data equivalent, or essential operation.

**Given** the nested report route in local and production-subpath builds
**When** it is opened directly, reached from in-site navigation, or reloaded
**Then** the report, worker, manifests, queries, and same-origin Parquet resolve correctly
**And** no asset or data URL depends on the current document route.

### Story 1.7: See Pipeline Health and Data Freshness

As Yann,
I want pipeline health and data freshness visible on my normal path into reports,
So that I know when figures are current, suspect, unavailable, or backed by a stale site.

**Acceptance Criteria:**

**Given** the discovered source declarations and the single `system/site` declaration
**When** the expected-pipeline catalog is compiled
**Then** it contains the complete set of expected source and site pipeline IDs and names
**And** undeclared runtime jobs or missing expected entries fail validation.

**Given** an attempted INSEE source run
**When** its current status is published
**Then** a strictly validated `pipeline-status.json` records stable identity, cadence, execution time, canonical stage outcomes, latest usable output, and sanitized diagnostics
**And** the canonical source stages are `acquire`, `snapshot`, `decode`, `transform`, `test`, and `publish-data`
**And** the repository writer is represented as part of publication rather than as a separate user-facing pipeline.

**Given** source-stage results
**When** overall source state is derived
**Then** the supported states are `not-run`, `succeeded`, `suspect`, `stale`, and `failed`
**And** display precedence is `failed > suspect > stale > succeeded`
**And** `not-run` is used only before any attempt
**And** a stage that never ran is distinguishable from one that ran successfully.

**Given** a contract-compliant dataset with failed domain or freshness assertions
**When** status and report impact are computed
**Then** the source is marked `suspect` while the new dataset remains the latest usable output
**And** declared dataset and column lineage identifies affected report slots
**And** impact is conservatively shown as unknown or possibly affected when column-level precision is unavailable.

**Given** a snapshot that cannot be decoded or transformed into a contract-compliant dataset
**When** status is published
**Then** the failing stage is marked `failed` with a safe diagnostic
**And** the last successfully derived dataset remains the latest usable output
**And** report freshness reflects that retained dataset rather than the failed observation.

**Given** source data whose represented period has not advanced
**When** freshness is evaluated
**Then** the result uses the source's expected publication schedule and validity deadline rather than fetch cadence alone
**And** data is marked stale only after the declared advancement deadline passes.

**Given** a successful site build and deployment projection
**When** the static artifact is assembled
**Then** `system/site` records generation time, validity deadline, and the canonical `build-site` and `deploy-site` outcomes inside the deployed artifact
**And** the site does not require GitHub Actions APIs or other mutable external state to explain its health.

**Given** a site replacement fails before deployment
**When** the previously deployed site passes its validity deadline
**Then** that site computes and displays itself as stale rather than continuing to claim healthy status
**And** the failed workflow retains its diagnostic in GitHub Actions without attempting to rewrite the old artifact.

**Given** the homepage is opened
**When** navigation and status catalogs load
**Then** it links to every included report and displays every expected source and site pipeline
**And** it shows freshness, stage state, assertion state, last attempt, latest usable output, and safe diagnostic context
**And** healthy state remains quiet while degraded state is perceivable without relying on color alone.

**Given** the French macro report is opened
**When** its provenance and status context renders
**Then** it states the represented data period and source
**And** it shows any stale, suspect, or failed lineage affecting the report or individual visual slots
**And** it does not imply that a failed new observation replaced the retained usable dataset.

**Given** fixture statuses for every state, stage, precedence combination, validity transition, and lineage precision level
**When** status contract, homepage, and report tests run
**Then** state derivation and displayed outcomes match the canonical rules
**And** diagnostics contain no credentials, local private paths, unsafe upstream content, or stack traces.

**Given** keyboard navigation, assistive technology, zoom, and narrow layouts
**When** health information is read and operated
**Then** all states have semantic text, accessible names, visible focus where interactive, sufficient contrast, and non-color-only distinctions
**And** navigation and report access remain usable when a status component fails to render.

### Story 1.8: Run the INSEE Pipeline Automatically and On Demand

As Yann,
I want the INSEE pipeline to refresh itself on schedule and run whenever I request it,
So that the archive grows and the published dataset stays current without manual pipeline work.

**Acceptance Criteria:**

**Given** the INSEE source declaration and repository-local Pulse CLI
**When** its GitHub Actions workflow is generated or validated
**Then** one independently scheduled workflow owns that source through `acquire`, `snapshot`, `decode`, `transform`, `test`, and `publish-data`
**And** the workflow remains a thin adapter that invokes the same CLI used locally rather than reimplementing pipeline logic in YAML.

**Given** the source's declared fetch cadence
**When** the workflow schedule is inspected
**Then** it reflects that cadence at a non-peak minute rather than assuming a system-wide schedule
**And** changing the cadence requires a scheduling change only.

**Given** Yann wants fresh INSEE data before the next schedule
**When** he triggers the source workflow on demand
**Then** the complete INSEE source slice runs without editing its schedule
**And** the invocation uses the same stages, contracts, and validation as a scheduled run.

**Given** a logical scheduled or manual observation
**When** the workflow starts or retries
**Then** the Pulse CLI creates or recovers one stable acquisition ID for that logical observation
**And** a job retry reuses the ID
**And** an identical retry is a no-op while conflicting content for the same ID fails safely.

**Given** a scheduled run is delayed or dropped
**When** the next scheduled or manual run succeeds
**Then** the source returns to its expected current state without repairing an incremental warehouse
**And** no missed scheduler invocation causes loss or corruption of an existing snapshot.

**Given** raw INSEE history is required by a workflow job
**When** the job checks out the repository
**Then** it fetches and materializes only the LFS objects needed for that source
**And** it rejects unresolved pointer stubs before decoding or rebuilding.

**Given** source computation produces a new snapshot, dataset, or current-status projection
**When** default-branch publication begins
**Then** every mutation passes through the single shared-concurrency repository-writer job
**And** that job starts from the current default branch and commits one atomic source-scoped change set
**And** source computation never pushes directly to the default branch.

**Given** concurrent or stale source computations attempt publication
**When** the repository writer serializes them
**Then** each change is applied against the latest default-branch state
**And** unrelated source history is preserved
**And** a conflict fails visibly without overwriting snapshots, datasets, manifests, or status from another run.

**Given** a contract-compliant dataset with failed assertions
**When** the source workflow publishes
**Then** the suspect dataset and source-status projection are committed atomically
**And** the workflow records the assertion outcome without blocking future site aggregation.

**Given** acquisition succeeds but decoding or transformation fails
**When** the source workflow publishes its outcome
**Then** the immutable snapshot and fresh failed-stage status are committed when contract-compliant
**And** the last usable dataset remains selected and unchanged.

**Given** acquisition itself fails before a snapshot can be produced
**When** the workflow completes
**Then** it publishes a sanitized failed-attempt status when safe publication is possible
**And** no partial snapshot or dataset is committed
**And** the workflow exits unsuccessfully with its diagnostic retained by GitHub Actions.

**Given** a successful scheduled acquisition
**When** upstream integration is evaluated
**Then** the run serves as the live integration test and distinguishes upstream-access failure from code or contract failure
**And** ordinary pull-request verification remains offline and fixture-based.

**Given** workflow permissions and environment configuration
**When** the source pipeline runs
**Then** it receives only the credentials and write permissions required for that job
**And** secrets never appear in declarations, logs, manifests, commits, browser artifacts, or diagnostics
**And** normal execution remains within the project's provider free-tier constraints.

**Given** a successful scheduled run commits its source-scoped artifacts to the default branch
**When** repository activity is reviewed
**Then** the commit counts as default-branch activity supporting continued scheduled execution
**And** the design does not depend on a separate keepalive workflow.

### Story 1.9: Build and Deploy a Reproducible Public Site

As a reader or repository visitor,
I want Pulse's public report site to be reproducible and deployed as one verified artifact,
So that I can trust that the hosted experience is exactly what the repository builds.

**Acceptance Criteria:**

**Given** the committed public source declarations, snapshots, datasets, status projections, report declarations, and site code
**When** the documented whole-pipeline command runs from a clean clone
**Then** it rebuilds every public source slice and the complete public site without private data, prior warehouse state, generated site files, or author-machine state
**And** it uses the same Pulse CLI stages and locked dependencies used by source workflows and local development.

**Given** a clean clone with Git LFS installed
**When** the public rebuild begins
**Then** required public snapshot objects are materialized and unresolved pointer stubs are rejected
**And** the repository documentation explains the LFS prerequisite and complete build-and-serve procedure.

**Given** the public build profile
**When** sources, datasets, reports, and files are discovered
**Then** only positively public artifacts are eligible for inclusion
**And** the build receives no private credentials, private inbox path, or private artifact root
**And** any unresolved, contradictory, or private lineage fails the public build.

**Given** all public dataset and report declarations
**When** site catalogs are compiled
**Then** browser-data, report, navigation, and expected-pipeline catalogs validate against their supported contract versions
**And** every referenced Parquet file, route, dataset, table, report, visual slot, and status projection exists and has a unique identity.

**Given** the compiled catalogs and report content
**When** the production site is built
**Then** it emits static output under the configured GitHub project subpath
**And** browser-readable Parquet and Pulse manifests are included under the same site root
**And** no generated site file is written to or committed on the default branch.

**Given** the production site artifact
**When** verification runs
**Then** it exercises direct and navigated nested routes, reload behavior, representative INSEE queries, the multi-visual report, opt-in exploration, keyboard operation, accessible states, responsive layouts, and reduced motion
**And** DuckDB-WASM startup and query failures remain distinct
**And** one failed visual slot leaves its siblings usable.

**Given** the production site artifact and public-profile policy
**When** artifact scanning runs
**Then** it contains no secrets, credentials, private paths, private source identifiers, private reports, unexpected remote dependencies, source maps exposing sensitive content, or disposable build residue
**And** the artifact remains below GitHub Pages' 1 GB published-site limit.

**Given** the performance budget established by Story 1.2
**When** the production French macro report is measured under the documented cold-cache conditions
**Then** time to first readable visual meets the budget
**And** a regression fails verification before deployment.

**Given** a verified site artifact
**When** the site workflow prepares deployment
**Then** it adds the successful `system/site` projection with generation time, validity deadline, and canonical build/deploy outcomes
**And** the resulting artifact is immutable after verification
**And** GitHub Pages deploys that exact artifact rather than rebuilding it.

**Given** multiple site builds are queued
**When** the site workflow applies concurrency control
**Then** it uses a site-specific latest-wins group separate from the repository-writer group
**And** obsolete site builds cannot deploy after a newer verified build.

**Given** the site build, verification, or deployment fails
**When** the workflow exits
**Then** no generated site output mutates the default branch
**And** no unverified artifact is deployed
**And** the previously deployed site remains available until its validity deadline causes it to display as stale
**And** GitHub Actions retains the safe failure diagnostic.

**Given** a successful deployment
**When** the public Pages URL is opened
**Then** the homepage, French macro report, pipeline health, provenance, INSEE data, visuals, and exploration operate from the repository subpath without special HTTP headers or a continuously running server
**And** the deployed content matches the verified artifact's hashes.

**Given** a repository visitor follows the documented procedure
**When** they install frozen dependencies, rebuild from committed public snapshots, and serve locally
**Then** they obtain data and site output equivalent to the deployed public artifact apart from explicitly documented build timestamps and deployment metadata
**And** no access to Yann's machine or private data is required.

## Epic 2: Extend Pulse Through Repeatable Agent Workflows

Yann can use coding agents to add sources, indicators, visuals, reports, and data-driven annotations—or change a dataset schema—by following stable workflows and source-neutral templates without reinventing the system or breaking existing output.

### Story 2.1: Establish the Report Design Foundation

As a visual author,
I want a small, application-owned design foundation for Pulse reports,
So that new visuals feel coherent and accessible without constraining their purpose-built designs.

**Acceptance Criteria:**

**Given** the report design foundation
**When** its scope is documented
**Then** it explicitly establishes semantic colors, typography, spacing, state presentation, focus treatment, responsive behavior, accessibility baselines, reduced-motion behavior, and agent-facing visual guidance
**And** it explicitly does not establish chart types, a visualization library, a comprehensive UI component catalog, standard report layouts, report content, or prescribed visual designs.

**Given** Pulse's existing report experience
**When** shared presentation tokens are implemented
**Then** `site/design/tokens.css` is the canonical owner of dark-default color roles, typography, spacing, state colors, focus treatment, and reduced-motion signals
**And** visuals consume semantic roles rather than duplicating literal theme values.

**Given** the visual-language documentation
**When** an agent prepares to author or change a visual
**Then** `site/design/visual-language.md` provides only the current cross-visual conventions needed for that work
**And** the guidance is understandable without reading unrelated visual implementations
**And** it does not introduce a fixed visual grammar.

**Given** the source-neutral visual template
**When** an agent creates a visual
**Then** the template demonstrates semantic tokens, declared-schema fixtures, display and provenance inputs, responsive containers, accessible states, and focused cleanup
**And** it contains no report-specific design, chart vocabulary, sample SQL, storage path, or framework protocol.

**Given** a purpose-built visual with a need not covered by existing roles
**When** its author considers adding a shared token or convention
**Then** the need is evaluated across existing reports before becoming shared
**And** a one-off design decision remains local when it is not a genuine cross-visual convention.

**Given** a proposed shared role or convention change
**When** cross-report conformance review runs
**Then** all existing consumers are identified and tested
**And** unrelated visuals do not require rewrites merely to preserve their current appearance or behavior.

**Given** an existing visual-language convention is changed or removed
**When** the design guidance is updated
**Then** agents receive only the current convention
**And** templates and conformance checks no longer enforce the superseded rule
**And** existing visuals require changes only when the new convention is intentionally applied to them.

**Given** normal, interactive, loading, empty, suspect, stale, and error states
**When** the shared tokens are rendered in the reference harness
**Then** text and controls meet WCAG 2.2 AA contrast and focus requirements
**And** no state relies on color alone
**And** reduced-motion preferences are respected.

**Given** desktop, zoomed, and narrow smartphone-landscape viewports
**When** the source-neutral visual template is exercised
**Then** it remains readable and operable without prescribing a particular design
**And** indicator, provenance, focus visibility, and accessible data equivalents remain available.

**Given** the completed report design foundation
**When** its published inputs are validated independently
**Then** the canonical visual-language document and source-neutral template are available through documented application-owned locations
**And** no existing visual implementation is required to load, understand, or verify them.

### Story 2.2: Add a Public Source Through a Source-Neutral Workflow

As a builder,
I want an agent to add a public source from neutral templates and explicit source requirements,
So that each provider remains isolated while Pulse gains new data through a predictable process.

**Acceptance Criteria:**

**Given** an approved source-selection record from report or indicator planning
**When** the add-source workflow begins
**Then** it requires a stable source ID, provider and access method, required indicators, licence, attribution, fetch cadence, expected publication schedule, visibility, format, and known access constraints
**And** it stops for unresolved redistribution rights, missing attribution, or an access method that cannot support faithful archival.

**Given** a valid source-selection record
**When** the workflow scaffolds a public source package
**Then** it starts from source-neutral templates for `source.yml`, acquisition/reader code, decode/schema contract, dbt models, fixtures, assertions, and tests
**And** it creates only the files required by that source
**And** it does not copy INSEE-specific identifiers, endpoints, schemas, cadence, assertions, or transformations.

**Given** a generated source package
**When** source discovery runs
**Then** the source is found from its declaration without changing a central registry
**And** stable ID, dataset ID, logical table, pipeline ID, and artifact-path collisions are rejected.

**Given** a provider exposes files or an API
**When** the agent implements acquisition
**Then** provider-specific access and faithful decoding stay inside the source package
**And** shared runtime code owns acquisition IDs, immutable archive writing, manifest validation, retry semantics, and CLI orchestration
**And** analytical typing and semantics remain in source-local dbt models rather than acquisition code.

**Given** provider-specific behavior is needed by only that source
**When** the workflow is completed
**Then** the behavior remains local to its source package
**And** it is promoted into shared runtime only after another source demonstrates the same need and a common contract can be defined.

**Given** the source's declared cadence and publication schedule
**When** automation is produced
**Then** it receives an independently scheduled thin workflow that calls the Pulse CLI
**And** both scheduled and on-demand runs use the same source stages and contracts
**And** default-branch publication continues through the shared serialized repository writer.

**Given** public raw data from the new source
**When** it is archived
**Then** file sources preserve original bytes and non-file/API sources preserve faithful Parquet
**And** public raw objects follow Git LFS policy
**And** snapshot manifests include content hashes, observed schema, source dates, acquisition time, licence, and attribution.

**Given** the generated fixture and source contract
**When** offline conformance runs
**Then** it verifies deterministic acquisition/decode, manifest and semantic-metadata completeness, compatible and incompatible schema drift, raw replay, release-calendar freshness, assertion outcomes, profile visibility, and unresolved LFS-pointer rejection
**And** ordinary CI does not contact the provider.

**Given** the generic source-template fixture
**When** template tests execute it end to end
**Then** the neutral package shape produces a valid snapshot, landing artifact, dataset, source status, and scheduled-workflow configuration
**And** no INSEE package is copied or required as scaffold input.

**Given** the completed INSEE source and any source created through the neutral workflow
**When** repository-wide source conformance runs
**Then** both satisfy the same contracts and shared verification
**And** the INSEE implementation serves only as evidence that the neutral interfaces support a real provider.

**Given** the new source has a failed or suspect run
**When** the existing homepage, report catalogs, and status derivation are rebuilt
**Then** it appears automatically through declaration discovery
**And** existing sources and the French macro report remain operational and unchanged unless they explicitly depend on the new source.

**Given** the agent-facing workflow instructions
**When** an agent adds a source
**Then** every required decision, command, artifact, validation, and completion condition is available without reading unrelated source implementations
**And** the workflow never instructs the agent to duplicate shared runtime code or invent an alternative automation entry point.

### Story 2.3: Add Indicators and Change Dataset Schemas Safely

As a builder,
I want agents to add indicators and evolve dataset schemas through explicit, source-neutral workflows,
So that Pulse can answer new questions without silently breaking reports or visuals.

**Acceptance Criteria:**

**Given** an approved indicator requirement from report planning
**When** the add-indicator workflow begins
**Then** it requires the indicator's stable name, question served, source field or derivation, unit, definition, provenance, attribution, temporal meaning, expected type, and validation rules
**And** it confirms that the indicator belongs to an existing single-source dataset
**And** it routes to the add-source workflow when the required source does not yet exist.

**Given** a valid indicator requirement
**When** the workflow scaffolds the change
**Then** it starts from source-neutral transformation, semantic-metadata, assertion, and fixture templates
**And** it changes only the source-local contract, dbt models, tests, and metadata needed by that indicator
**And** it does not copy INSEE-specific transformations or report-specific queries.

**Given** an additive indicator that does not alter existing columns
**When** the source slice is rebuilt
**Then** the new indicator appears as a documented, properly typed column in the wide dataset
**And** its unit, definition, source, licence, and attribution are machine-readable
**And** existing consumers continue to receive their previously declared schema and behavior unchanged.

**Given** an agent proposes a dataset-schema change
**When** the change-schema workflow begins
**Then** it identifies every affected dataset contract, report query, visual consumer schema, exploration query, lineage declaration, fixture, and published catalog entry before implementation
**And** it classifies the change as compatible addition, compatible modification, or breaking consumer change.

**Given** a compatible source-schema addition
**When** decoding and transformation run
**Then** the observed addition is recorded and reported
**And** required existing fields remain available
**And** no unrelated report or visual requires modification.

**Given** a missing required source field or incompatible source type
**When** the source slice is rebuilt
**Then** faithful decoding or transformation fails visibly according to the source contract
**And** the last usable dataset remains selected
**And** no consumer receives silently coerced, missing, or incorrectly typed data.

**Given** a breaking change to columns consumed by reports or visuals
**When** the workflow proposes implementation
**Then** it requires either one atomic migration of every affected consumer or an application-owned compatibility adapter
**And** an individual dataset, report, or visual cannot independently introduce an unsupported contract major.

**Given** an atomic consumer migration
**When** the change is committed
**Then** dataset schema, semantic metadata, report queries, visual fixtures, consumer validations, lineage declarations, and tests move together
**And** no intermediate repository state presents the new dataset schema to old consumers.

**Given** an application-owned compatibility adapter
**When** old and new consumers coexist temporarily
**Then** the adapter's supported versions, mapping, tests, owner, and removal condition are explicit
**And** provider-specific or visual-specific compatibility logic does not leak into shared contracts.

**Given** any indicator or schema change
**When** the source slice is rebuilt from the immutable archive
**Then** no persisted warehouse migration is required
**And** prior raw snapshots remain unchanged
**And** the resulting dataset manifest records the new schema and content hashes.

**Given** the source-neutral indicator and schema-change fixtures
**When** conformance tests run
**Then** they cover additive indicators, compatible source additions, missing required fields, incompatible types, breaking consumer changes, atomic migration, and compatibility adapters
**And** they detect silently empty or incorrect visual output.

**Given** a completed indicator or schema change
**When** repository-wide verification runs
**Then** all unaffected sources, datasets, reports, visuals, workflows, and the public artifact remain unchanged in behavior
**And** affected consumers pass their declared-schema and end-to-end tests.

**Given** the agent-facing add-indicator and change-schema instructions
**When** an agent follows either workflow
**Then** all decisions, files, commands, consumer-impact checks, and completion gates are explicit
**And** the agent does not need to inspect unrelated source or visual implementations to discover the required process.

### Story 2.4: Author and Register a Purpose-Built Visual

As a visual author,
I want an agent-guided workflow for creating and wiring a bespoke visual from neutral templates,
So that new visual forms remain inexpensive to add without becoming variations of an existing chart.

**Acceptance Criteria:**

**Given** a report question and selected dataset
**When** the add-visual workflow begins
**Then** it requires the question being answered, declared input columns and types, representative fixture rows, intended display and provenance inputs, expected empty/error behavior, and the report slot where the visual will be registered
**And** the visual's figures, precision, comparisons, emphasis, interaction, and design are decided in session against its real content rather than inferred from a universal rule.

**Given** an approved visual brief
**When** the workflow scaffolds the visual
**Then** it starts from the source-neutral visual template and `v1` contract
**And** it creates only the visual module, declared-schema fixture, focused styles, contract tests, accessible data equivalent, and registration change required by that visual
**And** it does not copy an existing visual implementation or select a chart type.

**Given** the report design foundation
**When** the visual is authored
**Then** it consumes existing semantic tokens and current visual-language guidance
**And** report-specific design choices remain local
**And** a new shared role is proposed only through the cross-report process from Story 2.1.

**Given** declared-schema fixture rows including representative, boundary, and empty cases
**When** the visual is designed and tested before real data is wired
**Then** it returns ordinary DOM or SVG and answers the approved question
**And** it imports or calls no chart or visualization library
**And** it has no dependency on SQL, DuckDB, Parquet paths, routes, Observable globals, generated paths, or framework lifecycle.

**Given** the visual's declared consumer schema
**When** fixture rows are validated
**Then** missing columns, incompatible types, invalid values, and unsupported contract majors fail before rendering
**And** valid rows are passed as plain data with display and provenance inputs.

**Given** loading, no-row, query-error, schema-incompatibility, and render-error conditions
**When** each condition is exercised
**Then** the visual slot provides a distinct, useful, non-color-only state
**And** sibling report content remains usable.

**Given** keyboard operation, assistive technology, zoom, reduced motion, and narrow smartphone-landscape layout
**When** the visual is exercised
**Then** it has semantic structure, logical keyboard behavior, visible focus where interactive, sufficient contrast, adequate targets, responsive rendering, and an accessible data equivalent
**And** indicator and provenance information remain available.

**Given** resources created outside the returned DOM subtree
**When** the visual is removed or rerendered
**Then** its focused cleanup releases only resources it owns
**And** it does not dispose of the application shell's shared worker, connection, or other application-owned resources.

**Given** the completed fixture-authored visual and its real parameterized query
**When** the coding agent wires the query through the shared data client
**Then** fixture rows are replaced by validated real rows without changing rendering logic
**And** request cancellation remains scoped to the query
**And** the rendered provenance matches the dataset catalog.

**Given** the visual is registered on a report
**When** catalogs and lineage are compiled
**Then** its globally unique `<report-id>/<slot-id>`, dataset and column dependencies, contract major, query, and route association validate successfully
**And** identity collisions or undeclared dependencies fail the build.

**Given** a visual that introduces an unprecedented local rendering technique
**When** repository verification runs
**Then** existing visuals and reports continue to pass unchanged
**And** the technique remains local unless a later independent visual demonstrates a shared implementation need.

**Given** the agent-facing add-visual instructions
**When** an agent follows the workflow
**Then** every design checkpoint, template, file, command, contract test, accessibility check, wiring step, registration step, and completion gate is explicit
**And** it loads the canonical visual-language document and source-neutral template from their documented locations
**And** the agent can finish without reading or copying unrelated visual rendering code.

### Story 2.5: Build a Report from Questions, Sources, Visuals, and Annotations

As Yann,
I want an agent-guided workflow that builds a report from the questions I care about,
So that each report uses appropriate sources and bespoke visuals without turning report creation into a new systems project.

**Acceptance Criteria:**

**Given** an idea for a new report
**When** the add-report workflow begins
**Then** it elicits the standing questions, intended indicators, desired context, likely reading behavior, privacy expectations, and whether in-browser exploration is needed
**And** it does not prescribe figures, precision, comparisons, layout, or visual treatments before those decisions are made in session against real data.

**Given** the required indicators
**When** candidate data sources are evaluated
**Then** the workflow compares authority, coverage, granularity, stability, access method, format, licence, attribution, fetch cadence, expected publication schedule, and redistribution constraints
**And** it records why each selected source is suitable for this report
**And** it does not treat INSEE or any other provider as the default.

**Given** a suitable dataset and indicator already exist in Pulse
**When** report planning resolves its data needs
**Then** the report reuses their stable dataset and column identities
**And** it does not duplicate acquisition, transformation, or semantic definitions inside the report.

**Given** a required source or indicator does not exist
**When** the workflow reaches that dependency
**Then** it invokes the neutral add-source or add-indicator workflow with the approved selection record
**And** report work resumes only after the dependency publishes valid contracts and fixtures.

**Given** the report consumes several datasets
**When** its dependencies are declared
**Then** each dataset still belongs to exactly one source
**And** the report may query the independent datasets without creating an undeclared multi-source dataset
**And** shared-state or cross-filtering topology is introduced only when explicitly required by the report design.

**Given** approved report requirements and available datasets
**When** the workflow scaffolds the report
**Then** it starts from a source-neutral report declaration, page, query, visual-slot, annotation, state, and test template
**And** it does not copy the French macro report's questions, layout, queries, visual designs, or exploration choices.

**Given** the new report declaration
**When** it is validated
**Then** it owns a stable lowercase kebab-case ID, unique route, requested visibility, dataset and column dependencies, visual slots, exploration choice, and substantive-change metadata
**And** generated page metadata may mirror but cannot own those values.

**Given** the report's real data and selected questions
**When** visuals are planned and authored
**Then** each visual has an explicit question and declared consumer schema
**And** the add-visual workflow is used for every new purpose-built visual
**And** arbitrary visual designs can coexist without a chart vocabulary or visualization library.

**Given** contextual events, series breaks, definition changes, or other annotations are needed
**When** they are added to the report
**Then** the report owns them as versioned, machine-readable data with stable identity, join fields, temporal or value anchors, explanatory text, provenance, and applicable dataset/column dependencies
**And** browser-facing annotation data is delivered through the same static-artifact and contract discipline as other report data.

**Given** report-owned annotation data
**When** the report query executes
**Then** the report joins annotations to analytical rows before passing plain rows to the visual
**And** no annotation is implemented as a hardcoded rendering coordinate
**And** adding or editing an annotation does not require changing visual rendering code.

**Given** source and report visibility declarations
**When** report visibility is resolved
**Then** any private dependency makes the report private
**And** the report may explicitly tighten itself to private but cannot weaken inherited privacy
**And** unresolved lineage fails rather than defaulting to public.

**Given** normal, loading, empty, suspect, stale, query-error, schema-incompatibility, render-error, and shared-engine-failure conditions
**When** report tests run
**Then** the report and its individual slots display the appropriate accessible states
**And** a local slot failure leaves siblings usable
**And** suspect impact follows declared column lineage.

**Given** the report is built for desktop, keyboard, assistive technology, zoom, reduced motion, and narrow smartphone-landscape use
**When** its page, visuals, annotations, provenance, navigation, and exploration controls are exercised
**Then** they meet the report design foundation and WCAG 2.2 AA requirements
**And** essential indicators and provenance remain available.

**Given** a source-neutral fixture report
**When** workflow conformance runs
**Then** the neutral templates produce valid catalogs, queries, visual slots, annotation joins, route behavior, visibility resolution, accessible states, and static output
**And** no existing report is required as scaffold input.

**Given** a completed new report
**When** repository-wide verification runs
**Then** existing reports, sources, datasets, visuals, statuses, and public builds continue to pass unchanged unless they are declared dependencies
**And** the new report appears automatically in the appropriate navigation and catalogs.

**Given** the agent-facing add-report instructions
**When** an agent follows the workflow
**Then** every discovery question, source-selection checkpoint, dependency workflow, template, design session, file, command, test, registration step, and completion gate is explicit
**And** the agent can finish without reading unrelated report implementations.

## Epic 3: Use Private Data Without Risking Public Exposure

Yann can ingest local private files and produce private reports while structural lineage and build-profile rules prevent private data or derived artifacts from entering public output.

### Story 3.1: Ingest Private Files Locally

As Yann,
I want to ingest private files through a controlled local workflow,
So that Pulse can archive and process them without exposing their contents outside my machine.

**Acceptance Criteria:**

**Given** a private source definition
**When** its declaration is validated
**Then** it uses the standard source identity, cadence, publication, schema, licence, attribution, and contract fields with visibility set to private
**And** the declaration contains no credentials, private values, or machine-specific absolute paths.

**Given** a private source ID
**When** Yann supplies a file
**Then** the supported input location is the ignored `private/inbox/<source-id>/` directory
**And** source code cannot accept or scan arbitrary user paths
**And** traversal, out-of-root symlinks, and mismatched source directories are rejected before reading content.

**Given** a valid private inbox file
**When** the documented private-profile source command runs
**Then** it uses the same repository-local Pulse CLI, acquisition-ID rules, source contracts, and stage semantics as public ingestion
**And** it runs manually on demand without creating a scheduled public workflow.

**Given** a successful private file acquisition
**When** Pulse archives it
**Then** the original bytes are preserved in an immutable local private snapshot
**And** `snapshot.json` records source identity, acquisition ID, UTC acquisition time, source-data date, content hash, observed schema, decoder/tool versions, licence, and attribution
**And** the snapshot and manifest remain under ignored private artifact roots.

**Given** the same logical private acquisition is retried with the same ID and content
**When** the archive writer evaluates it
**Then** it succeeds as a no-op without modifying the existing snapshot
**And** conflicting content for the same acquisition ID fails without overwrite.

**Given** a later private acquisition whose bytes match an earlier file
**When** it receives a new acquisition ID
**Then** it is preserved as a distinct observation with its own acquisition time
**And** content equality does not remove private history.

**Given** private ingestion is running
**When** network and process behavior are inspected
**Then** private file contents are not uploaded, transmitted, logged, or sent through telemetry
**And** no public repository writer, Git LFS operation, GitHub Actions job, or deployment command is invoked.

**Given** malformed, unreadable, unsupported, or contract-invalid private input
**When** acquisition or faithful decoding fails
**Then** no partial artifact is accepted as a valid snapshot or landing artifact
**And** existing private snapshots remain unchanged
**And** the local diagnostic is actionable without reproducing sensitive field values or file contents.

**Given** private inputs, snapshots, landing files, databases, datasets, statuses, and build residue
**When** repository ignore and status checks run
**Then** none is eligible for Git staging or inclusion in public build discovery
**And** source code and neutral synthetic fixtures remain independently commit-safe.

**Given** a synthetic private fixture
**When** private-ingestion conformance runs
**Then** it verifies input-root enforcement, traversal and symlink rejection, immutable archival, retry behavior, manifest validation, failure cleanup, ignored output, and absence of network publication
**And** automated tests require no real personal data.

**Given** the v1 private archive
**When** its operating documentation is read
**Then** it clearly states that the archive exists only on the local machine and has no durable backup guarantee
**And** it warns Yann not to treat Pulse as the sole copy of irreplaceable private data.

### Story 3.2: Build Private Reports Through Lineage-Based Profiles

As Yann,
I want private datasets and reports to build and serve locally through the normal Pulse workflow,
So that I can use personal data without relying on manual exclusion rules.

**Acceptance Criteria:**

**Given** public and private source declarations
**When** source discovery runs under the public profile
**Then** only public sources are discoverable by the executing pipeline
**And** private source roots, inputs, credentials, snapshots, and derived artifacts are unavailable to that execution.

**Given** the same declarations
**When** source discovery runs under the private profile
**Then** both public and private sources may be discovered
**And** each retains its declared visibility and independent source ownership.

**Given** valid private snapshots
**When** the private source slice is rebuilt
**Then** it uses the same faithful landing, dbt transformation, testing, semantic metadata, dataset-manifest, assertion, and status contracts as a public source
**And** all landing files, DuckDB databases, datasets, manifests, and statuses remain in ignored private roots.

**Given** a dataset derived from a private source
**When** its visibility is resolved
**Then** the dataset is private without a separate dataset override
**And** no declaration may weaken it to public.

**Given** a report consuming only public datasets
**When** public and private catalogs are compiled
**Then** the same report code can be included in both profiles
**And** its resolved visibility remains public unless its own declaration explicitly tightens it.

**Given** a report consuming at least one private dataset
**When** report lineage is compiled
**Then** its resolved visibility is private regardless of its requested visibility
**And** every dependent query, visual slot, annotation dataset, exploration path, provenance record, and catalog entry inherits the private boundary.

**Given** a report whose declaration explicitly requests private visibility while consuming public data
**When** visibility is resolved
**Then** the report and its report-owned artifacts are private
**And** the explicit setting can tighten but never weaken inherited privacy.

**Given** a report consuming both public and private datasets
**When** it is built
**Then** each dataset remains independently source-owned rather than becoming an undeclared multi-source dataset
**And** the report resolves to private
**And** its joined query results and derived browser artifacts remain private.

**Given** unresolved lineage, a missing visibility declaration, or an attempted public override of private ancestry
**When** catalog compilation runs
**Then** it fails closed with a clear diagnostic
**And** the report is not emitted into either a public artifact or an ambiguously classified location.

**Given** the private build profile
**When** Yann runs the documented local build-and-serve command
**Then** Pulse rebuilds the eligible public and private source slices and produces a private static site under an ignored local root
**And** the site can be opened through the normal local server
**And** no deployment workflow or public repository mutation is available from that command.

**Given** a private report
**When** it is designed and authored
**Then** it uses the neutral report and visual workflows, shared data client, design foundation, accessibility requirements, state handling, and provenance contracts
**And** its private status does not create an alternate report architecture.

**Given** the private homepage and report catalogs
**When** the local site is opened
**Then** Yann can navigate to eligible public and private reports and inspect their freshness, health, provenance, and resolved visibility
**And** private source or report identifiers do not need to appear in the public catalogs.

**Given** public and private builds run successively in either order
**When** their output roots and caches are inspected
**Then** each build uses profile-specific disposable roots
**And** no private artifact, catalog entry, query result, or generated residue is reused by the public build.

**Given** credentials required by a private source
**When** the private pipeline runs
**Then** credentials enter only through the local executing environment
**And** they do not appear in source declarations, manifests, logs, diagnostics, catalogs, browser output, or repository state.

**Given** synthetic public-only, private-only, explicitly-private, and mixed-lineage fixture reports
**When** profile and lineage conformance tests run
**Then** each report is included or excluded according to structural visibility rules
**And** both local private operation and unchanged public operation are verified without real personal data.

### Story 3.3: Prove the Public Build Cannot Leak Private Data

As Yann,
I want the public-build privacy boundary tested against realistic failure modes,
So that a forgotten exclusion, stale cache, or incorrect declaration cannot publish my private data.

**Acceptance Criteria:**

**Given** the public CI workflow
**When** its jobs and permissions are inspected
**Then** only public source and site roots are available to discovery
**And** no private inbox, private artifact root, private cache, or private credential is mounted or injected
**And** the workflow can complete from a clean clone containing no private state.

**Given** synthetic private sources, datasets, reports, annotations, statuses, and credentials marked with unique canary values
**When** a public build runs in a workspace that also contains those ignored private fixtures
**Then** public source discovery never opens or enumerates the private roots
**And** the verified public artifact contains none of the canary values or private identities.

**Given** public and private builds have run successively in the same workspace
**When** the public build runs after the private build
**Then** it creates fresh profile-specific disposable state
**And** it does not reuse a private DuckDB database, catalog, worker input, generated page, query result, cache entry, manifest, or status projection.

**Given** a private source is referenced directly or transitively by a dataset, report, visual slot, annotation dataset, or exploration query
**When** the public lineage graph is compiled
**Then** the dependent artifact resolves to private and is excluded
**And** any attempt to force its public inclusion fails the build.

**Given** incomplete, cyclic, missing, contradictory, or unsupported lineage metadata
**When** public visibility is resolved
**Then** resolution fails closed rather than assuming public visibility
**And** no affected artifact reaches the public build root.

**Given** malicious or mistaken paths in declarations and generated catalogs
**When** public build validation runs
**Then** absolute paths, parent traversal, out-of-root symlinks, private-root references, and files outside the public artifact graph are rejected
**And** diagnostics do not echo sensitive file contents or credential values.

**Given** a public build with synthetic private data present
**When** the final artifact scan runs
**Then** it inspects HTML, JavaScript, CSS, source maps when present, JSON manifests and catalogs, Parquet schemas and values, generated indexes, logs packaged into the artifact, URLs, and provenance metadata
**And** it rejects private canaries, local paths, credentials, private identifiers, and undeclared files.

**Given** artifact scanning is disabled or misses a novel encoding
**When** the structural privacy model is evaluated
**Then** public discovery and lineage still prevent private artifacts from entering the build graph
**And** artifact scanning is documented and tested as defense in depth rather than the primary privacy boundary.

**Given** a public source declaration or diagnostic containing credential-shaped data
**When** contract and log-safety validation runs
**Then** the build fails before publication
**And** the unsafe value is redacted from user-facing and CI diagnostics.

**Given** a private-profile build or serve command
**When** its available operations are inspected
**Then** it has no path to the GitHub Pages deployment workflow or default-branch repository writer
**And** an explicit attempt to deploy private output is rejected.

**Given** a public-profile build with and without ignored private fixtures present
**When** deterministic outputs are compared
**Then** public datasets, catalogs, pages, routes, and content hashes are equivalent apart from documented timestamps and deployment metadata
**And** the presence of local private data cannot influence public output.

**Given** a failed public privacy check
**When** the site workflow handles the result
**Then** no artifact is deployed and no default-branch mutation occurs
**And** the previous public site remains in place until its normal validity deadline
**And** the diagnostic identifies the violated privacy rule without disclosing the private value.

**Given** the complete privacy conformance suite
**When** it runs in ordinary CI
**Then** it uses only synthetic fixtures and covers discovery isolation, lineage propagation, explicit tightening, forbidden weakening, mixed dependencies, stale build residue, path escape, credential redaction, artifact scanning, and deployment rejection
**And** no real private data is required to prove the boundary.
