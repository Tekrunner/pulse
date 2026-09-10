# Pulse

Public source snapshots and canonical dataset Parquet publications are immutable,
Git LFS-backed artifacts. Their `snapshot.json` and `dataset.json` manifests stay
in normal Git so hashes, lineage, represented periods, and semantic changes are
reviewable. `site/data/browser-data.json`, `site/data/reports.json`, copied site
datasets, and `dist/` are generated outputs and must not be committed.

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

Open `http://127.0.0.1:3000/pulse/` or the direct nested route at `http://127.0.0.1:3000/pulse/reports/report`. The pilot uses the committed public INSEE CPI publication, a local single-threaded DuckDB-WASM EH bundle, and framework-neutral DOM/SVG modules. Reproducible measurements and budgets are recorded in `docs/report-pilot-performance.md`.

The verification command is the repository-local automation API used by both local development and CI. It reports the failing stage and its command output. The underlying suites can also be run directly while developing:

```sh
uv run pytest
npm run verify
```

The checks use only committed, offline fixtures. They do not fetch source data or retain generated dbt, DuckDB, or site state.

## Public source acquisition

Every `sources/<source-id>/` package declares provider-native acquisition scope,
a committed snapshot contract, and the source-neutral acquisition adapter. The
adapter owns access and faithful decoding; shared runtime owns discovery,
acquisition IDs, immutable archive rules, manifests, and generic CLI dispatch.
Source execution ends after it publishes an immutable snapshot. Consumer
semantics, analytical typing, dbt models, and dataset documentation do not belong
in acquisition packages.

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

Refresh a source and every dataset that declares it as a dependency through one
source-neutral command:

```sh
LOGICAL_RUN_KEY="manual-2026-09-10T14-37-52Z-7f3a9c"
uv run pulse source refresh insee-cpi --live --logical-run-key "$LOGICAL_RUN_KEY"
```

Choose and record one unique key once for each manual observation (for example, a
UTC timestamp through seconds plus a random suffix, as above). Reuse that exact
stored value for every retry; do not regenerate it when rerunning the command. The
key is hashed into an opaque acquisition ID. Matching retry bytes produce no
duplicate snapshot, rebuild, or empty commit; different bytes under the same key
fail without replacing prior artifacts. A distinct observation needs a new unique
key even when its bytes happen to match an earlier one.

The INSEE workflow runs automatically at 06:17 UTC on day 23 of each month and is
also available from GitHub Actions via **Run workflow**. It serializes all writes
through the shared `pulse-repository-writer` concurrency group, starts from current
`main`, materializes only the INSEE snapshot LFS inputs, and commits at most one
scoped source/dataset status update. On acquisition or build failure it commits a
sanitized diagnostic first and then reports the job failure; retained snapshots
and usable dataset publications remain intact.

## Independent dataset build and publication

Every `datasets/<dataset-id>/` package independently declares the snapshot
contract it consumes, its build entry point, dbt models/tests, and its committed
report-facing contract. A dataset package never invokes acquisition or imports
source-package code. Shared runtime discovers and executes the declarations
without knowing provider IDs, analytical columns, or formulas.

Rebuild every report-facing dataset from committed snapshots only:

```sh
uv run pulse dataset build all
```

Build one dataset with `pulse dataset build <dataset-id>`. Disposable staging is
kept under `build/datasets/` and is private to that build; it is not a source or
inter-package contract. `insee-cpi-monthly` publishes one monthly `period` plus
`cpi_index`, `monthly_change_pct`, and `annual_change_pct`.
`insee-cpi-category-analysis` supplies food, energy, and actual-rent levels; food
and energy annual changes; annual basket weights with explicit reference years;
and INSEE's official broad contributions for food, services, manufactured
products, and energy.

INSEE does not expose a matching provider-published annual-change or contribution
series for actual rents paid (COICOP 04.1). Pulse derives rent annual change from the
monthly index, then calculates `rent_weight / 10000 * rent_annual_change_pct`. Both
fields are labelled as Pulse calculations from INSEE series, never as official
INSEE contributions or causal estimates. Output ends at the latest complete
common month; asynchronous releases are not imputed. The authoritative committed
contracts and full limitations are in
[`datasets/insee-cpi-monthly/`](datasets/insee-cpi-monthly/) and
[`datasets/insee-cpi-category-analysis/`](datasets/insee-cpi-category-analysis/).
Generated `dataset.json` combines those semantics with snapshot lineage,
represented period, visibility, content hash, and test status.

## Visual Contract and browser catalog

Visual Contract v1 is documented in [`docs/visual-contract-v1.md`](docs/visual-contract-v1.md).
It keeps reports responsible for parameter-bound queries and provenance while visuals
receive validated plain rows plus display inputs. Breaking contract majors require an
atomic migration or an application-owned compatibility adapter.

The site build runs `pulse catalog build` to compile `browser-data.json` from complete
public `dataset.json` contracts. The generated catalog and copied Parquet are disposable
site inputs: its manifest-relative URL is resolved from the catalog, never the report
route. Verify this whole offline path with:

```sh
uv run pytest tests/runtime tests/sources tests/datasets -q
npm run verify
uv run pulse verify
```
