---
title: 'Story 1.5a: Expand the INSEE CPI Dataset for Category Analysis'
type: 'feature'
created: '2026-09-02'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd162809a85c9fb2c05fdb8830d4a91960f14843c'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current INSEE CPI publication intentionally contains only headline CPI and its provider-published monthly and annual changes. It cannot support a credible French inflation analysis of food, energy, actual rents, or their relationship to the headline.

**Approach:** Keep the existing `insee-cpi/monthly` contract unchanged and add a separately documented, source-owned `insee-cpi/category-analysis` dataset. Expand the same INSEE Base-2025 IPC acquisition scope through a new immutable snapshot, then make category levels, comparable annual changes, and annual basket-weight context available for Story 1.6's Claude Design session.

## Boundaries & Constraints

**Always:** Select exact official Base-2025 *IPC* series with compatible geography, population, frequency, measure, revision history, licence, and attribution for headline, food, energy, actual rents paid, and the required annual weights. Preserve every existing snapshot and the current `insee-cpi/monthly` schema/query behavior. Keep the new dataset wide, typed, public, single-source, manifest-validated, and replayable from committed fixtures/snapshots. Document source identity and temporal meaning for every field; annual weights must carry their reference year and cannot be presented as monthly observations. Define and test any component calculation's formula, alignment, coverage, rebasing, and limits.

**Ask First:** Stop for a series that cannot be made comparable to the selected IPC population/geography/measure; a change to the existing monthly dataset consumer contract; a compatibility adapter; a claim that a calculated value is an official INSEE contribution; a property-price series, another provider, credentialed access, or a change to report design.

**Never:** Substitute IPCH, Base-2015, a different population/geography, or residential property sale prices. Do not modify the prior snapshot; call an index-based approximation causal or official; hardcode report questions, visual treatments, or a new browser catalog; contact INSEE from ordinary offline tests; or weaken source/archive/manifest/Visual Contract rules.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Compatible expansion | Exact declared IPC category and annual-weight series | New immutable snapshot and validated category-analysis Parquet/manifest; current monthly dataset remains byte/contract compatible | Reject incomplete metadata or invalid series before publication |
| Incompatible provider selection | Different base, geography, population, measure, or unavailable history | No category dataset or report-facing approximation | Stop with the incompatible dimension named |
| Consumer/replay regression | Existing monthly fixture/query and new category fixtures | Existing contract behaves unchanged; new dataset replays deterministically | Fail schema, grain, manifest, or consumer checks explicitly |
| Component interpretation | Annual weights joined to monthly category data | Explicitly limited, tested calculation/context with reference year | Reject missing weights/years; never label it official contribution |

</frozen-after-approval>

## Code Map

- `sources/insee-cpi/source.yaml:4-17`, `source-contract.md:3-34`, and `acquire.py:27-47,82-137` -- extend the declared combined-SDMX selection and strict title/missing/unexpected-series checks only after recording the exact comparable official series.
- `runtime/pulse/transform.py:29-34,103-140,142-243` and `sources/insee-cpi/dbt/models/` -- current three-series wide transform, validation, semantic metadata, external-Parquet publication, and replay seam; add a separate category-analysis producer without changing the old contract.
- `runtime/pulse/contracts/dataset.py:38-56` -- generalize the current hard-coded monthly manifest validation so both explicitly supported `insee-cpi` dataset shapes validate strictly.
- `tests/fixtures/insee-cpi/response.xml`, `tests/sources/test_insee_cpi.py:46-55,84-94,145-158`, and `test_insee_cpi_transform.py:36-81,105-175` -- deterministic provider fixture, acquisition-contract, replay, schema, semantic metadata, and suspect-state evidence.
- `tests/sources/test_insee_cpi_live.py:15-53` and `README.md:67-70` -- existing opt-in, temporary-archive integration seam; extend it to prove the declared live series set and exact compatible titles without making normal CI network-dependent.
- `runtime/pulse/catalog.py:35-74`, `tests/runtime/test_catalog.py`, `tests/node/client-contract.test.mjs`, and `tests/browser/pilot.spec.js:5-27` -- catalog already supports arbitrary v1 entries; prove multi-dataset discovery while retaining existing report and browser behavior.

## Tasks & Acceptance

**Execution:**

- [x] `sources/insee-cpi/`, official INSEE selection record, and source fixture -- record and validate exact compatible Base-2025 IPC category/weight series; expand the combined acquisition declaration and create a new immutable-snapshot fixture without changing the prior archive.
- [x] `runtime/pulse/transform.py`, source-local dbt models/schema, and `runtime/pulse/contracts/dataset.py` -- produce and strictly validate `insee-cpi/category-analysis` with typed category levels, annual changes, annual weights/reference years, complete semantics, and an explicitly limited component calculation or context; preserve `insee-cpi/monthly` unchanged.
- [x] `tests/sources/`, `tests/runtime/`, `tests/node/`, and `tests/browser/` -- prove deterministic acquisition/replay, selection comparability, metadata, annual-weight meaning, formula limits, multi-dataset catalog discovery, and unchanged existing report consumers without network access.
- [x] `tests/sources/test_insee_cpi_live.py` and `README.md` -- extend the explicit `PULSE_LIVE_INSEE=1` integration check to acquire the declared provider response into a temporary archive and validate every approved category/weight series and title; retain its opt-in, no-commit, no-fixture-mutation behavior.
- [x] `README.md` and `sources/insee-cpi/source-contract.md` -- document the added dataset, series-selection rationale, consumer-safe schema boundary, and what the component values do and do not mean for Story 1.6 design.

**Acceptance Criteria:**

- Given approved official series and weights, when the INSEE source is rebuilt, then a new immutable acquisition publishes a validated category-analysis dataset and leaves the existing headline dataset and visual consumer behavior unchanged.
- Given category levels, annual changes, and weights, when their metadata or calculation is inspected, then every value's series identity, unit, time basis, geography/population, and limitations are explicit and tests reject incompatible or missing inputs.
- Given a clean offline clone and fixtures, when source, catalog, and browser verification run, then both INSEE datasets are reproducible and discoverable while the existing report still passes its contract, accessibility, and performance evidence.
- Given `PULSE_LIVE_INSEE=1`, when the live INSEE contract check runs, then it validates the current declared category/weight series and their non-empty faithful archive representation in a temporary root; when the environment flag is absent, ordinary verification performs no network request.

## Spec Change Log

## Design Notes

Separate publication is the compatibility boundary: Story 1.5's live report queries the current monthly table directly, while catalog/client infrastructure already supports multiple datasets. It gives the report-design session a rich, documented input without retroactively redefining the original vertical-slice proof.

## Verification

**Commands:**

- `uv run pytest tests/runtime tests/sources -q` -- expected: source selection, replay, metadata, category contract, and catalog tests pass offline.
- `npm run verify` -- expected: existing browser/client/public-artifact evidence remains green with the additional catalog entry.
- `uv run pulse verify` -- expected: aggregate source and browser-data conformance passes without INSEE network access.
- `PULSE_LIVE_INSEE=1 uv run pytest -m live tests/sources/test_insee_cpi_live.py -q` -- expected: the current official response satisfies the declared expanded-series contract in a temporary archive.
- `git diff --check` -- expected: no whitespace errors or generated site residue.

## Suggested Review Order

**Source contract and replay boundary**

- Declares the exact compatible INSEE scope and keeps the old monthly contract intact.
  [source.yaml:4](../../sources/insee-cpi/source.yaml#L4)

- Rebuilds both source-owned outputs from immutable snapshots without consumer migration.
  [transform.py:293](../../runtime/pulse/transform.py#L293)

- Makes the command-line replay path publish both datasets by default.
  [cli.py:45](../../runtime/pulse/cli.py#L45)

**Analytical semantics**

- Produces typed category rows, annual-weight context, and the explicitly limited rent calculation.
  [insee_cpi_category_analysis.sql:3](../../sources/insee-cpi/dbt/models/insee_cpi_category_analysis.sql#L3)

- Validates coverage, contiguous periods, annual-weight alignment, and the contribution formula.
  [transform.py:342](../../runtime/pulse/transform.py#L342)

- Documents precise units, source identities, and the non-official derived rent metric.
  [transform.py:380](../../runtime/pulse/transform.py#L380)

**Evidence and consumer compatibility**

- Exercises deterministic replay, formula limits, asynchronous releases, and both CLI publications.
  [test_insee_cpi_transform.py:100](../../tests/sources/test_insee_cpi_transform.py#L100)

- Retains a network-free recorded provider response, including annual observations.
  [response.xml:12](../../tests/fixtures/insee-cpi/response.xml#L12)

- Makes the opt-in integration test validate current titles, frequencies, and temporary archival.
  [test_insee_cpi_live.py:18](../../tests/sources/test_insee_cpi_live.py#L18)
