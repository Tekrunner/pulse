---
title: 'Story 1.3: Select, Acquire, and Archive the First INSEE Dataset'
type: 'feature'
created: '2026-08-28'
status: 'done'
review_loop_iteration: 0
baseline_commit: '70b3bba48a72218cc901e5866385d916f15d7f96'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pulse has no real, replayable public source. The first report needs a small authoritative inflation slice, but source discovery, acquisition identity, immutable snapshotting, and LFS-backed raw storage do not exist.

**Approach:** Add one public `insee-cpi` vertical source package for INSEE BDM/SDMX CPI series. Record its report-scoped selection rationale, acquire its documented monthly response through dlt, and archive faithful raw Parquet plus strict immutable manifests through shared Pulse contracts.

## Boundaries & Constraints

**Always:** Scope the source to the first report's French CPI level, year-on-year inflation, and monthly movement; use only current INSEE Base-2025 series selected and recorded from the official BDM catalogue; retain Insee attribution and reuse terms; use stable lowercase kebab-case IDs, UTC ISO-8601 timestamps, SHA-256 hashes, opaque per-observation acquisition IDs, and Git LFS for committed public raw objects. Discover source declarations from `sources/*/` without a registry. Keep dlt responsible only for source access and faithful decoding; analytical typing, semantics, and report shaping begin in Story 1.4.

**Ask First:** Stop if selecting the needed CPI series requires credentials, paid access, a non-public source, changing the selected inflation scope, or replacing the adopted Git LFS/archive contract.

**Never:** Treat INSEE as the default for future reports; fetch live INSEE data in ordinary CI; commit credentials, tokens, unsafe response bodies, generated dlt state, landing data, databases, or site output; overwrite an archived snapshot; silently substitute stale Base-2015 CPI series.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Valid acquisition | Recorded BDM/SDMX CPI response and a new acquisition ID | Faithful raw Parquet, LFS-tracked bytes, and validated `snapshot.json` with source/acquisition/source-data and UTC acquisition times, URLs, hashes, observed-schema hash, versions, licence, and attribution | No transformation or report-specific fields are introduced |
| Idempotent retry | Same acquisition ID and identical artifact hashes | Existing snapshot is retained byte-for-byte; writer reports a no-op | No manifest timestamp or content changes |
| Integrity conflict | Same acquisition ID with different content | No snapshot is changed | Non-zero sanitized acquisition-integrity diagnostic |
| Later duplicate content | New acquisition ID with previously seen bytes | A distinct manifest and observation are preserved | Content equality is recorded only through hashes |
| Upstream/decode/contract failure | Transport failure, malformed fixture, invalid declaration, or LFS pointer stub | No compliant partial snapshot is accepted; prior snapshots remain readable | Non-zero actionable, secret-free diagnostic |

</frozen-after-approval>

## Code Map

- `runtime/pulse/cli.py:10-35` -- existing sole Pulse entry point; add the source-scoped acquisition command here.
- `runtime/pulse/verify.py:14-112` -- established `VerificationError` and actionable failure conventions to reuse.
- `pyproject.toml:7-24` -- locked Python 3.13 and dlt 1.30.0 runtime; do not add an unpinned acquisition dependency.
- `tests/data_tools/test_dbt_external.py:16-102` -- isolated deterministic fixture/subprocess testing pattern; source tests must remain offline.
- `.gitignore:219-229` -- disposable build/landing state is ignored; committed raw archive must stay visible and receive precise LFS attributes.
- `_bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md:41-65,109-115,127-134` -- adopted ownership, manifest, ID/time, conformance, and Git LFS invariants.
- `sources/`, `runtime/pulse/contracts/`, `runtime/pulse/sources/`, `.gitattributes` -- absent; create these focused source/archive boundaries rather than a central source registry.

## Tasks & Acceptance

**Execution:**
- [x] `sources/insee-cpi/source.yaml`, `sources/insee-cpi/selection.md`, `sources/insee-cpi/acquire.py` -- declare the public INSEE BDM/SDMX Base-2025 CPI source, exact selected series, direct access method, monthly fetch cadence, expected publication advance, licence/attribution, and report-scoped rationale; implement only provider request/faithful response decoding.
- [x] `runtime/pulse/sources.py`, `runtime/pulse/contracts/`, `runtime/pulse/archive.py` -- discover and validate declarations, issue/reuse acquisition IDs, validate versioned snapshot manifests, encode API rows faithfully as Parquet, hash artifacts and observed schema, and atomically enforce no-op/conflict/later-observation archive semantics.
- [x] `runtime/pulse/cli.py`, `.gitattributes`, `.gitignore` -- expose one documented `pulse source acquire insee-cpi` command; track only public raw snapshot objects with Git LFS while keeping disposable runtime state untracked.
- [x] `tests/sources/`, `tests/fixtures/insee-cpi/`, `tests/runtime/` -- add recorded INSEE response fixtures and offline coverage for discovery, declaration failures/duplicates, deterministic snapshots, manifests, retry variants, failures, LFS pointer rejection, and CLI diagnostics; make live acquisition an explicit opt-in check only.
- [x] `README.md` -- document the source selection, Git LFS prerequisite, ordinary offline verification, and opt-in live acquisition command without exposing secrets.

**Acceptance Criteria:**
- Given the selected `insee-cpi` package, when discovery runs, then it is found without a registry and its declaration fully describes the public BDM/SDMX CPI acquisition and publication expectations.
- Given a valid source command and recorded CPI response, when acquisition runs, then dlt produces a faithful pre-transform Parquet snapshot and a strict, attributable, replayable `snapshot.json` under an opaque acquisition identity.
- Given all retry, duplicate-content, invalid declaration, malformed response, and unresolved-LFS cases, when the offline suite runs, then each has the matrix-defined deterministic result and no existing compliant snapshot changes.
- Given normal CI, when the full verifier runs, then it uses only committed fixtures; an upstream INSEE request is separately opt-in and never a prerequisite.

## Design Notes

The declaration is source-local because future providers will differ, while discovery, IDs, archive atomicity, and manifest validation are shared because they are lineage invariants. Store API data as faithful Parquet now; Story 1.4 will independently decode/rebuild from these immutable snapshots and own all analytical meaning.

## Verification

**Commands:**
- `uv run pytest tests/sources tests/runtime -q` -- expected: all source/archive paths run deterministically without network access.
- `uv run pulse source acquire insee-cpi --fixture tests/fixtures/insee-cpi/response.json` -- expected: creates or idempotently reuses one validated local snapshot without contacting INSEE.
- `uv run pulse verify` -- expected: existing workspace verification and new offline source stages pass.
- `git diff --check` -- expected: no whitespace errors; raw snapshot files are matched by `.gitattributes` LFS rules.

## Suggested Review Order

**Source command and boundaries**

- The sole CLI entry point discovers and invokes a source-local adapter safely.
  [`cli.py:51`](../../runtime/pulse/cli.py#L51)

- Discovery remains registry-free while loading kebab-case source adapters explicitly.
  [`sources.py:76`](../../runtime/pulse/sources.py#L76)

- The INSEE adapter owns transport, validation, and faithful dlt resource decoding.
  [`acquire.py:21`](../../sources/insee-cpi/acquire.py#L21)

**Immutable archive contract**

- Atomic archive writing enforces integrity, replay history, hashes, and manifests.
  [`archive.py:69`](../../runtime/pulse/archive.py#L69)

- The strict manifest rejects incomplete lineage and unsupported contract versions.
  [`snapshot.py:43`](../../runtime/pulse/contracts/snapshot.py#L43)

**Declared source and supporting evidence**

- Three Base-2025 CPI measures and publication expectations stay declared beside the source.
  [`source.yaml:1`](../../sources/insee-cpi/source.yaml#L1)

- Offline tests cover each archive outcome and source-adapter constraint.
  [`test_insee_cpi.py:37`](../../tests/sources/test_insee_cpi.py#L37)

- LFS usage and offline/live operating instructions are documented for reproducible use.
  [`README.md:37`](../../README.md#L37)
