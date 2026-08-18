---
name: Pulse
type: architecture-spine
purpose: build-substrate
altitude: feature
paradigm: pipes-and-filters with static artifact boundaries
scope: ingestion, archive, transformation, publication, report delivery, privacy, and pipeline visibility
status: final
created: '2026-08-18'
updated: '2026-08-18'
binds: [FR-1..FR-26, NFR-1..NFR-6]
sources:
  - ../../prds/prd-pulse-2026-08-07/prd.md
  - ../../prds/prd-pulse-2026-08-07/addendum.md
  - ../../ux-designs/ux-pulse-2026-08-11/.memlog.md
  - ../../research/technical-observable-framework-versus-evidence-for-2026-08-18/research.md
companions: [.memlog.md]
---

# Architecture Spine — Pulse

## Design Paradigm

Pulse is a pipes-and-filters system whose boundaries are immutable, versioned artifacts. A stage consumes declared artifacts and emits the next; no stage reaches through a boundary into another tool's mutable state. The browser is a terminal, read-only consumer.

```mermaid
flowchart LR
    O[Source origin] --> I[dlt acquisition]
    I --> S[Immutable original snapshot]
    S --> L[dlt decode / landing Parquet]
    L --> D[dbt-duckdb transform and test]
    D --> P[Published dataset Parquet + Pulse manifests]
    P --> B[Observable static build]
    B --> G[GitHub Pages artifact]
    G --> Q[Application dataClient / DuckDB-WASM]
    Q --> V[DOM/SVG visual]
```

## Invariants & Rules

### AD-1 — Static artifact pipeline [ADOPTED]

- **Binds:** FR-3, FR-5–FR-9, FR-18–FR-21, FR-26; all pipeline stages.
- **Prevents:** hidden mutable coupling, unreplayable warehouses, and browser-side writes.
- **Rule:** The only forward path is acquire → immutable snapshot → faithful landing → transform/test → published Parquet plus status → static site artifact → browser query/render. Snapshots are never modified or deleted. There is no persisted shared warehouse: each source run creates a fresh DuckDB and fully rebuilds that source's complete dataset slice from committed raw snapshots; the whole-pipeline command rebuilds every source slice. Landing files, DuckDB databases, and site output are disposable and reproducible from the archive. This is the architecture's explicit refinement of PRD FR-6: “full rebuild on every pipeline run” means a full rebuild of the independently owned source slice for a source pipeline, and of all slices for the whole-pipeline command; no publication path incrementally mutates a prior dataset.

### AD-2 — Source package and data-tool ownership [ADOPTED]

- **Binds:** FR-1–FR-9, FR-22–FR-24; every source epic.
- **Prevents:** source logic scattering across tool directories and dlt/dbt competing as schema authorities.
- **Rule:** Each discoverable `sources/<source-id>/` vertical slice owns its declaration, dlt source/reader, decode and schema contract, assertions, dbt models, fixtures, and tests; there is no central source registry. dlt owns access, source-format decoding, and faithful landing. File sources retain original bytes; non-file/API sources retain faithful Parquet as the durable snapshot. dbt-duckdb starts at landing Parquet and solely owns analytical typing, semantics, tests, disposable DuckDB materialization, and published dataset Parquet. A v1 dataset depends on exactly one source, is wide, and carries machine-readable model/column descriptions plus indicator unit, definition, source, and attribution. Publication uses dbt-duckdb `external` materialization only after the exemplar proves `ref()` and `not_null` tests against an external model; failure reopens the publish mechanism before source epics proceed.

### AD-3 — Per-source isolation and advancement [ADOPTED]

- **Binds:** FR-2–FR-9, FR-19–FR-21; scheduled and on-demand source runs.
- **Prevents:** one source cadence or failure blocking unrelated sources, and a failed decode masquerading as fresh data.
- **Rule:** One independently scheduled, idempotent workflow owns each source through its full-slice rebuild and publication; a separate site workflow is the sole aggregator. The Pulse CLI creates one opaque, platform-independent acquisition ID for each logical scheduled or manually triggered observation and passes it through every stage. A retry reuses that ID: the repository writer no-ops when the ID and artifact hashes already match and fails on the same ID with different content. A later observation receives a new ID and is preserved even when its bytes match an earlier observation. Source declarations distinguish fetch cadence from expected publication advancement, and freshness assertions use the latter. A missed schedule is recoverable by the next or an on-demand run. Decodable snapshots advance even when assertions mark them suspect, and their warning propagates. Undecodable snapshots remain archived, emit fresh failed-stage status, and leave the last successfully derived dataset selected. Other sources and the site continue.

### AD-4 — Pulse-owned lineage and health contracts [ADOPTED]

- **Binds:** FR-5–FR-9, FR-16, FR-19–FR-21, FR-26; snapshots, datasets, reports, and homepage.
- **Prevents:** the site depending on dlt state, dbt internals, Actions APIs, or ambiguous provenance.
- **Rule:** Versioned Pulse manifests are the inter-stage API. `runtime/contracts/` is their sole schema owner: UTF-8 JSON documents use well-known filenames, carry a schema ID and semantic version, and are strictly validated by every producer and consumer; unsupported major versions are rejected. An immutable `snapshot.json` identifies source, acquisition, UTC acquisition time, source-data date, original files/URLs, SHA-256 content hashes, observed-schema hash, decoder/tool versions, licence, and attribution. `landing.json` and `dataset.json` reference their source snapshot. Every dataset has a globally unique `<source-id>/<dataset-id>` identity; each browser entry in `browser-data.json` carries that ID, its unique logical DuckDB table name, contract version, schema, content hash, represented period, manifest-relative Parquet URL, semantic metadata, and resolved visibility. Reports reference only dataset IDs; `dataClient` alone resolves IDs to tables and URLs, always against the browser manifest URL rather than the current document route.

  `source` declarations plus the one `system/site` declaration form the complete expected-pipeline set. A source pipeline publishes a replaceable `pipeline-status.json` through the repository writer with stable ID/name, cadence, execution time, canonical stage outcomes, latest usable output, and sanitized diagnostics. `system/site` writes its successful build/deploy projection only into the deployed site artifact; a failed replacement cannot update an already deployed static site, so the prior site's validity deadline expires to `stale` while GitHub Actions retains the failure diagnostic. The repository writer is a stage of each source pipeline, not a separately reported pipeline. Canonical source stages are `acquire`, `snapshot`, `decode`, `transform`, `test`, and `publish-data`; site stages are `build-site` and `deploy-site`. A required stage that cannot emit a contract-compliant artifact is `failed`; a contract-compliant published artifact with failed domain or freshness assertions is `suspect`; `stale` means its declared validity deadline passed. Display precedence is `failed > suspect > stale > succeeded`, with `not-run` used only before any attempt. The latest usable dataset is the newest contract-compliant decoded and transformed publication, including a suspect one; a failed run does not replace it. Errors use one versioned sanitized envelope with stage, stable code, safe message, and retryability.

  Each `site/reports/<report-id>/report.yml` is the canonical report declaration and owns `requested_visibility`; the compiled `report-catalog.json` records requested and lineage-derived `resolved_visibility`, stable ID/name/route, and last substantive data-or-content change, never routine regeneration. Observable page metadata may mirror but never own these values. Each visual slot declares dataset/column dependencies; suspect impact is computed from that lineage and is conservatively `unknown/possibly affected` when column-level precision is unavailable. The site manifest records generation time and validity deadline. The site consumes only these Pulse contracts.

### AD-5 — Structural privacy propagation [ADOPTED]

- **Binds:** FR-4, FR-17, NFR-2–NFR-3; all source, dataset, report, and build units.
- **Prevents:** private data leaking through forgotten exclusions, credentials, derived reports, or build residue.
- **Rule:** Public inclusion is positive and lineage-based. Public CI can discover only public sources and receives no private credentials or roots; any dependency on a private source makes every downstream dataset and report private and invalidates a public build. A report may explicitly tighten itself to private in its report declaration but can never weaken inherited privacy. Manually supplied private files enter only through the ignored `private/inbox/<source-id>/` convention and the same Pulse acquisition command used by other sources; source code may not read arbitrary user paths. Private builds run locally in ignored, never-deployed roots. Public artifact scanning is defense in depth, not the privacy boundary.

### AD-6 — Observable site shell behind an exit seam [ADOPTED]

- **Binds:** FR-15, FR-18–FR-20, FR-25; homepage, reports, local serve, and GitHub Pages.
- **Prevents:** epics choosing incompatible site frameworks or embedding irreplaceable Observable protocols in application modules.
- **Rule:** Observable Framework is the v1 report-site substrate, conditional on an Observable-only pilot against freshly rechecked versions. The pilot must prove the real repository subpath, nested-route reload, representative same-origin Parquet query, keyboard operation, distinct DuckDB-WASM startup/query failures, one nontrivial interactive DOM/SVG visual, clean-clone reproduction, public artifact privacy, and measured cold time to first readable visual. Portable modules use explicit imports and application-owned manifest paths—never Observable implicit imports, generated paths, or globals—and the data client and visual must move unchanged into a minimal Vite shell. Failure of any exit criterion blocks implementation and reopens the site-substrate decision; it does not trigger an Evidence comparison by default.

### AD-7 — Report/query/visual dependency direction [ADOPTED]

- **Binds:** FR-10–FR-16, FR-25; every report and visual.
- **Prevents:** visuals coupling to SQL, storage, routing, Observable reactivity, or framework lifecycle.
- **Rule:** A report owns dataset selection, parameterized SQL, per-report exploration/cross-visual state, annotations, provenance plumbing, and routing; reader exploration is an explicit per-report opt-in while DuckDB-WASM remains the universal delivery path. The application shell creates one `dataClient` and shared DuckDB-WASM worker/connection for the loaded browser page session; reports borrow it across route changes and may never dispose it. The client alone owns manifest-based dataset registration, parameter binding, normalized startup/query errors, and request-scoped cancellation that does not terminate shared resources; only the application shell disposes it on page unload. It returns plain rows. Visual contract major `v1` defines declared-schema fixtures, rows/display/provenance inputs, registration, and consumer-schema validation; every report slot accepts that major only. A breaking major requires one atomic migration or an application-owned compatibility adapter and cannot be introduced by an individual visual. A visual is authored against fixture rows before a coding agent substitutes the real query; its rendering logic is unchanged and returns DOM/SVG. It knows no SQL, DuckDB, Parquet path, Observable global/protocol, or route. Each report visual slot independently contains loading, no-row, query-error, schema-incompatibility, and render-error states so siblings remain usable; only shared engine/data-delivery failures escalate to report scope. Visuals expose cleanup only for resources outside their returned DOM subtree.

```mermaid
flowchart TD
    R[Report] --> C[dataClient]
    C --> W[DuckDB-WASM]
    W --> P[Published Parquet]
    R --> V[Visual module]
    T[Theme and authoring conventions] --> V
    R --> M[Pulse provenance/status manifests]
    V -. prohibited .-> W
    V -. prohibited .-> R
```

### AD-8 — One automation API and one repository writer [ADOPTED]

- **Binds:** FR-2–FR-6, FR-18, FR-22–FR-24, NFR-1–NFR-2; local runs, agents, and GitHub Actions.
- **Prevents:** pipeline logic diverging across YAML/scripts and concurrent workflows corrupting default-branch history.
- **Rule:** One repository-local Pulse CLI is the high-level API for one-source and whole-pipeline runs, snapshot replay, profile selection, verification, site build, and one-command local serving; local execution, agents, and thin reusable Actions workflows invoke it identically. Repository-owned instructions cover add source, add indicator, add visual, add report, and change dataset schema; each points to the complete first vertical slice, the shared visual-language contract, and repeated source logic moves into shared runtime. Source computation may run concurrently, but every default-branch mutation—including a source's current-status projection—passes through one shared-concurrency repository-writer job that starts from current default branch and atomically commits one source-scoped change set. Site builds do not mutate the default branch and use a separate latest-wins concurrency group.

### AD-9 — Conformance before source-specific verification [ADOPTED]

- **Binds:** FR-1, FR-6, FR-9–FR-12, FR-18, FR-22–FR-24, NFR-1–NFR-3; all extension workflows.
- **Prevents:** each source or visual inventing an incompatible test shape and CI depending on upstream availability.
- **Rule:** Every source passes one offline fixture-based conformance suite covering deterministic decode, manifest/semantic-metadata completeness, schema drift, raw replay, release-calendar freshness, and build-profile privacy; source assertions and dbt tests add domain checks. The first slice must smoke-test `ref()` plus `not_null` against dbt-duckdb external Parquet before that mechanism is adopted. Scheduled acquisition is the live integration test and distinguishes upstream failures from code failures. Visual contract tests use declared-schema fixture rows and detect consumer breakage. Playwright covers a multi-visual nested report in which one slot fails while siblings remain usable, reload, keyboard/accessibility behavior, DuckDB-WASM startup/query failures, and public artifact scanning.

### AD-10 — Locked runtimes and immutable deployment [ADOPTED]

- **Binds:** FR-3, FR-6, FR-18, FR-26, NFR-2, NFR-4, NFR-6; development, CI, and deployment.
- **Prevents:** scheduled dependency drift, verification/deployment mismatch, and generated-site history polluting the archive.
- **Rule:** Python 3.13 uses uv/`uv.lock`; Node 24 LTS uses npm/`package-lock.json`. The Stack table is a cold-start compatibility seed, not permission for independent “latest” upgrades: the first implementation change must create both lockfiles and pass one clean-install CLI/dbt/DuckDB/Observable build smoke test before the tuple is ratified; thereafter the lockfiles are authoritative. The dbt smoke covers version/debug, parse/build/test, external Parquet materialization, `ref()`, and both passing and failing `not_null`; the browser pilot refreshes DuckDB-WASM and runs shared type/query fixtures against Python and WASM engines. CI performs frozen installs; dependency upgrades are explicit tested changes and never part of ingestion. Public raw snapshots use Git LFS as the deliberately simple v1 archive; raw-consuming jobs explicitly fetch only their source's LFS objects, materialize them, and reject pointer stubs before decoding. LFS usage is observed, not treated as a permanent free-tier guarantee; if storage or bandwidth becomes material, the archive substrate is revisited without changing snapshot immutability. The default branch stores code, immutable public snapshots, published dataset Parquet, and Pulse manifests—not generated site files. A clean workflow verifies one site artifact, fails before GitHub Pages' 1 GB published-site limit, and deploys that exact artifact; browser-readable Parquet sits under the site root. Browser DuckDB uses the single-threaded EH bundle without special headers; `coi-serviceworker` is prohibited unless profiling later justifies a host/threading architecture change. Actions and Pages usage is watched at provider boundaries.

### AD-11 — Purpose-built visual experience floor [ADOPTED]

- **Binds:** FR-10–FR-14, FR-18, NFR-6; every visual, report shell, and authoring workflow.
- **Prevents:** independently built visuals introducing chart grammar, inaccessible interaction, incompatible sizing, or hardcoded theme behavior.
- **Rule:** No visual or rendering layer may import or call a chart/visualization library; an unused transitive dependency does not violate the rule. `site/design/tokens.css` and `site/design/visual-language.md` are the application-owned presentation contract: the former owns dark-default theme, type, spacing, state colors, focus, and reduced-motion signals; the latter owns minimal cross-visual authoring conventions and is consumed by the add/change-visual workflow. Visuals consume existing semantic roles. Adding or changing a shared role requires cross-report conformance review and must not force mass visual rewrites. Every visual meets WCAG 2.2 AA through semantic structure, keyboard operation, visible focus, non-color-only states, contrast, zoom/reflow, adequate targets, reduced motion, and an accessible data equivalent. Visuals own container-responsive rendering and remain readable on narrow smartphone landscape; advanced controls may simplify, but the indicator and provenance remain available.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Identity | Stable lowercase kebab-case source, dataset-local, and report IDs key packages and artifact roots. Dataset IDs are `<source-id>/<dataset-id>`; visual-slot IDs are `<report-id>/<slot-id>`; source pipeline IDs are `source/<source-id>` and non-source IDs reserve `system/*`. Report routes and logical DuckDB table names are globally unique. Contract/catalog generation fails on every ID, table, or route collision. Snapshot IDs combine acquisition ID with a short SHA-256 prefix; all derived manifests carry both. |
| Time | Machine timestamps are UTC ISO 8601; source-data dates remain separate from acquisition and build times. |
| Data | Original file bytes are immutable; decoded inter-stage data and report-facing data are Parquet. Datasets are wide and documented; annotations are data, never hardcoded coordinates. |
| Schema drift | Record every observed schema. Allow and report compatible additions; flag missing required fields and incompatible types; fail only when faithful decoding is impossible. |
| State | Immutable source history advances by new artifacts and Git commits. Per-source current-status projections are replaceable through the repository writer; the successful `system/site` projection exists only in the deployed artifact and expires when not replaced. dlt state, DuckDB files, generated sites, and Actions APIs are never data or lineage authorities. |
| Configuration | Source declarations contain no secrets. Credentials enter only through the executing profile/environment and never appear in manifests, logs, repository artifacts, or the browser. |
| Browser errors | No rows and query failure are visible, distinct report states; neither produces a blank visual. |
| Public archive | Raw public snapshots are Git LFS objects; published report Parquet and site output are not placed in LFS unless a later measured constraint requires it. |
| Presentation | English-only v1; shared dark-default semantic tokens; restrained motion with `prefers-reduced-motion`; exact report visual design remains report-specific. |

## Stack — cold-start compatibility seed (checked 2026-08-18)

| Name | Version |
| --- | --- |
| CPython | 3.13 line; current patch at lock generation (3.13.14 research seed) |
| uv | current patch at lock generation (0.12.1 research seed) |
| dlt | 1.30.0 |
| dbt-core | 1.12.2 |
| dbt-duckdb | 1.10.1 |
| DuckDB (Python) | 1.5.5 |
| Node.js | 24 LTS; current patch at lock generation |
| npm | version bundled with selected Node 24 patch |
| Observable Framework | 1.13.4 |
| DuckDB-WASM | pilot-selected current stable (1.31.0 research candidate) |
| GitHub Actions / Pages | hosted service contract as verified 2026-08-18 |

## Structural Seed

```text
sources/<source-id>/
  source.yml          # identity, cadence, privacy, licence, attribution
  ingest.py           # dlt source and built-in/custom reader
  contract.yml        # decode/schema contract and source assertions
  models/             # dbt staging and dataset models
  tests/              # fixture and source-specific verification

snapshots/<profile>/<source-id>/<snapshot-id>/  # immutable originals + manifest
build/landing/<profile>/<source-id>/             # disposable Parquet and decode status
publish/<profile>/data/<source-id>/<dataset-id>/ # committed report-facing Parquet + dataset.json
publish/<profile>/status/source/<source-id>.json # replaceable source projections
private/inbox/<source-id>/                        # ignored manual private-source input
runtime/contracts/                                # sole owner of versioned JSON schemas
runtime/                                           # Pulse CLI and conformance suite
workflows/                                         # five agent-facing extension/change workflows + exemplar links
site/
  catalog/                                         # compiled browser-data/report/pipeline contracts
  design/                                          # shared tokens and minimal visual-language contract
  reports/                                         # queries, visual slots, controls, metadata dependencies
  visuals/                                         # framework-neutral DOM/SVG modules and fixtures
  data/                                            # dataClient and browser-manifest adapter
```

```mermaid
flowchart TB
    subgraph PublicCI[Public GitHub Actions profile]
        PS[Public source packages] --> PW[Per-source workflows]
        PW --> RW[Serialized repository writer]
        RW --> DB[(Default branch: snapshots, data, manifests)]
        DB --> SB[Clean site build and verification]
        SB --> PA[Exact Pages artifact]
    end
    subgraph PrivateLocal[Private local profile]
        LS[Public + private source packages] --> LO[Ignored local artifacts and site]
    end
    LS -. no path .-> PublicCI
```

## Capability → Architecture Map

| Capability / Area | Lives in | Governed by |
| --- | --- | --- |
| Source declaration, cadence, public/private acquisition | `sources/<source-id>/`, Pulse CLI, per-source Actions | AD-2, AD-3, AD-5, AD-8 |
| Immutable archive and full replay | `snapshots/`, snapshot manifests | AD-1, AD-2, AD-4, AD-9 |
| Decode, schema change, assertions | dlt reader/contract, landing Parquet, dbt tests | AD-2, AD-3, AD-9 |
| Wide documented datasets and annotations | source-local dbt models, published Parquet/manifests | AD-1, AD-2, AD-4 |
| Visual authoring and report composition | `site/` reports, `dataClient`, DOM/SVG modules | AD-6, AD-7, AD-9 |
| Browser exploration and static delivery | DuckDB-WASM, Observable build, Pages artifact | AD-6, AD-10 |
| Freshness, suspect data, pipeline visibility | expected-pipeline declarations, status projections, homepage/report adapters | AD-3, AD-4, AD-7 |
| Agent-legible extension workflows | source vertical slices, repository workflow instructions, Pulse CLI, conformance suite | AD-2, AD-8, AD-9 |
| Accessible, responsive, dark-default presentation | shared tokens, visual contract, report slots | AD-7, AD-9, AD-11 |

## Deferred

- Set the numeric cold-load and time-to-first-readable budget from the Observable pilot measurements; revisit before accepting the pilot.
- Choose cross-filtering and per-report versus per-visual query topology only when a report requires shared interactive state.
- Choose each unusual-format parsing library inside its source package; promote it to shared runtime only after a second source needs it.
- Tune Parquet partitioning, compression, and row groups against real dataset sizes; target the PRD's roughly 5–50 MB browser-facing files first.
- Add durable private-archive backup before private history becomes material; v1 local-only private storage remains an accepted risk.
- Revisit the public raw-archive substrate only if observed Git LFS storage or bandwidth becomes material; v1 intentionally does not add object storage, retention tiers, or migration machinery pre-emptively.
- Reconsider Evidence only through an explicit architecture update if its `next` line becomes a released, sustained, contribution-friendly default and Observable fails its pilot or exit seam.
- Multi-source datasets are outside v1; introducing one must revisit per-source rebuild ownership and privacy/status propagation rather than silently spanning source workflows.
- If the dbt-duckdb external-model smoke test fails, choose and record one shared publish fallback before implementing source epics; per-source export variants are prohibited.
