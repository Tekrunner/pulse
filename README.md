# Pulse

## Workspace verification

Pulse requires CPython 3.13, [uv](https://docs.astral.sh/uv/), Node 24, and its bundled npm 11.
No global Python or Node packages are required.

From a clean checkout, reproduce the locked environments and run every Story 1.1 smoke gate:

```sh
uv sync --frozen
npm ci
uv run pulse verify
```

The verification command is the repository-local automation API used by both local development and CI. It reports the failing stage and its command output. The underlying suites can also be run directly while developing:

```sh
uv run pytest
npm run verify
```

The checks use only committed, offline fixtures. They do not fetch source data or retain generated dbt, DuckDB, or site state.
