# Completion gates

Verify declaration discovery and uniqueness; rights, visibility, schedule evidence and attribution; absence of unresolved `__...__` placeholders; fixture-only network isolation; exact file bytes or faithful Parquet; manifest hash, UTC timestamp, represented date, drift, assertions and LFS materialization; retry semantics; sanitized failures; standalone public status; unaffected pipelines; and one independent serialized-writer workflow. Only fixture-driven tests may assert literal dates, counts or hashes; a test over committed snapshots or status reads them from `snapshots/public/<source>/*/snapshot.json` (`AGENTS.md` › Tests over published data). Confirm the change contains no dataset, dbt, indicator, report, visual, or report-facing artifacts.

During implementation, run the smallest relevant source/runtime test files first.
Expand to the affected subsystem only after those pass:

```bash
uv run --no-sync pytest tests/sources tests/runtime -q
```

After the final code change and consolidated review fixes, run the complete gate
once; do not separately repeat the full Python or frontend suites around it:

```bash
uv run --no-sync pulse verify
git diff --check
```

Run source-specific live tests only through their explicit environment gate.
