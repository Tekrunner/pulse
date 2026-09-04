# INSEE CPI monthly dataset contract

This independent dataset consumes the exact three-series historical INSEE CPI
snapshot and publishes one row per contiguous month. It exposes the provider's
Base-2025 headline index plus its provider-published monthly and annual changes;
none of the three values is calculated from another for publication.

The committed `dataset-contract.yaml` is the report-facing schema and semantic
authority. `dataset.json` is generated from it and adds selected-snapshot lineage,
the represented period, content hash, visibility, and data-test result.
