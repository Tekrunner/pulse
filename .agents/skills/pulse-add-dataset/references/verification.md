# Dataset completion gates

During implementation, run the smallest relevant dataset/runtime test files first.
Expand to `tests/datasets tests/runtime` only after those pass, then build and
inspect the package:

```sh
uv run --no-sync pytest tests/datasets tests/runtime -q
uv run --no-sync pulse dataset build <dataset-id>
```

Inspect the emitted manifest and Parquet with DuckDB. Verify exact types, row grain, represented-period bounds, non-empty indicators, semantic metadata, snapshot hash lineage, deterministic rebuild hash, and that a deliberately invalid input or dbt test failure retains the prior manifest/Parquet pair. Keep live provider access outside this workflow.

After the final code change and consolidated review fixes, run the complete gate
once; do not separately repeat the full Python or frontend suites around it:

```sh
uv run --no-sync pulse verify
git diff --check
```
