---
name: pulse-change-dataset-schema
description: Safely evolve a Pulse dataset schema through repository-wide consumer inventory, change classification, atomic migration, or an explicit application-owned compatibility adapter.
---

# Change a Pulse dataset schema

Inventory and classify before implementation. Do not expose a changed schema until every affected consumer is migrated atomically or covered by an owned, tested adapter.

1. Read [references/impact-and-migration.md](references/impact-and-migration.md). Copy the current contract to a temporary proposed contract, edit that copy, then run `pulse dataset impact <dataset-id> --contract <proposed-contract>`. Review every declaration, SQL/exploration query, visual contract/fixture, lineage entry, test, catalog surface, and ambiguous code match. A generated catalog is evidence, not authority.
2. Classify the edit as `compatible-addition`, `compatible-modification`, or `breaking-consumer-change`. Record every consumer and its resolution in a package-local `schema-change.yaml` based on `assets/schema-change.yaml`. Do not implement while the inventory is incomplete or ambiguous.
3. For a breaking change, either migrate all consumers in the same change or declare the application-boundary adapter in [references/compatibility-adapters.md]. The adapter needs explicit versions, owner, removal condition, old logical table, and total mappings for removed/retyped columns. Never put provider- or visual-specific logic in shared runtime.
4. Update package-owned dbt SQL and data tests, contract semantics, fixtures, report/exploration SQL, visual schemas and accessible equivalents together. Do not weaken behavior, silently coerce missing fields, or use persisted warehouse migrations; every rebuild starts from snapshots.
5. Run `pulse dataset impact` again and the gates in the impact reference. Prove old/new coexistence for an adapter, adapter removal only after its condition is met, correct non-empty mapped rows and accessible output, failure isolation, deterministic rebuilds, and retention after any failure.

Ask before a contract major version, new dependency, incomplete breaking migration, or weaker consumer behavior.
