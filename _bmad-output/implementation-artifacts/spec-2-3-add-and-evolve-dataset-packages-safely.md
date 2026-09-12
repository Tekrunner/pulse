---
title: 'Story 2.3: Add and Evolve Dataset Packages Safely'
type: 'feature'
created: '2026-09-12'
status: 'done'
baseline_commit: 'bc0adeb8ac0f4984a7beed0d8bb5e269e9ea0e90'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pulse can build its existing INSEE datasets, but agents lack source-neutral workflows and reusable fixtures for adding indicators or evolving dataset schemas without overlooking consumers. The Story 2.2 source workflow also permits original-file snapshots that the current Parquet-only dataset input cannot consume.

**Approach:** Add separate agent skills for dataset/indicator creation and schema evolution, supported by neutral dbt-on-DuckDB templates, executable conformance fixtures, consumer-impact classification, and safe migration or compatibility-adapter gates. Dataset packages express analytical transformations and data tests as dbt models executed by DuckDB, producing report-facing Parquet from immutable snapshots. Strengthen the shared dataset runtime only where the neutral second implementation proves a common contract, including faithful input decoding and atomic publication.

## Boundaries & Constraints

**Always:** Start from an existing immutable snapshot contract; keep source acquisition separate from analytical transformation. Implement dataset transformations and data-quality tests as package-owned dbt models running on DuckDB, and materialize typed, wide report-facing Parquet through the shared Pulse dataset build command. Publish stable kebab-case identity and machine-readable question, derivation, unit, definition, provenance, licence, attribution, temporal meaning, type, and validation rules. Inventory every dataset, report query, exploration query, visual schema/fixture, lineage declaration, test, and catalog consumer before schema edits. Classify changes as compatible addition, compatible modification, or breaking consumer change; migrate all affected consumers atomically or use an application-owned, tested adapter with explicit versions, owner, and removal condition. Retain the last usable dataset on any failure.

**Ask First:** Introducing a dataset-contract major version; adding a dependency; weakening strict manifests, immutable archives, registry-free discovery, public-profile closure, or existing consumer behavior; accepting a breaking change without complete migration evidence.

**Never:** Copy INSEE transformations or report-specific queries into templates; bypass dbt with ad hoc production transformation code or introduce another analytical engine; put analytical semantics in source packages; mutate archived snapshots or require persisted warehouse migrations; silently coerce missing or incompatible fields; let provider- or visual-specific compatibility logic enter shared runtime; expose a new schema to old consumers; modify Story 2.2's intentional sprint review state.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Add dataset or indicator | Approved requirement and suitable snapshot | Package-owned dbt models and tests run on DuckDB and materialize typed wide Parquet, complete semantics, manifest hashes, and catalog metadata | Missing snapshot routes to `pulse-add-source`; no dataset is invented |
| Compatible addition | New source field or additive indicator | Addition is reported; existing columns and consumers retain behavior | Missing required field or incompatible type rejects candidate and retains prior publication |
| Breaking change | Removed, renamed, or retyped consumed column | Complete impact inventory requires atomic migration or declared compatibility adapter | Incomplete or unsupported migration fails before publication |
| Rebuild | Immutable API-Parquet or original-file snapshot | Deterministic output and a coherent manifest/Parquet pair | Source bytes remain unchanged; partial publication cannot replace the last usable pair |
| Consumer validation | Non-empty data reaches reports and visuals | Declared schemas, queries, joins, accessible tables, and rendered output are correct and non-empty | Schema mismatch and silent empty/incorrect output fail visibly without disabling siblings |

</frozen-after-approval>

## Code Map

- `.agents/skills/pulse-add-source/` -- packaging, concise routing, references, assets, agent metadata, and offline forward-test pattern; read-only Story 2.2 evidence.
- `runtime/pulse/datasets.py:54-413` -- dataset contracts/discovery, snapshot selection, exact output checks, builder loading, and publication; generalize input artifacts and make dataset plus manifest publication atomic.
- `runtime/pulse/contracts/dataset.py:19-64` -- strict v1 manifest and committed-contract equality; extend only for explicit neutral evolution metadata or adapter contracts.
- `runtime/pulse/catalog.py:53-335` -- browser projection, report column/lineage validation, and generated catalogs; reuse and extend for impact evidence rather than hand-editing outputs.
- `datasets/_shared/insee_cpi.py:68-91` and `tests/fixtures/dbt_external/` -- existing dbt runner and independent neutral mechanics; extract only provider-neutral execution while leaving INSEE selection local.
- `site/reports/french-consumer-prices/report.yml:5-29`, `report.js:25-1007`, `site/reports/report.js:6-91` -- declared and currently undeclared SQL/exploration consumers that impact discovery must cover.
- `site/visuals/*.js`, `site/visuals/line.contract.js` -- visual consumer schemas, adapters, and fixture surfaces; schema failures and non-empty correctness require conformance evidence.
- `tests/datasets/test_insee_cpi_datasets.py:51-229`, `tests/runtime/test_catalog.py`, `tests/browser/pilot.spec.js` -- current deterministic build, retention, neutral inline fixture, catalog, and failure-isolation evidence to preserve and broaden.

## Tasks & Acceptance

**Execution:**
- [x] `.agents/skills/pulse-add-dataset/` and `.agents/skills/pulse-change-dataset-schema/` -- create independently discoverable skills, focused references, agent metadata, neutral declarations and dbt-on-DuckDB model/data-test fixtures, impact inventory, and compatibility-adapter assets.
- [x] `runtime/pulse/datasets.py`, `runtime/pulse/contracts/dataset.py`, `runtime/pulse/cli.py` -- add neutral snapshot decoding/build seams, complete semantic validation, pre-change impact/classification support, explicit adapter validation, and atomic publish/retention behavior through the sole Pulse CLI.
- [x] `runtime/pulse/catalog.py`, `site/data/client.js`, report/visual contract seams -- ensure changed schemas are checked against declarative and code-owned consumers, adapters, mapped rows, accessible equivalents, and non-empty visual output without changing unaffected behavior.
- [x] `tests/datasets/`, `tests/runtime/`, `tests/node/`, `tests/browser/` -- forward-test both skill bundles and every matrix case, including original-file input, additions, type/removal failures, atomic write interruption, migration, adapter coexistence/removal, undiscovered SQL consumers, and silent visual corruption.

**Acceptance Criteria:**
- Given an approved dataset requirement, when an agent follows `pulse-add-dataset`, then it creates package-owned dbt models and tests that run on DuckDB and materialize report-facing Parquet, every required decision and artifact is available without reading INSEE or a report implementation, and missing acquisition routes only to `pulse-add-source`.
- Given any proposed schema edit, when `pulse-change-dataset-schema` runs, then it produces a complete classified consumer inventory before implementation and blocks incomplete breaking changes.
- Given a valid additive change or approved migration/adapter, when repository-wide verification runs, then affected consumers render correct accessible output and unrelated sources, datasets, reports, visuals, schedules, and public artifacts retain behavior.

## Spec Change Log

## Design Notes

Treat generated browser catalogs as evidence, not authorities. Prefer a conservative impact scanner that combines declarations with repository search and requires human-owned classification for ambiguous SQL/JavaScript uses; a false positive is safer than an invisible consumer. A compatibility adapter belongs at the application dataset-consumption boundary and must not reinterpret provider bytes.

## Verification

**Commands:**
- `python /home/yfontana/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/pulse-add-dataset` and the same command for `pulse-change-dataset-schema` -- expected: both skills are valid and complete.
- `uv run --no-sync pytest tests/datasets tests/runtime -q` -- expected: neutral and existing dataset contracts pass offline.
- `uv run --no-sync pulse verify` -- expected: full Python, Node, browser, workflow, and public-artifact verification passes.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Agent workflows**

- Starts dataset creation from immutable snapshots and package-owned dbt models.
  [`SKILL.md:8`](../../.agents/skills/pulse-add-dataset/SKILL.md#L8)

- Makes consumer inventory and migration classification mandatory before schema edits.
  [`SKILL.md:8`](../../.agents/skills/pulse-change-dataset-schema/SKILL.md#L8)

- Provides a neutral original-file-to-Parquet dbt package agents can execute directly.
  [`build.py:1`](../../.agents/skills/pulse-add-dataset/assets/dataset-package/build.py#L1)

**Dataset contract and publication**

- Validates complete questions, temporal meaning, semantics, and executable validation declarations.
  [`datasets.py:103`](../../runtime/pulse/datasets.py#L103)

- Conservatively classifies edits and inventories declarative plus code-owned consumers.
  [`datasets.py:208`](../../runtime/pulse/datasets.py#L208)

- Publishes Parquet and manifest as one recoverable directory-level unit.
  [`datasets.py:506`](../../runtime/pulse/datasets.py#L506)

- Blocks incomplete migrations and controls compatibility-adapter lifecycle.
  [`datasets.py:545`](../../runtime/pulse/datasets.py#L545)

- Centralizes provider-neutral dbt-on-DuckDB execution for all dataset packages.
  [`dbt.py:12`](../../runtime/pulse/dbt.py#L12)

**Impact and browser consumers**

- Exposes pre-change classification and inventory through the sole Pulse CLI.
  [`cli.py:106`](../../runtime/pulse/cli.py#L106)

- Projects rich semantics and optional adapters while retaining legacy v1 validation.
  [`catalog.py:82`](../../runtime/pulse/catalog.py#L82)

- Creates safe compatibility views and validates queried and mapped rows.
  [`client.js:106`](../../site/data/client.js#L106)

- Enforces schema and non-empty guarantees at each report figure boundary.
  [`report.js:279`](../../site/reports/french-consumer-prices/report.js#L279)

**Conformance evidence**

- Exercises neutral builds, additions, failures, migrations, adapters, and atomic rollback.
  [`test_dataset_evolution.py:49`](../../tests/datasets/test_dataset_evolution.py#L49)

- Proves mapped corruption remains slot-local and preserves accessible sibling figures.
  [`pilot.spec.js:215`](../../tests/browser/pilot.spec.js#L215)

- Preserves compatibility with browser catalogs emitted before adapters were introduced.
  [`test_catalog.py:83`](../../tests/runtime/test_catalog.py#L83)
