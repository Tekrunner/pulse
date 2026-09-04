---
title: 'Story 1.4: Transform and Publish the First INSEE Dataset'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
baseline_commit: '505c86cff0d3e9cca5b4ac5242b71116658f3921'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

> Superseded architecture note (approved 2026-09-03): Story 1.5b migrates this source-local implementation into an independently discovered dataset package. This file remains the historical implementation record.

## Intent

**Problem:** The committed INSEE archive is faithful but not report-ready: no replayable landing boundary, typed wide analytical dataset, semantic metadata, or source-specific quality result exists.

**Approach:** Build the source-local, offline transformation slice from immutable snapshots through validated landing and dbt-duckdb stages, publishing deterministic public Parquet and lineage manifests while retaining the last usable output on invalid input.

## Boundaries & Constraints

**Always:** Rebuild from committed raw snapshots alone; reject unresolved LFS pointers; preserve snapshot bytes and source-faithful landing values; keep dlt responsible for landing and dbt-duckdb solely responsible for analytical typing, models, tests, disposable DuckDB materialization, and external Parquet. Use strict versioned `landing.json`, `dataset.json`, and sanitized diagnostic contracts; publish one wide, correctly typed `insee-cpi` dataset with unique dataset/table identities, public visibility, SHA-256 content hash, represented period, source/snapshot lineage, and complete model, column, indicator, licence, and attribution metadata. Record compatible observed-schema additions without dropping them. Keep all ordinary tests offline and deterministic.

**Ask First:** Stop if actual INSEE data requires a changed CPI indicator scope, a new publication-root/manifest ownership model outside the agreed artifact boundaries, a dbt external-publication fallback, credentials/network access, or a new Parquet tuning strategy justified by size measurement.

**Never:** Re-fetch or re-decode SDMX during replay; depend on dlt state, a previous landing/warehouse/publication, author-machine state, or mutable generated output; publish a raw tall-observation table; accept missing/incompatible/unfaithfully decodable data; replace the last usable dataset after a failed candidate; make assertion failure block publication of a contract-valid suspect dataset; expose raw errors or private inputs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Clean replay | Committed valid INSEE raw snapshot; no build outputs | Faithful landing Parquet and validated landing manifest, then wide typed external Parquet and linked dataset manifest | Repeated clean replays have equivalent rows, schema, semantics, and content hash |
| Compatible schema addition | Raw rows include an undeclared additive field | Record complete observed schema and report the addition while retaining faithful landing data | Continue only when required contract fields/types remain valid |
| Invalid raw/contract | LFS pointer, missing required field, incompatible type, or undecodable content | No landing/dataset candidate is accepted | Emit versioned safe diagnostic; retain prior usable selection, or select none if absent |
| Assertion failure | Contract-valid transformed rows fail plausibility or release-aware freshness | Publish usable data plus structured suspect result and affected columns | Do not block unrelated processing |

## Analytical Model

The committed sample contains 1,101 observations: exactly three provider series for each of 367 months from `1996-01` through `2026-07`. Publish dataset ID `insee-cpi/monthly`, logical DuckDB table `insee_cpi_monthly`, at one row per represented month (367 rows for this snapshot). Do not calculate the three headline values from one another; each is the typed value of its authoritative provider series.

| Output column | DuckDB type | Provider mapping | Meaning |
|---|---|---|---|
| `period` | `DATE` | `TIME_PERIOD` plus `-01` | First day of the represented month; unique and non-null |
| `cpi_index` | `DECIMAL(12,2)` | `IDBANK=011814056`, `OBS_VALUE` | CPI level, Base 2025 = 100, all households, France, excluding tobacco |
| `monthly_change_pct` | `DECIMAL(8,1)` | `IDBANK=011814057`, `OBS_VALUE` | Provider-published month-over-month percentage change |
| `annual_change_pct` | `DECIMAL(8,1)` | `IDBANK=011814058`, `OBS_VALUE` | Provider-published year-over-year percentage change |

Keep provider-native `OBS_STATUS`, `OBS_QUAL`, `DATE_JO`, and `LAST_UPDATE` in landing and lineage metadata, not as report-facing measures. The dataset manifest must identify each output value column's provider series ID, French provider title, definition, unit, decimal precision, Base-2025 context, source, licence, and attribution. For the observed sample, validate exactly one row per `(IDBANK, TIME_PERIOD)`, all three recognized series per month, valid finite numeric values, `FREQ=M`, `REF_AREA=FE`, `UNIT_MULT=0`, and the declared titles. Assert `cpi_index > 0`, percentage values within `[-100, 100]`, contiguous monthly periods, and provider-published changes within `0.051` percentage point of changes recomputed from the rounded index where comparison history exists. A failed plausibility or freshness assertion marks the valid dataset suspect; duplicate grain, missing series, invalid types, or contract-field mismatch rejects the candidate.
</frozen-after-approval>

## Code Map

- `runtime/pulse/cli.py:12-67` -- sole high-level automation entry point; extend it with source replay/publish commands rather than a second pipeline interface.
- `runtime/pulse/contracts/snapshot.py:17-105` and `runtime/pulse/contracts/` -- strict manifest-validation style and natural home for landing, dataset, and safe diagnostic contracts.
- `runtime/pulse/archive.py:30-43,114-160` -- reuse SHA-256 and LFS-pointer rejection safeguards; do not alter immutable archive semantics.
- `runtime/pulse/sources.py`, `sources/insee-cpi/acquire.py:86-151`, `sources/insee-cpi/source.yaml` -- existing discovered-source contract and faithful raw-provider boundary; downstream replay must consume raw Parquet rather than invoke acquisition.
- `snapshots/public/insee-cpi/` -- committed LFS-backed replay input; currently proves 1,101 raw rows, 367 complete monthly triplets, and the `1996-01`–`2026-07` represented range.
- `tests/fixtures/dbt_external/`, `tests/data_tools/test_dbt_external.py:16-102` -- proven dbt-duckdb external/ref/test pattern and isolated subprocess fixture approach to adapt for the source project.
- `tests/sources/test_insee_cpi.py`, `tests/fixtures/insee-cpi/`, `runtime/pulse/verify.py` -- offline conformance and aggregate-verifier seams to extend without live INSEE access.
- `_bmad-output/implementation-artifacts/spec-1-3-prove-live-insee-contract-and-decouple-source.md` -- completed source-boundary corrections and handoff constraints.

## Tasks & Acceptance

**Execution:**

- [x] `runtime/pulse/contracts/`, `runtime/pulse/transform.py` -- define strict landing/dataset/diagnostic/status contracts and implement snapshot-only replay, atomic candidate handling, selected-output retention, hashes, schema-drift reporting, and deterministic publication orchestration.
- [x] `sources/insee-cpi/` and a source-local dbt project -- add the raw landing adapter plus dbt-duckdb source/models/schema tests that map the three declared Base-2025 CPI series into one documented wide dataset, enforce typing/nullability/domain/row-count and release-calendar-aware freshness, and publish external Parquet.
- [x] `runtime/pulse/cli.py`, `runtime/pulse/verify.py`, `.gitignore` -- expose documented replay/publish commands through the sole CLI, include offline source conformance in verification, and keep landing, DuckDB, and generated build state disposable while retaining the intended public publication artifacts.
- [x] `tests/sources/`, `tests/runtime/`, `tests/fixtures/insee-cpi/` -- cover clean raw replay, manifest completeness and collisions, semantic metadata, deterministic rebuild, compatible/incompatible drift, LFS rejection, invalid-candidate retention, suspect publication, release timing, public profile, and measured browser-delivery size without network access.
- [x] `README.md`, `sources/insee-cpi/source-contract.md` -- document replay, published-data location and contract, selected indicator semantics, offline verification, and the observed initial Parquet size against the 5–50 MB target.

**Acceptance Criteria:**

- Given only the committed valid archive, when source replay runs after all disposable outputs are removed, then it reconstructs validated landing and report-facing artifacts without dlt state, a prior warehouse/publication, network access, or author-machine state.
- Given valid landing data, when the INSEE dbt project runs, then dbt-duckdb exclusively produces the specified 367-row `insee-cpi/monthly` sample model with one date and three typed provider measures per month, complete machine-readable semantic metadata, and strict snapshot/landing lineage.
- Given compatible additions, invalid inputs, identity/table collisions, and assertion failures, when conformance runs, then additions are reported, invalid candidates are rejected without displacing usable output, collisions fail, and contract-valid assertion failures publish as structured suspect data.
- Given repeated offline rebuilds from the same archive and locked toolchain, when outputs are compared, then analytical rows, schema, semantics, and content hash are equivalent despite execution timestamps; the fixture suite covers all required drift, freshness, manifest, profile, and delivery cases without contacting INSEE.

## Design Notes

The raw snapshot is an immutable source fact; landing preserves that fact with explicit lineage, while dbt owns the semantic projection. Candidate validation precedes selection so a bad new observation cannot make a known-good report disappear. Treat assertion outcome as lineage/status beside valid content, not as permission to discard it.

## Verification

**Commands:**

- `uv run pytest tests/sources tests/runtime tests/data_tools -q` -- expected: fully offline replay, dbt, contract, and failure-path coverage passes.
- `uv run pulse source replay insee-cpi` -- expected: rebuilds the selected source from committed raw snapshots without contacting INSEE.
- `uv run pulse verify` -- expected: aggregate workspace and source conformance checks pass offline.
- `git diff --check` -- expected: no whitespace errors or generated disposable outputs.

## Suggested Review Order

**Replay boundary and candidate safety**

- Start at the sole source-replay entry point and its path normalization.
  [`cli.py:63`](../../runtime/pulse/cli.py#L63)

- Validate immutable input, faithful landing, selected-output retention, and safe diagnostics.
  [`transform.py:49`](../../runtime/pulse/transform.py#L49)

- Inspect source-grain, freshness, plausibility, and published-manifest validation.
  [`transform.py:103`](../../runtime/pulse/transform.py#L103)

**Analytical projection**

- dbt produces exactly one typed wide row per represented month.
  [`insee_cpi_monthly.sql:1`](../../sources/insee-cpi/dbt/models/insee_cpi_monthly.sql#L1)

- Strict contracts make public dataset and failure metadata machine-readable.
  [`dataset.py:17`](../../runtime/pulse/contracts/dataset.py#L17)

**Evidence and operation**

- Offline conformance proves replay, drift, rejection, suspect status, and release timing.
  [`test_insee_cpi_transform.py:36`](../../tests/sources/test_insee_cpi_transform.py#L36)

- The documented command, output location, and delivery-size observation support repeatable use.
  [`README.md:73`](../../README.md#L73)
