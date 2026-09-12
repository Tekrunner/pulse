---
title: 'Story 2.2: Add a Public Source Through a Source-Neutral Workflow'
type: 'feature'
created: '2026-09-11'
status: 'done'
baseline_commit: 'e7fa1f3ba9428cafd45e6ff726e4a45a31c469e9'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pulse has one complete INSEE source but no source-neutral agent capability for adding another public source without copying provider-specific code. Shared contracts also assume Parquet-only ingestion, dataset-backed source visibility, and one hard-coded schedule.

**Approach:** Add a repository-local `pulse-add-source` skill that guides provider selection through faithful ingestion and validated immutable snapshot creation, then stops. Preserve the INSEE source/dataset separation as evidence: analytical typing and report-facing output are routed to a separate dataset skill.

## Boundaries & Constraints

**Always:** Describe and implement this as an ingestion/snapshot skill. Its terminal output is a validated immutable source snapshot plus source assertion/status evidence. Keep `SKILL.md` concise; put conditional detail in references and copyable files in assets. Use registry-free kebab-case identity, the Pulse CLI, scoped Git LFS, UTC timestamps, sanitized diagnostics, offline fixtures, and opt-in live gates. Preserve original bytes for file providers and faithful Parquet for API/non-file providers.

**Ask First:** Changing snapshot contract major version; adding a dependency; weakening manifest, LFS, public-profile, serialized-writer, or INSEE live-gate guarantees; expanding cadence semantics without a concrete need.

**Never:** Create or modify dataset declarations/contracts, dbt models, analytical typing, indicators, report-facing Parquet, visuals, or reports. Do not copy INSEE into assets, add provider logic to shared runtime, introduce a second automation API or registry, contact providers in ordinary CI, create a dataset implicitly, or expose credentials/unsafe upstream data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| API or file source | Valid declaration and fixture/input | Faithful immutable snapshot, manifest, assertions/status, independent schedule | Sanitized failure; no partial archive |
| Drift/retry | Compatible/incompatible schema or repeated run | Additions reported; exact retry no-ops; new observation retained | Incompatibility/conflict fails without overwrite |
| Invalid package | Missing fields, ID/path collision, unresolved rights, LFS pointer | Validation fails before acceptance | Existing output remains unchanged |
| Dataset request | Analytical or report-facing data also requested | Complete/identify snapshot prerequisite, then route to dataset skill | No dataset artifacts or semantics in source package |

</frozen-after-approval>

## Code Map

- `runtime/pulse/sources.py:37-235`, `runtime/pulse/cli.py:61-88,201-269` -- declaration/discovery, adapter boundary, and sole high-level ingestion API.
- `runtime/pulse/archive.py:43-166`, `runtime/pulse/contracts/snapshot.py:11-94` -- Parquet-only immutable archive and strict v1 manifest; extend compatibly for original files.
- `runtime/pulse/automation.py:66-344`, `runtime/pulse/verify.py:132-194`, `.github/workflows/insee-cpi.yml` -- shared refresh/writer seams versus hard-coded single-workflow verification.
- `runtime/pulse/catalog.py:356-504`, `runtime/pulse/contracts/status.py:27-165` -- source status/freshness; currently omit standalone sources and assertion results.
- `sources/insee-cpi/`, `datasets/insee-cpi-monthly/`, `datasets/insee-cpi-category-analysis/` -- read-only evidence for provider neutrality and the mandatory source/dataset boundary.

## Tasks & Acceptance

**Execution:**
- [x] `.agents/skills/pulse-add-source/SKILL.md`, `agents/openai.yaml`, `references/`, `assets/` -- created the discoverable ingestion/snapshot skill, focused references, and neutral source/fixture/test/workflow assets; explicitly excludes dataset work.
- [x] `runtime/pulse/sources.py`, `runtime/pulse/archive.py`, `runtime/pulse/contracts/snapshot.py`, `.gitattributes` -- enforce declarations/identity and support immutable API-Parquet and original-file snapshots with drift and LFS checks.
- [x] `runtime/pulse/catalog.py`, `runtime/pulse/contracts/status.py`, `runtime/pulse/automation.py` -- persist source assertion outcomes and expose standalone public source status without creating datasets.
- [x] `runtime/pulse/verify.py`, `.github/workflows/`, `tests/runtime/test_workflows.py` -- validate declaration-driven independent thin schedules using the shared serialized writer.
- [x] `tests/sources/`, `tests/runtime/` -- exercise skill assets end to end, all matrix cases, offline isolation, public visibility, unaffected siblings, and INSEE conformance.

**Acceptance Criteria:**
- Given an ingestion request, when an agent uses `pulse-add-source`, then it can select, implement, schedule, and validate a provider through snapshot completion without reading INSEE.
- Given analytical or dataset work is requested, when the skill evaluates scope, then it preserves the source package boundary and routes that work to the separate dataset skill.
- Given neutral skill assets, when offline conformance and independent forward-testing run, then acquisition, archival, drift, freshness, assertions, visibility, LFS rejection, status, and schedule configuration pass end to end.
- Given a new source fails or is suspect, when catalogs/public output rebuild, then its status appears while unrelated sources, datasets, and reports remain operational.

## Spec Change Log

## Design Notes

Use `source.yaml` because discovery already does. Keep placeholder workflow YAML under skill assets so GitHub cannot schedule it before configuration.

## Verification

**Commands:**
- `python /home/yfontana/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/pulse-add-source` -- expected: valid complete skill.
- `uv run --no-sync pytest tests/sources tests/runtime -q` -- expected: neutral and INSEE source conformance pass offline.
- `uv run --no-sync pulse verify` -- expected: repository and source workflow invariants pass.
- `PULSE_LIVE_INSEE=1 uv run --no-sync pytest -m live tests/sources/test_insee_cpi_live.py -q` -- expected: explicit live gate passes when requested.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Agent boundary**

- Defines ingestion completion and explicitly routes analytical work away.
  [`SKILL.md:8`](../../.agents/skills/pulse-add-source/SKILL.md#L8)

- Makes missing provider timing evidence a deliberate stopping condition.
  [`scheduling.md:3`](../../.agents/skills/pulse-add-source/references/scheduling.md#L3)

**Source and snapshot contract**

- Carries either faithful rows or exact original bytes through one neutral adapter boundary.
  [`sources.py:54`](../../runtime/pulse/sources.py#L54)

- Enforces declaration identity, unresolved-template rejection, and credential-free configuration.
  [`sources.py:121`](../../runtime/pulse/sources.py#L121)

- Archives API Parquet or source-native files immutably with retry-integrity evidence.
  [`archive.py:128`](../../runtime/pulse/archive.py#L128)

- Makes file format and source assertions additive, backward-compatible manifest fields.
  [`snapshot.py:52`](../../runtime/pulse/contracts/snapshot.py#L52)

**Automation and visibility**

- Includes standalone public sources in expected pipeline status.
  [`catalog.py:374`](../../runtime/pulse/catalog.py#L374)

- Requires one thin serialized-writer workflow for every public declaration.
  [`verify.py:167`](../../runtime/pulse/verify.py#L167)

**Evidence**

- Exercises original-file integrity, assertions, status, templates, and no-dataset boundaries.
  [`test_source_neutral.py:65`](../../tests/runtime/test_source_neutral.py#L65)

- Proves neutral assets fail closed until real schedule evidence replaces placeholders.
  [`test_source_neutral.py:190`](../../tests/runtime/test_source_neutral.py#L190)
