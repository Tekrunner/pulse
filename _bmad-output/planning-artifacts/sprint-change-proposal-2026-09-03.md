---
title: "Sprint Change Proposal: Separate Pulse Source, Dataset, and Report Packages"
status: approved
created: 2026-09-03
approved: 2026-09-03
trigger: Story 1.5a review before Story 1.6
scope: major
---

# Sprint Change Proposal: Separate Pulse Source, Dataset, and Report Packages

## 1. Issue Summary

Story 1.5a exposed a foundational architecture error before Story 1.6 report work began. Pulse is an extensible engine in which sources, datasets, and reports are added over time. The implementation instead organized the first INSEE example as a source-owned vertical slice and allowed that example to shape shared runtime code.

This is a misunderstanding of the original requirements, compounded by a failed implementation approach. It is not a new inflation-report requirement. The PRD already says that Pulse is the engine rather than the reports, that datasets are built through a declared transformation layer, and that source assertions and dataset tests have different ownership.

Concrete evidence:

- `sources/insee-cpi/` owns acquisition, dbt transformations, dataset schema, semantic metadata, and tests.
- `sources/insee-cpi/source-contract.md` documents `actual_rent_annual_change_pct` and `actual_rent_pulse_contribution_pct_points`, which are dataset derivations rather than properties of the acquired source snapshot.
- `runtime/pulse/transform.py` hard-codes INSEE series IDs, dataset columns, formulas, schemas, package paths, and publication identities.
- `runtime/pulse/contracts/dataset.py` hard-codes the two accepted INSEE dataset IDs and shapes in the generic validator.
- `runtime/pulse/cli.py` has INSEE-only replay paths and branching.
- Generated `dataset.json` files are ignored, while their authoritative semantic content exists only in source-specific runtime code. A repository consumer therefore cannot inspect the dataset contract without executing the build or reverse-engineering code.
- The architecture's AD-2 and structural seed explicitly require the source-owned vertical slice, contradicting the PRD's separation of source acquisition, dataset transformation, and report consumption.

The term “vertical slice” may still describe MVP delivery across the whole product. It must no longer describe code ownership: source, dataset, and report are independent package types connected only by versioned artifact contracts.

## 2. Change Analysis Checklist

### Trigger and context

- [x] **1.1 Trigger:** Story 1.5a review, while preparing Story 1.6 and inspecting how Claude Design could discover dataset contracts.
- [x] **1.2 Problem:** misunderstanding of original requirements plus a failed source-owned architecture.
- [x] **1.3 Evidence:** misplaced rent derivations, source-local dbt, and INSEE-specific shared runtime/validation listed above.

### Epic impact

- [x] **2.1 Epic 1:** remains viable, but Story 1.6 must wait for a foundational migration story. Stories 1.7–1.9 must distinguish source acquisition status from dataset build/publication status.
- [x] **2.2 Epic 1 change:** add Story 1.5b, “Establish Independent Source and Dataset Package Boundaries,” immediately before Story 1.6. Amend current planning text for Stories 1.3, 1.4, and 1.5a; preserve their completed implementation specs as historical records with supersession notes.
- [x] **2.3 Epic 2:** materially affected. “Add source” must stop at snapshots; “add indicators/change schemas” must operate on independent dataset packages. Add-dataset must become an explicit workflow.
- [x] **2.4 Epic 3:** still valid, but private datasets must be built by dataset packages from private snapshots rather than by private source slices.
- [x] **2.5 Order:** keep the three epics, insert 1.5b before report design, and block 1.6 until its conformance gates pass.

### Artifact impact

- [x] **3.1 PRD:** product goals and MVP remain valid. Clarifications are needed in FR-7, FR-22–FR-24, MVP wording, and the extension journeys so “add source” and “add dataset/indicator” are not conflated.
- [x] **3.2 Architecture:** AD-1–AD-4, AD-8–AD-10, identity conventions, structural seed, capability map, diagrams, and deferred items need amendment. Stack choices do not change.
- [N/A] **3.3 UX:** the available UX documents contain frontmatter only. No screen, interaction, accessibility, or visual-language change follows from this correction. Claude Design/report design is paused.
- [x] **3.4 Other artifacts:** CLI, discovery, validators, tests, README, Epic 1 context, Story 1.3/1.4/1.5a specs, sprint status, catalog fixtures, and later automation/privacy plans are affected.

### Path evaluation

- [x] **4.1 Direct adjustment — viable.** Add a migration story and amend planning. Effort: high. Risk: medium, because no production report or scheduled pipeline yet depends on the current shape.
- [x] **4.2 Rollback — not recommended.** Reverting Stories 1.3–1.5a would discard useful source snapshots, transformations, tests, and visual-contract work. Moving and generalizing them provides stronger evidence with less risk.
- [x] **4.3 MVP review — not needed.** The original MVP is still achievable. This correction restores it to the PRD rather than reducing it.
- [x] **4.4 Recommendation:** direct adjustment with a migration gate before Story 1.6.

## 3. Recommended Architecture

### Package ownership

```text
sources/<source-id>/
  source.yaml                 # identity, origin, access, cadence, visibility, licence
  acquire.py                  # provider-specific fetch and faithful decoding
  snapshot-contract.yaml      # committed source-native output contract
  source-contract.md          # source/snapshot semantics only
  fixtures/
  tests/

datasets/<dataset-id>/
  dataset.yaml                # identity, input snapshot dependencies, build entry point
  dataset-contract.yaml       # committed report-facing schema and semantic metadata
  dataset-contract.md         # definitions, formulas, alignment, limitations
  dbt/                        # dataset-owned staging, transformations, and data tests
  fixtures/
  tests/

site/reports/<report-id>/
  report.yml                  # dataset/column dependencies and consumer schemas
  queries and visual slots
```

The source package emits an immutable snapshot plus `snapshot.json`. A dataset package consumes only declared snapshots and emits Parquet plus `dataset.json`. A report consumes only declared dataset contracts/catalog entries. Disposable landing or staging data may exist inside a dataset build, but it is not an ownership boundary and is not part of a source package.

### Runtime invariants

1. Shared runtime discovers source and dataset declarations generically. It contains no provider IDs, dataset IDs, columns, formulas, or provider-specific paths.
2. `pulse source acquire <source-id>` ends after a validated immutable snapshot is produced.
3. `pulse dataset build <dataset-id>` builds one dataset from declared snapshots without invoking acquisition.
4. `pulse build` reconstructs all eligible datasets from snapshots and then builds the site. It needs no prior warehouse or source adapter execution.
5. Dataset IDs are globally unique, opaque identities. They do not encode ownership by a source. V1 datasets may still depend on exactly one source, as required by the PRD.
6. Generic manifest schemas validate the envelope and lineage. Dataset-specific columns and semantics come from the committed dataset contract, not a conditional in shared Python.
7. Generated manifests combine committed declarations with observed artifact facts such as hashes, represented periods, selected snapshot IDs, and assertion results.
8. Source assertions validate faithful acquisition/snapshot plausibility. Dataset tests validate analytical schema, transformations, formulas, and semantics.
9. Reports declare dataset and column dependencies. A dataset contract change is checked against those consumers before publication.
10. INSEE is conformance evidence only. A neutral synthetic source and dataset must prove that the framework works without importing or copying INSEE code.

### Pipeline and status ownership

```text
origin -> source package -> snapshot contract/artifact
                             |
                             v
                    dataset package -> dataset contract/artifact
                                           |
                                           v
                                  report declaration -> static report
```

Acquisition can retain per-source cadence and isolation. Dataset and site builds are downstream pipeline stages, not part of a source package. Status and privacy propagate over the declared graph `source -> snapshot -> dataset -> report`; they are not inferred from directory nesting or a `<source-id>/<dataset-id>` naming convention.

## 4. Detailed Artifact Changes

### PRD

#### FR-7 — Build datasets from snapshots

**OLD:** “Datasets are built from snapshots through a declared transformation layer.”

**NEW:** “Each dataset is a discoverable transformation package, independent of source packages and reports. It declares the snapshot contracts it consumes and emits one documented report-facing dataset contract.”

Add consequences that acquisition is never invoked by a dataset build, dataset packages can be built/tested from committed snapshots alone, and v1's single-source limitation is a dependency constraint rather than package ownership.

#### FR-22 — Defined workflows for extension

**OLD:** workflows exist for “add a source”, “add an indicator”, “add a visual”, “add a report”, and schema change.

**NEW:** define separate workflows for “add a source”, “add a dataset or indicator”, “change a dataset schema”, “add a visual”, and “add a report”. The add-source workflow ends at a valid snapshot contract; the dataset workflow starts from snapshot contracts.

#### FR-23 and FR-24

**OLD:** repeated source shape and the first vertical slice serve as the principal exemplar language.

**NEW:** each package kind repeats its own neutral shape, shared runtime contains no exemplar-specific behavior, and the first complete source, dataset, visual, and report independently prove their respective templates.

#### MVP §7.1

**OLD:** “Defined authoring workflows, with the first vertical slice as their exemplar.”

**NEW:** “Defined extension workflows with independent, working exemplars for source acquisition, dataset transformation, visual authoring, and report composition.”

No product goal, report scope, visual requirement, or MVP outcome is removed.

### Architecture spine

#### AD-1 — static artifact pipeline

**OLD:** a source run creates a fresh DuckDB and rebuilds “that source's complete dataset slice.”

**NEW:** acquisition publishes snapshots only. Dataset builds independently consume immutable snapshots; the whole build reconstructs the disposable warehouse from all eligible dataset packages. Internal staging is disposable and package-private.

#### AD-2 — package ownership

**OLD:** each `sources/<source-id>/` vertical slice owns declaration, reader, decode contract, assertions, dbt models, fixtures, and tests.

**NEW:** replace AD-2 with “Independent extension packages and artifact boundaries.” Source packages own provider access and snapshot contracts. Dataset packages own analytical transformations, tests, semantic metadata, and dataset contracts. Report packages own queries, arrangement, interaction state, and consumer dependencies. No package reaches into another package's code or mutable state.

#### AD-3/AD-4 — execution, lineage, and identity

**OLD:** one source workflow owns acquisition through dataset publication; dataset IDs are `<source-id>/<dataset-id>` and manifests reference landing artifacts.

**NEW:** per-source workflows own acquisition through snapshot publication. Downstream orchestration selects dataset packages from declared snapshot dependencies. Dataset IDs are globally unique and source-neutral. `dataset.json` references one or more snapshot manifests through declared lineage; v1 validation enforces exactly one source. Landing manifests cease to be a public inter-package API.

#### AD-8/AD-9 — automation and conformance

**OLD:** CLI replay and conformance operate on a complete source slice.

**NEW:** CLI exposes independent source acquisition and dataset build operations plus whole-system build. Source conformance and dataset conformance are separate suites. A neutral synthetic package pair proves discovery and orchestration; live provider tests remain explicit and opt-in, and at least one INSEE live test must pass before the migration story is accepted.

#### Structural seed and capability map

Add top-level `datasets/<dataset-id>/`; remove `models/` from `sources/`; assign wide datasets and annotations to dataset packages; replace “source vertical slices” with independent source/dataset/report extension packages.

### Epics and stories

#### New Story 1.5b: Establish Independent Source and Dataset Package Boundaries

As a builder, I want independently discoverable source and dataset packages connected by committed contracts, so that adding future data and reports extends Pulse without changing shared runtime or inheriting INSEE-specific structure.

Acceptance criteria:

1. Source discovery accepts packages containing only source declaration, acquisition adapter, snapshot contract, fixtures, assertions, and tests; it neither discovers nor executes transformations.
2. Dataset discovery accepts independent `datasets/<dataset-id>/` declarations with snapshot dependencies, committed schema/semantics, transform entry point, fixtures, and tests; no source registry or shared-runtime conditional is changed to add one.
3. The INSEE dbt models and all CPI formulas/metadata move into two dataset packages. The INSEE source contract contains no dataset column or formula.
4. Shared runtime and generic contract validators contain no `insee-cpi`, provider series IDs, CPI columns, rent calculations, or hard-coded supported dataset shapes.
5. Source acquisition, single-dataset build, and whole build run as separate commands against artifact contracts. Dataset replay works with network disabled and without loading a source adapter.
6. Committed dataset contracts are sufficient for a report author or repository-connected design tool to inspect schema, definitions, units, provenance, formulas, and limitations without generated files or transformation-code inspection.
7. `dataset.json` is derived from the committed dataset declaration/contract plus measured output facts and is rejected when either side disagrees.
8. A neutral synthetic source and dataset pass discovery, snapshot, build, contract, lineage, and collision tests without importing or copying INSEE implementation code.
9. Existing INSEE snapshots remain byte-identical and replayable. Both CPI datasets preserve their analytical rows and documented semantics, except for an explicitly planned dataset-identity migration if required by the new source-neutral ID convention.
10. Existing Story 1.5 browser/catalog consumers are migrated atomically and consumer-schema tests detect stale identities or columns.
11. Ordinary CI remains offline. The explicit live INSEE contract test is preserved and run successfully as an acceptance gate.
12. README and extension documentation explain the three boundaries and demonstrate that adding a dataset does not edit a source package or shared runtime.

#### Existing story changes

- **1.3:** rename its subject from the first INSEE “dataset” to the first INSEE “source”; acceptance ends at snapshot publication. Remove vertical-slice/dbt implications.
- **1.4:** make the first dataset an independently discovered package consuming the INSEE snapshot contract. Remove source replay/source-local ownership.
- **1.5a:** replace “source-owned analysis dataset” with “independent analysis dataset consuming the same INSEE snapshot contract.” Preserve its category semantics and live-test requirement.
- **1.6:** keep report-specific choices open, but change prerequisites from “the INSEE source slice” to committed dataset contracts. It remains blocked until 1.5b is done.
- **1.7:** model source acquisition and dataset build/publication as distinct status nodes/stages linked through lineage.
- **1.8:** schedule INSEE acquisition independently; invoke generic downstream orchestration rather than making the source workflow own transforms and dataset publication.
- **1.9:** rebuild datasets by dataset discovery from committed snapshots, then build the public site.
- **2.2:** scaffold source acquisition/snapshot files only. Remove dbt, dataset IDs, dataset metadata, and report publication from the add-source workflow.
- **2.3:** rename to “Add and Evolve Dataset Packages Safely.” Make adding a dataset explicit; adding an indicator changes its owning dataset package and changes source acquisition only when the required raw field is absent.
- **2.5:** resolve report needs through dataset contracts; invoke add-source and add-dataset as separate dependency workflows.
- **3.1–3.3:** retain privacy goals but propagate visibility from private snapshots through independently built datasets and reports, with profile-specific dataset build roots.

Completed Story 1.3, 1.4, and 1.5a implementation specs remain historical records. Add a short supersession note linking them to 1.5b rather than rewriting their implementation record as though the original code had not existed.

### Code and documentation migration map

| Current location | Target ownership |
| --- | --- |
| `sources/insee-cpi/acquire.py`, source-native selection, source assertions | remain in `sources/insee-cpi/` |
| `sources/insee-cpi/dbt/models/insee_cpi_monthly.sql` | `datasets/insee-cpi-monthly/dbt/` |
| `sources/insee-cpi/dbt/models/insee_cpi_category_analysis.sql` | `datasets/insee-cpi-category-analysis/dbt/` |
| rent formulas and analytical limitations in `source-contract.md` | category-analysis dataset contract/docs |
| INSEE transforms and schema constants in `runtime/pulse/transform.py` | dataset packages; generic orchestration remains in runtime |
| hard-coded dataset shapes in `runtime/pulse/contracts/dataset.py` | committed per-dataset contracts loaded by a generic validator |
| INSEE-only replay branches/default paths in `runtime/pulse/cli.py` | generic dataset discovery and `dataset build` command |
| transformation tests under `tests/sources/` | dataset package/conformance tests |

## 5. Effort, Risk, and Sequencing

**Classification:** Major. Planning and architectural decisions change, although product scope does not.

**Estimated effort:** one substantial migration story before Story 1.6. The work is mostly relocation plus generic discovery/validation/orchestration, but it touches contracts, CLI, catalog fixtures, and tests.

**Primary risks:** accidental changes to published dataset behavior; confused status semantics; preserving a source-shaped ID convention; and building a generic mechanism that is secretly still INSEE-specific.

**Risk controls:** byte-preserve snapshots, compare old/new dataset rows and schemas, use a neutral synthetic conformance pair, assert shared runtime contains no exemplar IDs, keep offline replay, run the existing live INSEE test, and migrate Story 1.5 consumers atomically.

Sequence after approval:

1. Amend PRD, architecture, epics, Epic 1 context, and sprint status; create the Story 1.5b implementation spec.
2. Implement source/dataset discovery and contract boundaries.
3. Migrate both INSEE datasets and their tests/docs without changing source snapshots.
4. Migrate CLI/catalog/browser consumers and verify offline, browser, clean-build, and live-source behavior.
5. Review Story 1.5b. Resume Story 1.6 and report design only after acceptance.

## 6. Handoff and Completion Criteria

- **Architect/PM responsibility:** approve and apply the architecture, PRD, and epic corrections; ensure “vertical slice” is not used as package ownership.
- **Developer responsibility:** implement Story 1.5b, migrate code/contracts/tests, and preserve data behavior.
- **Review responsibility:** adversarially verify extension neutrality, contract ownership, replay independence, live-source coverage, and absence of INSEE knowledge in shared runtime.

The correction is complete when:

- source, dataset, and report are independently discoverable package types;
- only versioned snapshot and dataset artifacts cross their boundaries;
- a new dataset can be added without editing its source package or generic runtime;
- a new source can be added without defining a dataset;
- committed dataset contracts are inspectable without a build;
- the INSEE source package has no analytical transformations;
- shared runtime has no INSEE/dataset-shape special cases;
- immutable snapshots and both current CPI analytical outputs remain verified;
- offline, browser, clean-build, and explicit live INSEE tests pass;
- Story 1.6 remains report-specific and consumes only dataset contracts.
