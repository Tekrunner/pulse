---
story: 1.5b
title: Establish Independent Source and Dataset Package Boundaries
status: done
reviewed: 2026-09-04
created: 2026-09-03
source: ../../planning-artifacts/sprint-change-proposal-2026-09-03.md
---

# Story 1.5b: Establish Independent Source and Dataset Package Boundaries

## Intent

Migrate the exemplar-shaped implementation into Pulse's extension architecture. Sources fetch and publish immutable snapshots. Independently discovered dataset packages consume snapshots and publish report-facing datasets. Reports consume dataset contracts. Shared runtime knows only package and artifact contracts.

## Invariants

- Preserve every committed snapshot byte and acquisition identity.
- Keep ordinary verification deterministic and offline; execute the explicit live INSEE contract test for acceptance.
- Source packages contain no dbt models, report-facing columns, analytical formulas, or dataset documentation.
- Dataset packages do not invoke acquisition or import source-package code.
- Shared runtime and generic validators contain no INSEE IDs, CPI fields, rent formulas, or hard-coded dataset shapes.
- Dataset schema and semantic metadata are committed, machine-readable inputs. Generated manifests add measured artifact facts.
- V1 datasets have one declared source dependency, but dataset IDs and package ownership are source-neutral.

## Tasks

- [x] Add generic dataset declaration, contract, discovery, validation, and build orchestration.
- [x] Reduce source discovery/execution to acquisition and snapshot publication.
- [x] Create independent packages for CPI monthly and CPI category analysis; move dbt, formulas, metadata, tests, and documentation.
- [x] Replace INSEE-specific CLI replay with `pulse dataset build <dataset-id>` and a generic whole-dataset build.
- [x] Derive `dataset.json` from committed contracts plus observed hashes, periods, lineage, status, and visibility.
- [x] Add neutral synthetic source/dataset conformance proving extension without INSEE code.
- [x] Migrate browser/catalog consumers atomically and preserve analytical outputs.
- [x] Update README and remove dataset semantics from the INSEE source contract.
- [x] Run Python, Node/browser, clean-build, diff, extension-neutrality, and explicit live INSEE verification.

## Acceptance

The full acceptance criteria are canonical in `planning-artifacts/epics.md`. Completion additionally requires an old/new row-and-schema comparison for both CPI datasets, a repository search proving shared runtime contains no exemplar identifiers, and an explicit record of the successful live INSEE command.
