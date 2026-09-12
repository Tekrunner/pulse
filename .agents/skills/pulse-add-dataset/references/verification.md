# Dataset completion gates

Run offline package tests first, then:

```sh
uv run --no-sync pulse dataset build <dataset-id>
uv run --no-sync pytest tests/datasets tests/runtime -q
uv run --no-sync pulse verify
git diff --check
```

Inspect the emitted manifest and Parquet with DuckDB. Verify exact types, row grain, represented-period bounds, non-empty indicators, semantic metadata, snapshot hash lineage, deterministic rebuild hash, and that a deliberately invalid input or dbt test failure retains the prior manifest/Parquet pair. Keep live provider access outside this workflow.
