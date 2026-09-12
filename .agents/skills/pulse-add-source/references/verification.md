# Completion gates

Verify declaration discovery and uniqueness; rights, visibility, schedule evidence and attribution; absence of unresolved `__...__` placeholders; fixture-only network isolation; exact file bytes or faithful Parquet; manifest hash, UTC timestamp, represented date, drift, assertions and LFS materialization; retry semantics; sanitized failures; standalone public status; unaffected pipelines; and one independent serialized-writer workflow. Confirm the change contains no dataset, dbt, indicator, report, visual, or report-facing artifacts.

Run:

```bash
python /home/yfontana/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/pulse-add-source
uv run --no-sync pytest tests/sources tests/runtime -q
uv run --no-sync pulse verify
git diff --check
```

Run source-specific live tests only through their explicit environment gate.
