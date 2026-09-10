---
title: 'Story 1.8: Run INSEE Acquisition and Downstream Builds Automatically and On Demand'
type: 'feature'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 0
baseline_commit: '84bed2636d81a7458370161b8a73cf89012a6a5c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** INSEE acquisition and dataset publication are separate local commands. Pulse lacks scheduled/manual refresh, retry-stable identity, persisted acquisition failures, and serialized publication.

**Approach:** Add a source-neutral refresh path that acquires, discovers and builds declared dependents, and records safe outcomes. A thin INSEE workflow invokes it from a shared writer job based on current `main` and commits one scoped change.

## Boundaries & Constraints

**Always:** Use the CLI and declarations as the orchestration API; reuse one acquisition ID per logical run; build affected datasets independently and preserve usable output; serialize default-branch writes through `pulse-repository-writer` with cancellation disabled; materialize only INSEE LFS inputs; commit validated source, dependent-dataset, and status artifacts atomically; publish safe failure state before failing; use frozen Python 3.13/uv, least privilege, and automatic execution at 06:17 UTC on day 23 of each month plus `workflow_dispatch` on demand.

**Ask First:** New secrets/services, public contract-major changes, scope beyond INSEE and discovered dependents, or history/artifact rewrites.

**Never:** Put dataset knowledge in workflow YAML; import source code from dataset orchestration; push from runtime code; bulk-fetch LFS; expose unsafe diagnostics; add keepalive automation; make PR verification live.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New observation | Monthly schedule or manual dispatch | Archive once; build only declared dependents; commit artifacts/status | Succeed |
| Retry | Same logical run and bytes | Recover ID; no duplicate snapshot, rebuild, or empty commit | Succeed |
| Conflicting retry | Same ID, different bytes | Preserve archive and datasets | Safe diagnostic; fail |
| Degraded dependent | Snapshot valid; dataset suspect/failed | Publish valid suspect output; retain usable output on failure; continue siblings | Commit safe outcomes; hard failure fails |
| Acquisition failure | No valid snapshot | Publish sanitized source attempt; no partial snapshot/dataset | Commit status; fail |
| Concurrent writer | `main` advanced | Use latest branch and preserve unrelated artifacts | Conflict fails without overwrite |

</frozen-after-approval>

## Code Map

- `.github/workflows/verify.yml:1`, `sources/insee-cpi/source.yaml:53` -- frozen CI precedent and declared monthly cadence.
- `runtime/pulse/cli.py:26`, `sources.py:99` -- sole API plus generic declaration/adapter seams.
- `runtime/pulse/archive.py:31`, `:127` -- acquisition identity and no-op/conflict invariants.
- `runtime/pulse/datasets.py:150`, `:190`, `:309` -- declared dependencies, discovery, retention-aware builds.
- `runtime/pulse/catalog.py:291`, `:366` -- status projections; source failure attempts are missing.
- `runtime/pulse/contracts/status.py:27`, `:162`; `contracts/dataset.py:67` -- stages, attempts, safe diagnostics.
- `.gitattributes:1`, `.gitignore:220` -- LFS/tracking rules; source sidecars need positive exceptions.
- `tests/sources/test_insee_cpi.py:220`, `tests/datasets/test_insee_cpi_datasets.py:140`, `tests/runtime/test_status.py:80` -- existing retry, neutrality, and status evidence.

## Tasks & Acceptance

**Execution:**
- [x] `runtime/pulse/{automation.py,cli.py}` -- add neutral refresh, logical-ID recovery, dependent discovery, sibling continuation, and aggregate outcome.
- [x] `runtime/pulse/{automation.py,catalog.py}`, `runtime/pulse/contracts/`, `.gitignore` -- persist and consume tracked safe source attempts/diagnostics; clear obsolete failures.
- [x] `.github/workflows/insee-cpi.yml` -- add schedule/manual triggers, targeted LFS, frozen setup, shared writer, current-main checkout, scoped commit/push, and final failure propagation.
- [x] `tests/{runtime,sources,datasets}/` -- cover the matrix, neutral dependency selection, scoped Git publication, retention, and diagnostic safety.
- [x] `tests/runtime/test_workflows.py`, `runtime/pulse/verify.py` -- enforce schedule, thinness, permissions, concurrency, LFS scope, forbidden coupling, and offline PR behavior.
- [x] `tests/sources/test_insee_cpi_live.py`, `README.md` -- exercise/document the opt-in live refresh, manual use, retry semantics, and failures.

**Acceptance Criteria:**
- Given schedule/manual dispatch, when the workflow runs or retries, then one CLI path uses stable identity and declared dependents without duplicate snapshots or empty commits.
- Given publishable success, suspect state, or safe failure, when the writer runs, then it starts from current `main` and creates at most one scoped commit while preserving unrelated history.
- Given verification, when contracts run, then YAML has no dataset knowledge, runtime never pushes, permissions/LFS are minimal, PR tests stay offline, and live failures distinguish upstream from code/contract faults.

## Spec Change Log

## Design Notes

Compute inside the serialized writer job: the CLI only mutates its checkout; explicit YAML commits/pushes the complete change. Cron `17 6 23 * *` runs after the day-15 publication expectation plus seven grace days; manual dispatch uses the same path. Pass stable Actions run identity as a logical key; CLI validation/derivation keeps rerun attempts on one opaque acquisition ID.

## Verification

**Commands:**
- `uv run --no-sync pytest` -- offline orchestration, retry, status, writer, and workflow contracts pass.
- `uv run --no-sync pulse verify` -- full repository verification remains green and offline.
- `PULSE_LIVE_INSEE=1 uv run --no-sync pytest -m live tests/sources/test_insee_cpi_live.py -q` -- explicit live refresh gate passes when network access is authorized.
- `git diff --check` -- changed artifacts contain no whitespace errors.

## Suggested Review Order

**Refresh orchestration**

- Source-neutral entry point owns acquisition, declared dependents, retention, and aggregate failure.
  [`automation.py:223`](../../runtime/pulse/automation.py#L223)

- Stable logical-run hashing makes retries opaque, source-scoped, and deterministic.
  [`automation.py:66`](../../runtime/pulse/automation.py#L66)

- CLI exposes refresh and scoped staging through the repository's sole automation API.
  [`cli.py:172`](../../runtime/pulse/cli.py#L172)

**Atomic publication and scheduling**

- One scheduled/manual writer serializes current-main publication and propagates failures after committing safe state.
  [`insee-cpi.yml:1`](../../.github/workflows/insee-cpi.yml#L1)

- Declaration-derived path staging excludes unrelated datasets and keeps runtime push-free.
  [`automation.py:76`](../../runtime/pulse/automation.py#L76)

- Status compilation projects persisted source failures while retaining the latest usable snapshot.
  [`catalog.py:291`](../../runtime/pulse/catalog.py#L291)

**Failure classification and safeguards**

- Transient HTTP responses are retryable; permanent responses remain contract failures.
  [`acquire.py:51`](../../sources/insee-cpi/acquire.py#L51)

- Verification enforces schedule, permissions, concurrency, LFS scope, and forbidden coupling.
  [`verify.py:132`](../../runtime/pulse/verify.py#L132)

**Evidence and operation**

- Orchestration tests cover dependents, failure retention, retries, and out-of-order outcomes.
  [`test_automation.py:25`](../../tests/runtime/test_automation.py#L25)

- Temporary Git tests prove scoped commits and non-fast-forward conflict safety.
  [`test_workflows.py:65`](../../tests/runtime/test_workflows.py#L65)

- Operator guidance records manual identity reuse and both workflow triggers.
  [`README.md:78`](../../README.md#L78)
