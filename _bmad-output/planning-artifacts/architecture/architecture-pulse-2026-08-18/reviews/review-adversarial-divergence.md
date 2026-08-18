# Reviewer Gate — Adversarial Divergence

## Verdict

**FAIL — one Critical and six High divergence holes remain.** The spine fixes the major tool and dependency boundaries, but several shared protocols are named rather than closed. Independently implemented epics can obey every AD literally while disagreeing on privacy declaration, artifact shapes, dataset identity, client lifetime, catalog uniqueness, status precedence, and retry identity.

## Critical

### D-1 — Explicit report privacy has no canonical owner or serialized field

- **Tier:** Critical
- **Attack pair:** A report epic obeys AD-5 by declaring `private` in Observable page metadata. The site/catalog epic obeys AD-4 by generating exactly the catalog fields listed there—ID, name, route, and last substantive change—and derives privacy only from dataset lineage. A report containing public datasets but explicitly tightened to private is therefore included in the public build because the two units chose different legal homes for the declaration.
- **Why both appear compliant:** AD-5 permits a report to tighten itself to private but never says where that declaration lives. AD-4's report catalog contract omits requested and resolved visibility. The structural seed has no report declaration artifact distinct from framework pages.
- **Consequence:** A deliberately private report can leak into the public Pages artifact even though neither unit knowingly weakens privacy.
- **Close the hole:** **Autofix.** Make one Pulse-owned report declaration/catalog schema authoritative. Require `requested_visibility`, lineage inputs, and `resolved_visibility`; reject missing or unresolved visibility before rendering; include only resolved-public reports in the public build. Observable page metadata may mirror the value but cannot own it.

## High

### D-2 — “Versioned Pulse manifests” do not define one interoperable protocol

- **Tier:** High
- **Attack pair:** A source epic emits YAML manifests with `manifest_version: 2` and nested stage objects. The runtime/site epic accepts JSON `version: 1` with flattened fields. Both include every field AD-4 names, carry a version, and pass their own interpretation of “manifest completeness.”
- **Why both appear compliant:** No canonical encoding, filename, schema identifier, required/optional field set, compatibility policy, or single schema owner is bound. AD-9 requires validation but does not identify the schema against which all epics validate.
- **Consequence:** Source publication succeeds but aggregation, replay, provenance, or browser registration fails at the next boundary.
- **Close the hole:** **Autofix.** Bind all Pulse contracts to one repository-owned schema package with canonical JSON serialization, well-known filenames, schema IDs and versions, strict producer/consumer validation, and an explicit rule that a reader rejects unsupported major versions. Conformance must use these schemas rather than per-source validators.

### D-3 — Dataset identity and browser table registration are undefined

- **Tier:** High
- **Attack pair:** One source epic publishes two datasets as `macro.parquet` and `prices.parquet` and expects DuckDB table names `macro` and `prices`. A report epic refers to `france-macro` and a data-client epic derives table names from `<source-id>`. Every unit uses relative Parquet URLs, schemas, hashes, and manifest-based registration as required.
- **Why both appear compliant:** AD-4 lacks a stable logical dataset/table ID; AD-2 allows datasets in a source slice but does not constrain cardinality or identity; the structural seed keys data only by source ID.
- **Consequence:** Queries bind the wrong table or fail despite valid files and manifests; multi-dataset sources cannot converge.
- **Close the hole:** **Autofix.** Define globally unique stable dataset IDs, for example `<source-id>/<dataset-id>`, and require each browser dataset entry to carry `dataset_id`, logical DuckDB table name, schema version, content hash, represented period, relative URL, and resolved visibility. Reports reference only `dataset_id`; `dataClient` alone maps it to table and URL.

### D-4 — `dataClient` owns disposal but no unit owns its lifetime

- **Tier:** High
- **Attack pair:** Report A treats `dataClient` as report-scoped and disposes the worker/connection on route unmount. Report B treats it as application-scoped and retains queries across navigation. Both obey AD-7 because initialization, cancellation, and disposal remain inside `dataClient`, yet navigating away from A terminates B's shared work.
- **Why both appear compliant:** AD-7 assigns responsibilities but not instance cardinality, lifetime owner, disposal trigger, request cancellation scope, or concurrency behavior.
- **Consequence:** Cross-report navigation and simultaneous visual queries fail nondeterministically; resource leaks emerge if builders defensively avoid disposal.
- **Close the hole:** **Discuss, then fix in AD-7.** Select one lifecycle—prefer one application/page-session client with app-shell disposal and request-scoped cancellation unless the pilot disproves it. State whether reports borrow or instantiate it, whether connections are shared, and which owner may terminate the worker.

### D-5 — Stable report, route, pipeline, and dataset IDs need not be unique

- **Tier:** High
- **Attack pair:** Two report epics independently choose `report_id: macro` or the same `/reports/macro/` route. Likewise, a source pipeline and a well-known site pipeline can both choose `pipeline_id: publish`. Each identifier is stable and kebab-case, satisfying the stated conventions.
- **Why both appear compliant:** Stability and formatting are specified; global namespace ownership, reserved prefixes, collision behavior, and uniqueness validation are not.
- **Consequence:** Catalog entries overwrite each other, routing becomes order-dependent, or one pipeline's health projection replaces another's.
- **Close the hole:** **Autofix.** Define global namespaces and uniqueness rules for source, dataset, report, route, visual-slot, and pipeline IDs. Make catalog/status generation fail on any collision; reserve non-source pipeline IDs or prefix them by kind.

### D-6 — Schema drift, failure stage, and status precedence can conflict

- **Tier:** High
- **Attack pair:** Source A decodes a file missing a required column, classifies the contract violation as an assertion, publishes the dataset, and reports `suspect`. Source B treats the same shape as decode-incompatible, retains the last usable dataset, and reports `failed`. Both can cite AD-3, AD-4, and the Schema drift convention: the bytes are technically decodable, but the required analytical contract is not.
- **Why both appear compliant:** The spine names states and general advancement rules but supplies no canonical stage IDs, condition-to-state decision table, precedence when multiple stages disagree, or distinction among decode compatibility, contract compatibility, and domain assertions.
- **Consequence:** Equivalent failures advance differently across sources; the homepage cannot compare pipeline state reliably; report warning behavior varies by source epic.
- **Close the hole:** **Autofix.** Add one shared stage/state/error contract: canonical stage IDs, normalized error envelope/codes, the exact boundary between `failed` and `suspect`, precedence (`failed > suspect > stale > succeeded`, with `not-run` orthogonal if appropriate), and the rule selecting the latest usable dataset.

### D-7 — Scheduled idempotence has no shared run identity or duplicate rule

- **Tier:** High
- **Attack pair:** A source workflow retry uses a new UTC acquisition timestamp and creates a second snapshot with the same content hash. Another source treats identical content as the same acquisition and skips publication. The serialized writer can atomically commit either behavior, and both implementations reasonably claim to be idempotent.
- **Why both appear compliant:** Snapshot IDs include acquisition time plus a hash, but AD-3 does not define the idempotency key, content-duplicate semantics, retry versus new acquisition, or writer behavior when a target snapshot/run already exists.
- **Consequence:** Retries create false history or, conversely, legitimate repeated publications are silently discarded; freshness and archive-integrity metrics diverge by source.
- **Close the hole:** **Discuss, then fix before source epics.** Define a platform-independent run/acquisition ID, distinguish retry from a new fetch, and bind repository-writer compare-and-commit behavior. Preserve identical observations when they represent distinct scheduled acquisitions, but make retries of one acquisition converge on one change set.

## Medium

### D-8 — Relative Parquet URLs do not define base-path resolution

- **Tier:** Medium
- **Attack pair:** A publisher emits URLs relative to the browser manifest; `dataClient` resolves them relative to the current nested report route. Another publisher assumes repository-root-relative URLs. Both are “relative,” same-origin, and repository-subpath-aware in their own exemplar.
- **Consequence:** A dataset works from the homepage but 404s from nested routes, or works locally at `/` and fails on GitHub project Pages.
- **Close the hole:** **Autofix.** Specify one URL base: manifest-relative URLs resolved with the manifest URL (or a single injected deployment base), never the document route. Add conformance for `/repo-name/` plus nested-route reload.

### D-9 — Visual contract versioning lacks a compatibility and migration rule

- **Tier:** Medium
- **Attack pair:** One visual epic targets contract v1 with `{rows, options}`; another targets v2 with `{rows, display, provenance}`. Each declares its version and passes its own fixture tests, while a report composer assumes one uniform invocation shape.
- **Consequence:** Reports require visual-specific adapters, defeating the predictable registration boundary and making schema-change workflows branch by visual vintage.
- **Close the hole:** **Autofix.** Name one current visual-contract major accepted by report slots and conformance; require atomic migration or an application-owned adapter for older majors. Visuals cannot ship a new major by themselves.

### D-10 — Shared semantic tokens have no mutation owner

- **Tier:** Medium
- **Attack pair:** Two visual epics both extend the shared token set with `--state-warning`, one meaning suspect data and the other meaning interaction caution, while satisfying dark theme, AA contrast, and non-color communication.
- **Consequence:** Cross-report semantics drift even though every individual visual is accessible.
- **Close the hole:** **Defer explicitly or fix in the exemplar.** Assign the shared token module one owner and require visual epics to consume existing semantic roles; additions change the shared contract and need cross-report review.

## Low

No additional low-tier findings. The remaining deferred items are appropriately scoped: report-specific cross-filter topology, source-local parsing libraries, measured Parquet tuning, private backup, Evidence reconsideration, multi-source datasets, and the external-materialization fallback all carry a revisit condition or prohibition against incompatible local variants.

## Gate disposition

- **Autofix before finalization:** D-1, D-2, D-3, D-5, D-6, D-8, D-9.
- **Discuss before finalization:** D-4 and D-7, because lifecycle and acquisition identity require a real ownership choice.
- **May defer with an explicit owner/revisit trigger:** D-10.
- **Ignore:** none.
