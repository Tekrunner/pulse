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

## Public source acquisition

Every `sources/<source-id>/` package declares provider-native acquisition scope and
implements the same source-neutral runtime adapter contract. The adapter owns access
and faithful decoding through dlt; shared runtime owns discovery, acquisition IDs,
immutable archive rules, manifests, and generic CLI dispatch. Consumer semantics and
analytical typing do not belong in acquisition packages.

The first conforming slice records public Base-2025 INSEE CPI series. Its exact SDMX
XML fidelity, provider scope, source-data date rule, cadence, rights, attribution,
and downstream boundary are documented in
[`sources/insee-cpi/source-contract.md`](sources/insee-cpi/source-contract.md).

Install [Git LFS](https://git-lfs.com/) before cloning or rebuilding public raw
snapshots, then materialize tracked objects with `git lfs pull`. Raw API snapshots
under `snapshots/public/` are LFS-tracked; unresolved LFS pointer stubs are rejected.

Ordinary acquisition verification is offline and deterministic:

```sh
uv run pytest tests/sources tests/runtime -q
uv run pulse source acquire insee-cpi --fixture tests/fixtures/insee-cpi/response.xml
```

The second command writes an immutable local snapshot. Reuse the printed/generated
acquisition ID with `--acquisition-id` to perform an idempotent logical retry. The
faithful recorded SDMX-ML fixture covers ordinary CI without network access. Live
verification is separately marked, explicitly enabled, and archives only to pytest's
temporary directory:

```sh
PULSE_LIVE_INSEE=1 uv run pytest -m live tests/sources/test_insee_cpi_live.py -q
```

Story 1.8 will schedule this same proven live adapter path; scheduling and repository
publication remain outside the source package and outside ordinary verification.

## INSEE replay and publication

Rebuild the report-facing dataset from committed raw snapshots only:

```sh
uv run pulse source replay insee-cpi
```

Replay writes faithful disposable landing data under `build/landing/`. Its source-local
dbt-duckdb project publishes the wide data at `publish/public/data/insee-cpi/monthly/`:
one monthly `period` plus `cpi_index`, `monthly_change_pct`, and `annual_change_pct`.
The linked `dataset.json` records semantics, lineage, licence, attribution, SHA-256,
and assertion status. The initial Parquet is roughly 12 KB, below the provisional
5–50 MB delivery target, so no tuning is warranted.
