---
name: pulse-add-dataset
description: Add a Pulse report-facing dataset or indicator from an existing immutable snapshot using package-owned dbt models, semantic contracts, and offline conformance. Route missing acquisition to pulse-add-source.
---

# Add a Pulse dataset

Finish at a deterministic, typed, wide Parquet publication built from an immutable snapshot. Keep acquisition and provider decoding in the source package; keep analytical meaning and tests here.

1. Confirm that a suitable `sources/<source-id>/snapshot-contract.yaml` and immutable fixture snapshot exist. If they do not, stop and route only that prerequisite to `pulse-add-source`; never invent a dataset or fetch inside a dataset builder.
2. Read [references/dataset-package.md](references/dataset-package.md), copy `assets/dataset-package/` to `datasets/<dataset-id>/`, and replace every example identity and semantic decision. Do not inspect or copy an unrelated dataset or report implementation.
3. Express selection, typing, derivation, grain, and data-quality tests in package-owned dbt SQL/YAML. Run them with the shared `pulse.dbt.run_dbt` DuckDB seam. The Python builder may select a valid snapshot, invoke dbt, and summarize results; it must not implement production analytical transformations. Each test answers a question about this table and the classifications this package declares, under the layer contract in `AGENTS.md`.
4. Publish lowercase kebab-case identity plus machine-readable questions, derivations, types, definitions, units, provenance, licence, attribution, temporal meaning, and validation rules. Use one source and wide report-facing rows.
5. Test both API-Parquet and original-file decoding when the source contract permits that format. Assert exact output schema, non-empty/grain behavior, deterministic hash, rejection/retention, registry-free discovery, and no network access.
6. Run the gates in [references/verification.md](references/verification.md). Report the snapshot and contract versions, represented period, output hash, assertion state, and any unresolved semantic or provider risk.

Never put provider acquisition in dbt, bypass dbt with ad hoc transformation code, mutate snapshots, add report-specific queries, or publish a partial candidate.
