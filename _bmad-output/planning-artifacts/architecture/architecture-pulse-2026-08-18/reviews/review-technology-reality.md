# Reviewer Gate — Technology and reality

## Gate verdict

**Conditional fail — no critical findings, 2 high, 3 medium.** Every named version exists, and most individual runtime/package constraints are compatible on paper. The spine is not yet decision-grade on technology reality, however: the immutable Git LFS archive conflicts with the asserted free-tier operating envelope, and the exact dbt-core/dbt-duckdb/DuckDB tuple has resolver compatibility but no official or project-level execution evidence. The Observable and DuckDB-WASM path remains acceptably conditional only because AD-6 requires a fresh, blocking pilot.

Review date: 2026-08-18. Sources were limited to official project/package/provider material and the current repository. The spine was not edited.

## Verification matrix

| Commitment or asserted fit | Official/current evidence | Project reality | Assessment |
| --- | --- | --- | --- |
| CPython 3.13.14 | [Python 3.13.14](https://www.python.org/downloads/release/python-31314/) is an official 2026-06-10 release; the 3.13 line remains supported even though 3.14 is the newer feature line. | No project Python manifest or lockfile exists yet. | **Confirmed version; compatible seed.** dlt, dbt-core, dbt-duckdb, and DuckDB all publish Python 3.13-compatible metadata/wheels. |
| uv 0.12.0 | Official [uv 0.12.1](https://github.com/astral-sh/uv/releases/tag/0.12.1) followed 0.12.0 on 2026-07-31. | No `uv.lock`; locally installed uv is 0.9.12. | **Exists but already superseded.** No rationale records why 0.12.0, rather than the checked current patch, is the seed. |
| dlt 1.30.0 | [dlt 1.30.0](https://pypi.org/project/dlt/1.30.0/) supports Python 3.10–3.14. Its published metadata permits DuckDB 1.5.5 (`duckdb>=0.9` for the DuckDB extra). | No install/ingestion smoke test exists yet. | **Confirmed current and metadata-compatible.** Runtime fit remains unratified, as AD-10 acknowledges. |
| dbt-core 1.12.2 | [dbt-core 1.12.2](https://pypi.org/project/dbt-core/1.12.2/) is an official release and requires Python 3.10 or newer. | No `pyproject.toml`, `uv.lock`, dbt project, or exact-tuple run exists. | **Confirmed current individually.** Exact adapter compatibility is unconfirmed; see High 2. |
| dbt-duckdb 1.10.1 | [dbt-duckdb 1.10.1 metadata](https://pypi.org/pypi/dbt-duckdb/1.10.1/json) permits `dbt-core>=1.8.0` and `duckdb>=1.0.0`; its [official README](https://github.com/duckdb/dbt-duckdb/blob/master/README.md) documents `external` materialization and `ref()` usage. | No exact clean install or `external` model/test run exists. | **Resolver-compatible, not proven compatible.** The lower bounds do not demonstrate that this adapter release was tested against dbt-core 1.12.2 and DuckDB 1.5.5. |
| DuckDB Python 1.5.5 | [DuckDB 1.5.5](https://pypi.org/project/duckdb/1.5.5/) publishes CPython 3.13 wheels. | No project lockfile or query test exists. | **Confirmed current and metadata-compatible.** |
| Node.js 24.18.0 LTS | [Node 24.18.0](https://nodejs.org/en/download/archive/v24.18.0) is an official LTS release, but the official [release table](https://nodejs.org/en/about/previous-releases) lists later Node 24 LTS patches. Node 24.18.0 ships npm 11.16.0. | No `package.json` or `package-lock.json`; local Node is 22.21.1. | **Supported line, stale exact patch.** npm 11.17.0 is a separate upgrade, not the npm bundled with the Node pin. |
| npm 11.17.0 | The official [npm 11.17.0 package metadata](https://raw.githubusercontent.com/npm/cli/v11.17.0/package.json) accepts Node `^20.17.0 || >=22.9.0`; the official [npm v11 changelog](https://docs.npmjs.com/cli/v11/using-npm/changelog/) contains a later 11.18.0 release. | No lockfile or clean install exists. | **Compatible with Node 24.18.0, but superseded and not its bundled npm.** |
| Observable Framework 1.13.4 | [Observable Framework releases](https://github.com/observablehq/framework/releases) identify 1.13.4 as the latest stable release found. Official docs cover [static deployment](https://observablehq.com/framework/deploying) and [client-side SQL over Parquet](https://observablehq.com/framework/sql). The [configuration docs](https://observablehq.com/framework/config) do not remove the need to test real repository-subpath and nested-route behavior. | No site manifest or pilot exists. | **Confirmed current; asserted fit remains correctly conditional.** AD-6's blocking pilot is necessary and proportionate. |
| DuckDB-WASM 1.29.0, single-threaded EH | [DuckDB-WASM releases](https://github.com/duckdb/duckdb-wasm/releases) show that 1.29.0 aligns with DuckDB 1.1.1 and that later stable lines exist; 1.31.0 aligns with DuckDB 1.4.0. Official [deployment guidance](https://duckdb.org/docs/current/clients/wasm/deploying_duckdb_wasm) supports an EH bundle without the pthread worker/special cross-origin isolation required by threaded variants. | No browser bundle, Parquet query, or performance pilot exists. | **EH fit confirmed; exact 1.29.0 pin is stale and unexplained.** See Medium 1. |
| GitHub Actions, Pages, and LFS free tiers | Official limits: [LFS includes 10 GiB storage and 10 GiB monthly bandwidth, and Actions downloads consume bandwidth](https://docs.github.com/en/billing/concepts/product-billing/git-lfs); [Pages limits a published site to 1 GB](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits); [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) can deploy a verified artifact. | No usage forecast, artifact-size budget, or workflow exists. | **Deployment mechanism confirmed; free-tier fit is not.** See High 1 and Medium 3. |

Repository reality check: no `pyproject.toml`, `uv.lock`, `package.json`, or `package-lock.json` is present. This is consistent with a preimplementation architecture, but it means the stack table is only a candidate tuple. None of its cross-package behavior has yet been ratified by the repository.

## Tiered findings

### High 1 — The immutable LFS archive contradicts the claimed free-tier operating envelope

- **Evidence:** AD-1 makes every public raw snapshot permanent (line 45); AD-3 schedules an independent full-slice workflow per source (line 57); AD-10 stores public raw snapshots in Git LFS, enables LFS for every raw-consuming checkout, and requires normal operation to remain within the LFS free tier (line 115). GitHub's official [LFS billing rules](https://docs.github.com/en/billing/concepts/product-billing/git-lfs) include only 10 GiB of storage and 10 GiB of bandwidth per month on the free allowance, count Actions downloads against bandwidth, and charge storage for all referenced LFS objects. Watching usage does not change either limit.
- **Reality test:** one source adding only 50 MB per day accumulates about 18.25 GB in one year, before considering any other source. Repeated CI fetches of a growing archive can exhaust the monthly bandwidth earlier. Because snapshots are never deleted, the storage curve is unbounded while the allowance is fixed.
- **Impact:** the architecture's normal-operation cost invariant can fail even at the upper end of its own deferred 5–50 MB browser-file target, and independently scheduled sources multiply the problem. This is a substrate contradiction, not a routine implementation tuning issue.
- **Disposition: discuss before finalization.** Quantify source count, acquisition cadence, compressed snapshot size, retention horizon, and CI fetch behavior. Then either choose a bounded storage/archive contract that demonstrably fits the allowance, move immutable history to a storage substrate with an explicit budget, or relax the free-tier invariant. Selective LFS fetching can reduce bandwidth but cannot fix unbounded LFS storage.

### High 2 — The exact dbt adapter chain is accepted by metadata but not verified as a working tuple

- **Evidence:** dbt-duckdb 1.10.1 publishes broad lower bounds (`dbt-core>=1.8.0`, `duckdb>=1.0.0`) that allow dbt-core 1.12.2 and DuckDB 1.5.5. Those bounds prove that a resolver may select the tuple; they do not prove that the adapter release, which predates dbt-core 1.12.2, was tested with that core version and DuckDB version. No official adapter compatibility matrix or release evidence found in this review confirms the exact tuple. The repository has no lockfile or runnable dbt project with which to supply the missing evidence.
- **Impact:** adapter/core protocol drift can fail parsing, materialization, catalog behavior, or tests even when dependency resolution succeeds. The external-Parquet publication path is a central data contract, not an optional integration.
- **Mitigation already present:** AD-9 requires `ref()` plus `not_null` against an external Parquet model, and AD-10 requires a clean-install smoke test before ratification. Those gates are sound, but they also mean the table cannot yet be described as a verified-fit chain.
- **Disposition: block ratification, not exploration.** Treat the tuple as provisional until the exact locked environment passes `dbt --version`, `dbt debug`, parse/compile, build/test, external materialization, `ref()`, and a failing/passing `not_null` case. If it fails, select a dbt-core version with demonstrated adapter support or a later adapter; do not independently float one package.

### Medium 1 — DuckDB-WASM 1.29.0 is materially behind the current browser engine line

- **Evidence:** official [DuckDB-WASM releases](https://github.com/duckdb/duckdb-wasm/releases) state that 1.29.0 aligns with DuckDB 1.1.1, while later stable releases include 1.31.0 aligned with DuckDB 1.4.0. The spine gives no compatibility or behavior reason for selecting 1.29.0. This also creates a large engine-generation gap between browser DuckDB and Python DuckDB 1.5.5.
- **Impact:** Parquet behavior, SQL support, browser performance, bundle behavior, and bug fixes may differ from both current DuckDB-WASM and the server-side transform engine. It is not evidence that the architecture is invalid, but it makes the precise pin an unconfirmed preference.
- **Mitigation already present:** AD-6 requires a fresh version recheck and a blocking Observable-only pilot; AD-10 intentionally keeps the browser on the single-threaded EH path. Official guidance confirms that EH path remains valid.
- **Disposition: autofix at the pilot gate.** Resolve the current stable npm-published WASM version, test it against the representative Parquet/schema/query set and the EH bundle, and record any evidence-based reason to retain 1.29.0. Add a cross-engine conformance fixture for SQL/data types used by reports rather than assuming Python/WASM engine parity.

### Medium 2 — Three exact tool/runtime pins were already superseded on the stated check date

- **Evidence:** uv 0.12.1 followed the pinned 0.12.0; the Node release table lists later Node 24 LTS patches than 24.18.0; npm's v11 changelog lists 11.18.0 after 11.17.0. In addition, Node 24.18.0 bundles npm 11.16.0, so the spine's Node/npm pair requires an explicit npm upgrade. The npm engine range confirms that the pair is compatible, but not that it is the natural or most recently checked pair.
- **Impact:** the heading “checked 2026-08-18” can be read as current-version verification when these pins are compatibility candidates. Without a reason for holding older patches, later implementers cannot distinguish deliberate pinning from stale research.
- **Disposition: autofix before lock generation.** Recheck all exact versions together immediately before the first implementation change. Prefer the current patch in the selected Node LTS line and its bundled npm unless a tested reason requires a separate npm pin. Record any intentional older-pin rationale beside the generated lock/toolchain configuration.

### Medium 3 — The deployment contract omits two provider constraints needed for deterministic operation

- **Evidence:** GitHub Pages has a [1 GB maximum published-site size](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), but the spine defines no aggregate artifact-size budget across all browser Parquet and site assets. Separately, the official `actions/checkout` project documents LFS support, but an [open project PR addressing `lfs: true` checkout behavior](https://github.com/actions/checkout/pull/1392) records that fetching LFS objects does not necessarily materialize them into the working tree without an explicit checkout/pull step.
- **Impact:** a workflow can pass a nominal LFS-enabled checkout while processing pointer files, or build a valid artifact that Pages refuses because the aggregate is too large. Per-file 5–50 MB targets and provider-boundary monitoring do not establish either invariant.
- **Disposition: autofix in the exemplar workflow.** Set an aggregate Pages artifact budget below 1 GB with CI failure before upload. Make LFS object materialization explicit (`git lfs pull` or equivalent constrained fetch plus checkout) and verify that raw inputs are not pointer stubs before decoding. Constrain LFS fetch scope so one source workflow does not automatically download unrelated immutable history.

## Confirmed fit claims that should remain stable

- Python 3.13 is supported by the selected dlt/dbt packages, and DuckDB 1.5.5 publishes CPython 3.13 wheels.
- dbt-duckdb officially supports external materialization and `ref()`-based models; the spine is correct to make the precise external-model/test behavior an exemplar gate.
- Observable Framework 1.13.4 is a real current stable release, supports the selected Node line, generates static output, and documents browser-side SQL over Parquet.
- A single-threaded DuckDB-WASM EH bundle is a valid deployment choice without cross-origin isolation or the service-worker workaround prohibited by AD-10.
- GitHub Pages custom workflows can deploy one prebuilt artifact, matching the exact-artifact invariant.

## Gate conditions

Before the spine is finalized:

1. Resolve the immutable-archive/free-tier contradiction with a quantified operating model and an explicit storage decision.
2. Keep the dbt tuple provisional until the exact locked chain passes the required adapter/external-materialization test suite.
3. At the already-required site pilot, reselect or justify the DuckDB-WASM version and test the EH bundle against representative report data.
4. Refresh or justify superseded exact pins when generating the lockfiles.
5. Add deterministic LFS-materialization and aggregate Pages-size checks to the exemplar workflow contract.
