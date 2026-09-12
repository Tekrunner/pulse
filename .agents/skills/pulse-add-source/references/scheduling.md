# Independent source schedule

The schedule assets contain conspicuous non-runnable `__...__` placeholders, not defaults. Adapt them only after recording authoritative provider evidence in the package's `source-contract.md`. Keep the workflow under the skill until every placeholder is replaced so GitHub cannot schedule it accidentally.

Derive the declaration and cron together: identify the documented release cadence/window and provider timezone; convert the expected availability into UTC; choose a run after that availability; and document the calculation. Treat grace as a deliberate, evidenced tolerance rather than a copied constant. If any input is unknown, ask the user and stop schedule configuration. Monthly cadence alone is never enough to choose a day-of-month, grace period, or cron.

Each committed source workflow must be thin and independent: scheduled plus on-demand, `contents: write`, `concurrency.group: pulse-repository-writer`, `cancel-in-progress: false`, checkout of `main` with bulk LFS disabled, a source-scoped LFS pull, frozen installation, and `pulse source refresh <source-id> --live --logical-run-key "${{ github.run_id }}"`.

Let refresh continue long enough to record safe status. Then run `pulse status`, call `pulse source stage-publication <source-id>`, commit only when the scoped index differs, and push without force. Propagate refresh failure after safe state is staged. Do not name datasets, dataset columns, transformations, or dataset publication paths in the workflow.

Ordinary CI stays offline. A provider live test must be marked `live`, guarded by a source-specific opt-in environment variable, and run only when explicitly requested.

Before committing, search the new source package and workflow for `__[A-Z0-9_]+__`. Any match means configuration is incomplete and validation must fail.
