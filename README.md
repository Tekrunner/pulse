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

## Report pilot

Build the static Observable report or start the local server through Pulse's single automation API:

```sh
uv run pulse site build
uv run pulse site serve
```

Open `http://127.0.0.1:3000/pulse/` or the direct nested route at `http://127.0.0.1:3000/pulse/reports/report`. The pilot uses offline fixture rows, a local single-threaded DuckDB-WASM EH bundle, and framework-neutral DOM/SVG modules. Reproducible measurements and budgets are recorded in `docs/report-pilot-performance.md`.

The verification command is the repository-local automation API used by both local development and CI. It reports the failing stage and its command output. The underlying suites can also be run directly while developing:

```sh
uv run pytest
npm run verify
```

The checks use only committed, offline fixtures. They do not fetch source data or retain generated dbt, DuckDB, or site state.
