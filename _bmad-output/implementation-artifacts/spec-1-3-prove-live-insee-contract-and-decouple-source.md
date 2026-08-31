---
title: 'Story 1.3 Correction: Prove the Live INSEE Contract and Decouple the Source'
type: 'refactor'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
baseline_commit: '34e8bef45ab5ca28825b58c5ff3dd0bf11415c13'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/implementation-artifacts/spec-1-3-select-acquire-and-archive-the-first-insee-dataset.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-pulse-2026-08-18/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.3 claims a working INSEE acquisition without ever proving the live path. Its synthetic JSON fixture does not match INSEE's real SDMX-ML response, and the source package embeds downstream report intent in documentation, declaration aliases, validation, and CLI dispatch.

**Approach:** Make `insee-cpi` a consumer-independent acquisition slice with a source-neutral runtime adapter contract. Decode a faithful recorded SDMX-ML response, add a separately invoked live integration test, prove one real acquisition, and preserve the product-level selection rationale only in planning/spec artifacts.

## Boundaries & Constraints

**Always:** Keep ordinary CI fully offline and deterministic; make live verification explicit and opt-in; use INSEE's documented public SDMX endpoint and provider-native IDs, names, attributes, codes, and string values; tolerate compatible upstream attribute additions; derive source-data time transparently from provider metadata; keep acquisition/decode in the source-local dlt adapter and generic orchestration/archive/manifest rules in shared runtime. The source package may define its provider acquisition scope but must not name or validate reports, visual roles, analytical indicators, or consumer semantics.

**Ask First:** Stop if the real endpoint requires credentials, the selected provider series have been withdrawn or materially redefined, faithful archival requires changing the adopted Parquet/snapshot contract, Git LFS cannot materialize the first real snapshot, or satisfying the live check requires making network access part of ordinary CI.

**Never:** Treat a CLI flag as proof without executing it; reshape a synthetic fixture into an assumed upstream contract; put report rationale in `sources/`; analytically type, rename, calculate, or semantically classify observations during acquisition; weaken immutable archive and retry guarantees.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Offline acquisition | Faithful recorded StructureSpecific SDMX-ML fixture | Provider series/observation attributes become faithful string-valued Parquet rows and a valid immutable manifest | No network access or consumer semantics |
| Explicit live smoke | Opt-in live test and reachable INSEE endpoint | Real response decodes, contains the declared provider IDs, and archives into a temporary valid snapshot | Upstream, transport, or contract failure is distinguishable and non-zero |
| Compatible evolution | Recorded XML contains an additional Series or Obs attribute | Attribute is preserved and observed-schema hash changes deterministically | Required identity/time/value fields still validate |
| Invalid response | HTTP error, malformed XML, missing declared series, or missing required observation field | No compliant or partial snapshot is accepted | Sanitized actionable diagnostic preserves prior snapshots |
| Generic dispatch | Any discovered declaration with a conforming source adapter | Shared CLI invokes the adapter without source-ID branches or source-specific symbols | Missing/incompatible adapter fails before archive mutation |

</frozen-after-approval>

## Code Map

- `sources/insee-cpi/acquire.py:1-86` -- currently fetches unsupported `format=sdmx-json`, parses invented JSON, and hard-codes three consumer aliases; replace with the real source-local SDMX-ML/dlt contract.
- `sources/insee-cpi/source.yaml:1-25` -- provider declaration currently mixes URLs with downstream `measure` roles; retain only provider-native acquisition scope and metadata.
- `sources/insee-cpi/selection.md:1-41` -- report-oriented rationale inside the ingestion slice; remove it and replace it with source-contract documentation only.
- `runtime/pulse/sources.py:20-101` -- shared declaration and dynamic loading still impose an INSEE-like `selected_series`; make provider configuration opaque and validate a generic adapter interface.
- `runtime/pulse/cli.py:51-84` -- execution hard-codes `insee-cpi` and `insee_cpi_rows`; dispatch any discovered conforming adapter.
- `runtime/pulse/archive.py:55-119`, `runtime/pulse/contracts/snapshot.py:1-104` -- preserve the generic immutable archive and strict manifest invariants unless real evidence exposes a contract defect.
- `tests/fixtures/insee-cpi/response.json`, `tests/sources/test_insee_cpi.py:1-162` -- replace the invented fixture and report-semantic assertions with faithful XML, compatibility/error coverage, and generic dispatch tests.
- `_bmad-output/planning-artifacts/epics.md:93-115,302-368,659-729` -- read-only authority for pipeline separation, offline conformance, the Story 1.3 live check, and Story 1.8 scheduled integration.

## Tasks & Acceptance

**Execution:**
- [x] `sources/insee-cpi/source.yaml`, `sources/insee-cpi/source-contract.md`, `sources/insee-cpi/acquire.py` -- define a consumer-neutral combined-series SDMX-ML acquisition; faithfully decode the real provider contract through a conforming dlt adapter; remove `selection.md` and consumer aliases.
- [x] `runtime/pulse/sources.py`, `runtime/pulse/cli.py` -- make declaration configuration provider-opaque and source execution adapter-driven without identity branches or INSEE symbols.
- [x] `tests/fixtures/insee-cpi/response.xml`, `tests/sources/test_insee_cpi.py`, `tests/sources/test_insee_cpi_live.py`, `pyproject.toml` -- record a faithful sanitized upstream fixture; cover XML fidelity/evolution/failures and generic dispatch; register an opt-in live marker excluded from ordinary CI.
- [x] `README.md` -- document the neutral source contract, offline suite, explicit live smoke, and the later Story 1.8 scheduling boundary without report-oriented source language.
- [x] `snapshots/public/insee-cpi/` -- after temporary live proof, create, validate, and LFS-track the first real immutable snapshot without adding generated dlt or disposable state.

**Acceptance Criteria:**
- Given normal verification, when source and workspace tests run, then all inputs are committed fixtures and no upstream request occurs.
- Given explicit live-test opt-in, when INSEE is reachable, then its real SDMX-ML contract is acquired through the source-local dlt adapter and archived successfully in a temporary directory.
- Given source discovery and acquisition, when any conforming source ID is requested, then shared runtime dispatches generically and contains no report or INSEE-specific semantics.
- Given the committed source slice, when its files are reviewed, then product selection rationale remains in planning/spec history while source files describe only provider scope, access, fidelity, cadence, rights, and the next-stage contract.
- Given the proven live path, when the first repository snapshot is created, then Parquet contents match the declared provider series, `snapshot.json` validates, and the raw object is tracked by Git LFS.

## Design Notes

Demand may motivate adding a source, but it does not become part of the source contract. `insee-cpi` owns a bounded provider-native acquisition scope; unknown consumers can reuse its snapshot. Story 1.8 should schedule the same live path proven here rather than inventing another integration mechanism.

## Verification

**Commands:**
- `uv run --no-sync pytest tests/sources tests/runtime -q` -- expected: faithful offline acquisition, generic dispatch, archive matrix, and no-network guards pass.
- `PULSE_LIVE_INSEE=1 uv run --no-sync pytest -m live tests/sources/test_insee_cpi_live.py -q` -- expected: real INSEE acquisition and temporary snapshot validation pass.
- `uv run --no-sync pulse verify` -- expected: the complete offline workspace suite passes.
- `git check-attr filter -- snapshots/public/insee-cpi/*/raw.parquet && git lfs ls-files` -- expected: the committed real raw snapshot is LFS-managed.
- `git diff --check` -- expected: no whitespace errors or disposable acquisition residue.

## Suggested Review Order

**Source-neutral execution boundary**

- Start with the generic adapter result contract and validation boundary.
  [`sources.py:39`](../../runtime/pulse/sources.py#L39)

- Provider configuration stays opaque while runtime dispatch remains source-agnostic.
  [`sources.py:56`](../../runtime/pulse/sources.py#L56)

- CLI discovery passes any conforming adapter output into shared archival.
  [`cli.py:56`](../../runtime/pulse/cli.py#L56)

**Faithful INSEE acquisition**

- Source-local dlt resource owns transport, XML decoding, and provider validation.
  [`acquire.py:50`](../../sources/insee-cpi/acquire.py#L50)

- Decoder preserves provider attributes and rejects incompatible upstream changes.
  [`acquire.py:82`](../../sources/insee-cpi/acquire.py#L82)

- Declaration contains only provider-native scope, cadence, rights, and attribution.
  [`source.yaml:1`](../../sources/insee-cpi/source.yaml#L1)

- Source documentation defines fidelity and the downstream boundary without report intent.
  [`source-contract.md:1`](../../sources/insee-cpi/source-contract.md#L1)

**Durable raw boundary**

- Explicit column typing prevents DuckDB from coercing provider strings during archival.
  [`archive.py:61`](../../runtime/pulse/archive.py#L61)

- The first real snapshot records immutable provenance and schema evidence.
  [`snapshot.json:1`](../../snapshots/public/insee-cpi/acq-4f6f4d2c8a6b4e5f9a7c1d3e5b8f2041-8f7cda5209d4/snapshot.json#L1)

**Verification**

- Offline tests cover fidelity, evolution, failures, retries, and generic dispatch.
  [`test_insee_cpi.py:84`](../../tests/sources/test_insee_cpi.py#L84)

- Opt-in live test validates real rows, manifest, and Parquet types.
  [`test_insee_cpi_live.py:18`](../../tests/sources/test_insee_cpi_live.py#L18)

- Pytest configuration keeps network checks outside ordinary verification.
  [`pyproject.toml:32`](../../pyproject.toml#L32)
