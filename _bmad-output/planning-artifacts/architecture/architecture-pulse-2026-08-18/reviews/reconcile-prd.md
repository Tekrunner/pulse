# PRD reconciliation — Architecture Spine

## Verdict

**Needs revision before finalization.** The spine is directionally aligned and captures the central artifact pipeline, source isolation, privacy propagation, framework exit seam, and agent-legible automation. It does not yet justify its frontmatter claim to bind all `FR-1..FR-26, NFR-1..NFR-6`: four load-bearing requirements are contradicted or materially weakened, and several testable PRD/addendum constraints quietly disappear.

This review compares only:

- `ARCHITECTURE-SPINE.md` (draft dated 2026-08-18)
- the finalized `prd.md` (updated 2026-08-08)
- `addendum.md`

It does not propose a larger solution design; each correction below is an invariant or explicit deferral needed to keep independently built units from diverging.

## Blocking contradictions and omissions

### 1. Critical — per-source publication contradicts full warehouse rebuild semantics

- **Authoritative requirement:** PRD FR-6 says the warehouse is rebuilt **in full from the raw archive on every pipeline run**; deleting it and rebuilding must yield an equivalent result (PRD lines 168–175). FR-3 also requires an on-demand run for the whole pipeline or a single source (lines 139–146).
- **Spine:** AD-3 gives each source an independently scheduled workflow “through publication” and retains the last derived dataset for a failed source; AD-8 describes source-scoped computation and source-scoped repository writes (spine lines 53–57, 95–99). No rule says a source-triggered run reconstructs the complete warehouse from committed raw snapshots.
- **Why this matters:** independent source units can implement incremental/source-local publication, while another unit assumes every publish is a coherent full rebuild. Those are incompatible warehouse semantics and affect reproducibility, status, and report consistency.
- **Required reconciliation:** either restore FR-6 literally (all publish runs rebuild the complete public warehouse from the raw archive, with source acquisition allowed to be independent), or explicitly amend the PRD. If “single-source on demand” only acquires a new snapshot before a full warehouse rebuild, say so. If source-local rebuilds are intended, that is a product requirement change, not an implementation detail.

### 2. Critical — retained Git LFS decision is absent

- **Authoritative requirement:** public raw snapshots are committed in-repository **via Git LFS** (PRD MVP line 408; addendum A.1 lines 11–17). Any checkout that consumes snapshots must use `lfs: true`, and clone instructions must require `git lfs install`.
- **Spine:** AD-10 says immutable public snapshots live on the default branch, but never binds their storage to Git LFS; the structural seed likewise shows a normal `snapshots/` tree (spine lines 107–111, 151–156).
- **Why this matters:** different epics can commit raw blobs directly, CI can rebuild from LFS pointer files, and UJ-6/NFR-2 can appear to pass without fetching actual snapshots.
- **Required reconciliation:** make Git LFS the public raw-snapshot transport; require tracked patterns, LFS-aware CI checkout for every raw-consuming job, and clone/rebuild prerequisites. Keep derived Parquet/site artifacts outside LFS unless separately decided.

### 3. Critical — the absolute no-visualization-library constraint is reduced to a pilot example

- **Authoritative requirement:** no visual is authored or rendered using a chart or visualization library **at any layer**; this is the sole closed layer and may not be optimized away (PRD lines 30–35, 49–57, FR-12 lines 229–235; addendum C.4 lines 215–233). An unused transitive chart dependency is allowed; use is not.
- **Spine:** AD-6 requires only the pilot's one representative visual to avoid a visualization library. AD-7's permanent dependency rule prohibits SQL, DuckDB, Parquet paths, Observable protocols, and routing, but does **not** prohibit visualization-library imports or rendering (spine lines 71–81).
- **Why this matters:** after the pilot, a visual epic can legitimately introduce D3/Plot/ECharts under the current permanent rules while still satisfying the spine.
- **Required reconciliation:** put the no-use rule in the invariant governing **every** visual and authoring workflow, with the PRD's presence-versus-use qualification. The pilot check is verification, not the durable rule.

### 4. Critical — FR-26's self-staleness failure mode is not solved

- **Authoritative requirement:** the homepage must report its own generation time; an older-than-expected homepage reads as a fault; a stage that never ran differs from one that succeeded; and a pre-publish failure must not leave an old homepage silently claiming health (FR-26, PRD lines 339–347). FR-19 requires fetch, snapshot, warehouse, report-generation, and publish state (lines 315–322).
- **Spine:** AD-4 defines per-source status with “stage outcomes, freshness, assertions, and latest usable dataset,” but does not require site-generation age evaluation, explicit `not-run`, report-generation status, or publish status. A static site that fails before publish cannot receive a new failure projection (spine lines 59–63, 184–185).
- **Why this matters:** the exact silent-success failure the PRD calls dangerous remains possible: yesterday's green static artifact can stay green after today's build or deploy failure.
- **Required reconciliation:** define the durable status state machine and the static-client rule that compares site generation time/expected cadence with current time, including `not-run`, failed prepublish, and stale-artifact behavior. If an external status channel is required for publish failures, bind it; otherwise state how the deployed static artifact becomes visibly stale without a successful replacement deploy.

## High-severity quiet drops

### 5. High — agent-authored, schema-first visual workflow and written data-interface contract are missing

- **Authoritative requirement:** a visual is agent-authored against a declared schema/mock array, then a coding agent substitutes real query rows and registers it; the two steps must remain separable (FR-10/FR-11, PRD lines 207–227; addendum C.1–C.2 lines 191–209). The data-interface contract must be written as a specification, and schema changes must produce detectable breaks (FR-10 lines 214–220).
- **Spine:** AD-7 defines a useful runtime dependency direction and AD-9 allows mock-row tests, but neither binds agent authorship, declared column schemas, the two-step substitution workflow, a separately written conformance specification, or schema-change break detection (spine lines 77–81, 101–105).
- **Risk:** teams can design visuals only after live data exists, hand-wire each report differently, or treat an exemplar as the implicit contract—the exact drift FR-10/11 prohibit.
- **Required reconciliation:** bind the authoring/wiring split, declared-schema fixture shape, contract artifact, registration surface, and consumer-contract validation on dataset schema change.

### 6. High — `dbt-duckdb external` publish mechanism and its mandatory smoke-test gate disappear

- **Authoritative requirement:** the addendum recommends `external` materialization as the Parquet publish layer but explicitly gates it on proving a `not_null` test and `ref()`/catalog behavior (addendum A.5 lines 55–65). The MVP repeats that gate (PRD lines 407–413).
- **Spine:** AD-2 assigns published Parquet to dbt-duckdb but leaves the materialization mechanism open; no smoke-test gate exists (spine lines 47–51).
- **Risk:** an implementation can build the pipeline atop unverified external-model testing semantics, or different source epics can invent different export paths.
- **Required reconciliation:** either bind external materialization conditional on the smoke test, with a named fallback if it fails, or explicitly defer the mechanism while retaining the pre-build gate. Do not silently convert the conditional MVP decision into an unspecified output.

### 7. High — source release-calendar semantics for assertions are dropped

- **Authoritative requirement:** “latest period advanced” is evaluated against the source's **publication schedule**, not its ingestion cadence; an annual series fetched monthly is not stale eleven months of the year (FR-9, PRD lines 197–203).
- **Spine:** source declarations and the seed contain cadence, but no release calendar; AD-4/AD-9 mention freshness and assertions without fixing this distinction (spine lines 59–63, 101–105, 144–149).
- **Risk:** source implementations will conflate fetch cadence and expected-data cadence, yielding incompatible and noisy health signals.
- **Required reconciliation:** require source metadata/assertion logic to represent expected publication advancement separately from fetch cadence, and make freshness/status consume that contract.

### 8. High — machine-readable dataset semantic-layer obligations are weakened to “documented”

- **Authoritative requirement:** every dataset and column has machine-readable descriptions; each indicator carries unit, definition, source, and required attribution; missing documentation is detectable (FR-8, PRD lines 189–195).
- **Spine:** AD-2 mentions a schema contract and the capability map says “wide documented datasets,” while AD-4's snapshot manifest carries source licence/attribution. It does not bind dataset/column documentation shape, indicator metadata propagation, or detection of omissions (spine lines 47–51, 59–63, 181).
- **Risk:** one dataset can publish dbt docs, another prose, and another only manifest provenance; visual-authoring agents then lack a stable semantic briefing.
- **Required reconciliation:** define an application-owned, machine-readable dataset/column/indicator metadata contract and conformance checks, including attribution propagation.

### 9. High — extension workflow artifacts and exemplars are not actually bound

- **Authoritative requirement:** “add source,” “add indicator,” “add visual,” “add report,” and “change dataset schema” each have a defined workflow; shape repeats but implementation is shared; every workflow points to a complete repository exemplar (FR-22–FR-24, PRD lines 351–373).
- **Spine:** AD-2 provides a source folder shape, AD-8 a CLI, and AD-9 conformance tests, but there is no rule that workflow artifacts exist, cover all five acts, point to exemplars, or prevent duplicated ingestion implementation. Visual/report workflow shape is absent (spine lines 47–51, 95–105).
- **Risk:** the architecture supplies mechanisms but drops a product deliverable central to agent legibility and portfolio value.
- **Required reconciliation:** bind repository-owned workflow instructions, their five required scopes, exemplar links, and the rule for promoting repeated source logic into shared implementation.

## Medium-severity gaps

### 10. Medium — optional reader exploration is conflated with universal DuckDB-WASM delivery

- **Authoritative requirement:** addendum C.4 supersedes baked JSON with DuckDB-WASM on all pages (lines 215–237), but FR-25 still makes **exploration beyond pre-composed content** a per-report opt-in; a non-opt-in report remains fully pre-composed and requires no interaction (PRD lines 283–291).
- **Spine:** every report owns controls/reactivity and parameterized SQL; no per-report exploration declaration or fully pre-composed default is preserved (spine lines 77–81).
- **Required reconciliation:** separate the universal data-delivery mechanism from optional reader-facing exploration. Bind the per-report opt-in without reintroducing two delivery paths.

### 11. Medium — report-local privacy override is omitted

- **Authoritative requirement:** private-source lineage propagates, **and** a report can independently declare itself private; that declaration only tightens privacy (FR-17, PRD lines 274–281).
- **Spine:** AD-5 fully covers lineage propagation but mentions no report-local privacy override (spine lines 65–69).
- **Required reconciliation:** include explicit report-private classification as a monotonic override in the same privacy contract and profile conformance tests.

### 12. Medium — DuckDB-WASM hosting decision is incomplete

- **Authoritative requirement:** target the single-threaded **EH** bundle, require no special headers, and do not adopt `coi-serviceworker`; migration to a header-capable host is conditional on profiling proving threads necessary (addendum A.2 lines 19–35).
- **Spine:** GitHub Pages, same-origin Parquet, and no special-header dependency are implied, but bundle selection and the prohibited workaround are absent (spine AD-6/AD-10, lines 71–75 and 107–111).
- **Risk:** independent implementation can choose COI plus `coi-serviceworker`, contradicting the resolved hosting decision while still claiming DuckDB-WASM compliance.
- **Required reconciliation:** bind EH/single-threaded as the v1 bundle and explicitly defer COI/host migration behind profiling; prohibit `coi-serviceworker` for v1.

### 13. Medium — free-tier operation is not an architecture constraint

- **Authoritative requirement:** normal operation must remain within hosting and automation free tiers (NFR-4, PRD line 397), with LFS quota assumptions recorded in addendum A.1.
- **Spine:** it names hosted GitHub Actions/Pages but contains no cost/quota guard, measurement, or revisit condition.
- **Required reconciliation:** bind free-tier normal operation and identify the quantities to watch (LFS storage/bandwidth, Actions/runtime, Pages artifact size). This can be a constraint plus thresholds deferred to provider limits; it should not disappear.

### 14. Medium — source snapshot representation is incomplete

- **Authoritative requirement:** file-based sources retain original format; other source snapshots are Parquet (FR-5, PRD lines 160–166).
- **Spine:** it clearly preserves original file bytes for file sources but does not state the canonical raw representation for non-file sources (spine AD-2 lines 47–51).
- **Required reconciliation:** bind non-file raw snapshots to Parquet or explicitly amend FR-5. The landing Parquet is disposable and cannot substitute for the durable raw snapshot.

### 15. Medium — local serving and whole-pipeline on-demand entry points are only implied

- **Authoritative requirement:** opening locally is one command (FR-18, PRD lines 299–305); on-demand execution supports both one source and the whole pipeline (FR-3 lines 139–146).
- **Spine:** AD-8 calls the CLI the high-level API for “source runs … and site builds” but does not bind a local-serve command or a whole-pipeline run (spine lines 95–99).
- **Required reconciliation:** name these as required CLI capabilities, leaving command spelling to implementation.

## Correctly carried forward

The following load-bearing inputs did land and should be preserved while fixing the gaps:

- archive-first immutable artifacts and disposable derived state (AD-1)
- source discovery without a central registry and dlt/dbt ownership separation (AD-2)
- suspect-but-decodable data advances and is visibly marked (AD-3/AD-4)
- structural public/private lineage propagation and credential isolation (AD-5)
- Observable behind a Vite-tested exit seam and real Pages-subpath pilot (AD-6)
- framework-neutral data-client/visual dependency direction and explicit no-data/query-error states (AD-7)
- a shared local/CI automation API with serialized repository writes (AD-8)
- offline fixture conformance and browser integration verification (AD-9)
- locked runtimes, exact-artifact deployment, same-origin Parquet, and 5–50 MB performance starting point (AD-10/Deferred)
- annotations as data, wide report-facing datasets, UTC/acquisition/source-date separation, and schema-drift recording (Consistency Conventions)
- the deliberate deferral of cross-filter/query topology and private backup.

## Reconciliation gate

Do not mark the spine final until findings 1–9 are either incorporated as invariants or explicitly recorded as approved upstream requirement changes. Findings 10–15 may be resolved by small rule additions or precise Deferred entries, but silence is not sufficient because each permits incompatible downstream implementations.
