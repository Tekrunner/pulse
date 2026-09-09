---
title: 'Story 1.7: See Pipeline Health and Data Freshness'
type: 'feature'
created: '2026-09-09'
status: 'done'
baseline_commit: '9940285dab0941286f2f743f82e32702514f115e'
review_loop_iteration: 0
context: ['_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Reports present figures with no way to tell whether the pipeline behind them ran, succeeded, or went quiet. Dataset manifests carry a loose `status` object that never reaches the browser, cadence declarations are human prose so nothing can compute overdue data, and the homepage hardcodes its links.

**Approach:** Publish a strictly validated status artifact for source and dataset pipelines against an expected-pipeline catalog compiled from declarations, make the publication schedule machine-readable, and surface state on the homepage and in report provenance — computing staleness in the browser against the current clock.

## Boundaries & Constraints

**Always:** Canonical stages are source `acquire`/`snapshot` and dataset `transform`/`test`/`publish-data`. States are `not-run`, `succeeded`, `suspect`, `stale`, `failed`; display precedence `failed > suspect > stale > succeeded`; `not-run` only before any attempt; a stage that never ran stays distinguishable from one that succeeded. Compute staleness in the browser from the declared schedule against the current clock — never bake a precomputed state string, because a frozen artifact must still report overdue data. `suspect` keeps the new dataset as latest usable output; `failed` retains the last successfully derived dataset as latest usable, and report freshness reflects that retained dataset. Reuse `status.assertions[].affected_columns` as column lineage; show impact as unknown or possibly affected when column precision is unavailable. Surface degraded state as text in exactly two places: the homepage pipeline list, and one qualification line in the report provenance block naming the affected visuals. Validate with the exact-field-set pattern and schema id/version constants. Serve status as same-origin JSON resolved manifest-relative. Sanitize every diagnostic. Meet WCAG 2.2 AA with non-color-only cues, keep healthy state quiet, and keep navigation and reports usable when a status component fails. Represent the repository writer as part of publication, never as a user-facing pipeline.

**Ask First:** Changing the five states, the precedence order, or the canonical stage names; changing deadline or grace semantics; introducing any site or deploy pipeline; contract-major changes to snapshot or dataset manifests; removing existing declaration fields.

**Never:** `system/site`, `build-site`/`deploy-site` outcomes, or site-level freshness — dropped from this story on 2026-09-09 as redundant with browser-computed data freshness. No per-figure status notices, no new status component, no new severity tokens, and no ARIA choreography beyond the existing patterns — degraded state is carried by text, and `--color-error` is the only colour it may reuse. No precomputed staleness strings, GitHub Actions APIs or other mutable external state, remote assets, route-derived URLs, color-only state cues, stack traces or raw upstream text in diagnostics, and no scheduled acquisition (Story 1.8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Catalog compile | Discovered source and dataset declarations | Expected-pipeline catalog holds every source and dataset pipeline ID and name | Undeclared runtime job or missing expected entry fails validation |
| First run | No attempt recorded | `not-run`; never-run stages remain distinguishable | No diagnostic emitted |
| Assertions failed | Contract-compliant dataset, `suspect` with `affected_columns` | Source `suspect`; new dataset stays latest usable; report names the affected visuals | Says impact is unknown when the assertion identifies no columns |
| Undecodable snapshot | Transform cannot produce a compliant dataset | Failing stage `failed` with safe diagnostic; prior dataset retained as latest usable | Report freshness reflects the retained dataset, not the failed observation |
| Period not advanced | Represented period end against declared schedule | `stale` only once the declared deadline passes | Before the deadline the state stays `succeeded` |
| Status unavailable | Status file absent or wrong `schemaId` | Homepage and reports stay usable; status degrades visibly | Normalized error, no crash, no data-load failure |

</frozen-after-approval>

## Code Map

- `sources/insee-cpi/source.yaml:53` -- `fetch_cadence`/`expected_publication_advance` are prose; add a machine-readable schedule beside them.
- `runtime/pulse/sources.py:62`, `:108` -- exact-field-set validator and declaration mapping to extend; `:117` `discover_sources`.
- `runtime/pulse/datasets.py:178` `discover_datasets` -- second catalog input; `:282` diagnostic write, `:330` lineage, `:354`-`:366` sanitized build failure (currently untested).
- `runtime/pulse/contracts/snapshot.py:52` -- strict exact-field-set pattern to mirror; `contracts/dataset.py:11` id/version constants, `:66` `diagnostic()`/`validate_diagnostic` (stage hardcoded `transform`, `retryable` always true — extend for canonical stages).
- `datasets/_shared/insee_cpi.py:148`, `:200` -- emits `{state, assertions[].affected_columns}`; the existing column-lineage hook.
- `runtime/pulse/catalog.py:29`, `:108` -- `_entry` omits `status` and `lineage` from the browser catalog; `:137`, `:209` write `site/data/reports.json`, which **no JS consumes today**.
- `runtime/pulse/cli.py:18`, `:57` -- argparse subparsers and linear dispatch; add `pulse status`.
- `runtime/pulse/verify.py:112` -- `SMOKE_STAGES` tuple registry to append a check to.
- `site/index.md:1` -- homepage with hardcoded links, no data-driven listing.
- `site/data/client.js:16` -- `schemaId` plus `1.*` gate and `DataClientError` codes to mirror; `:106`, `:110` manifest-relative resolution.
- `site/data/browser-shell.js:7` -- `import.meta.url` resolution precedent; `scripts/build-site.mjs:24` copies `site/data/*` into `dist/_import/data/`.
- `site/reports/french-consumer-prices/report.js:230`, `:259` -- `figureCard`/`fail` slot isolation seam; `:393` `state()`; `:940` represented-period intersection; `:986` provenance `<dl>`; `:87` `scenarioClient` query-string fixture injection to extend.
- `site/style.css:1` -- existing tokens to reuse; `--color-error` is the only severity colour and no new one is introduced.
- Models to mirror: `tests/runtime/test_catalog.py` (contract tests over copied real publications), `tests/node/client-contract.test.mjs` (behavioral stubs), `tests/browser/pilot.spec.js:208` (table-driven state matrix), `tests/browser/artifact-scan.mjs:5` (required artifacts, leak regexes).
- Read-only evidence: `snapshots/public/**` and `publish/public/**` are the committed real fixtures.

## Tasks & Acceptance

**Execution:**
- [x] `sources/insee-cpi/source.yaml`, `runtime/pulse/sources.py` -- add a machine-readable publication schedule and extend the strict field set, so a deadline is computable.
- [x] `runtime/pulse/contracts/status.py`, `runtime/pulse/contracts/__init__.py` -- status and expected-pipeline schemas, id/version constants, strict validators, canonical stages, states, and precedence in one owning module.
- [x] `runtime/pulse/datasets.py`, `datasets/_shared/insee_cpi.py` -- publish per-pipeline status with snapshot lineage, retained latest-usable output, and sanitized diagnostics carrying the real failing stage.
- [x] `runtime/pulse/catalog.py`, `runtime/pulse/cli.py`, `runtime/pulse/verify.py` -- compile the expected-pipeline catalog and status into `site/data/`, add `pulse status`, register a verify stage.
- [x] `site/data/`, `site/index.md` -- status client module and data-driven homepage listing reports plus each pipeline with state, last attempt, and safe diagnostic; reuse existing tokens.
- [x] `site/reports/french-consumer-prices/report.js` -- one provenance qualification line naming affected visuals; extend `scenarioClient` for status states.
- [x] `tests/runtime/`, `tests/node/`, `tests/browser/`, `tests/browser/artifact-scan.mjs` -- fixture matrix across states, stages, precedence, deadline transitions, and lineage-precision levels, plus diagnostic-leak assertions and the new required artifact.

**Acceptance Criteria:**
- Given the homepage, when navigation and status catalogs load, then it links every included report and lists every expected source and dataset pipeline with freshness, stage state, assertion state, last attempt, latest usable output, and safe diagnostic context, and healthy state stays quiet.
- Given the French macro report, when provenance renders, then it states the represented period and source, and when lineage is stale, suspect, or failed it adds one line naming the affected visuals — or saying impact is unknown when the assertion identifies no columns — without implying a failed observation replaced the retained dataset.
- Given keyboard navigation, assistive technology, zoom, and narrow layouts, when health information is read and operated, then every state has semantic text, accessible names, visible focus where interactive, sufficient contrast, and non-color-only distinctions, and navigation and report access survive a status component that fails to render.
- Given a frozen artifact served long after its build, when it is opened, then overdue data reports itself stale from the browser clock instead of claiming freshness.

## Spec Change Log

## Verification Evidence

- `uv run --no-sync pytest` -- 108 passed, 1 deselected (`live`), in 89s. The 28 new status tests cover every matrix row, the five states, precedence, deadline transitions, and both lineage-precision levels.
- `uv run --no-sync pulse status` -- prints all three expected pipelines; both datasets read `succeeded` at 2026-09-09 because data through 2026-07-01 is only overdue once the August observation misses 2026-09-15 plus grace. Boundary confirmed directly: the flip to `stale` lands on 2026-09-22.
- `npm run verify` node contract stages -- all passed, including "staleness is derived at read time and failures stay normalized".
- `npm run build` and `npm run portability:build` -- pass, after `scripts/build-site.mjs` was fixed to spawn `observable.cmd` through a shell on Windows.
- `npx playwright test` -- 82/82 passed across Chromium and Firefox.
- `npm run artifact:scan` -- passed (38,815,906 bytes), asserting no pipeline or stage bakes a staleness state and no diagnostic carries a traceback or private path.
- `PLAYWRIGHT_BROWSERS_PATH` must point at a browser store outside `%LOCALAPPDATA%` on Windows; Playwright's Firefox cannot activate its `mozglue` side-by-side assembly from the default `ms-playwright` location and fails every launch with `spawn UNKNOWN`. Verified working from `C:\pw`.
- `uv run --no-sync pulse verify` -- **passed**, exit 0, 383s: status contract, 108 Python tests, node contracts, site and portability builds, 82 browser tests across Chromium and Firefox, artifact scan.
- Archive write path rebuilt during verification: `_write_parquet` bulk-loads through `read_json` instead of binding 6,354 rows one at a time, which removed 178,740 uncached failed `pandas` imports per acquisition. Full Python suite 1518s -> 89s; `raw.parquet` stays byte-identical at `8106c9fd4a1e...`, now pinned by `test_fixture_acquisition_reproduces_committed_snapshot_bytes`.
- Review patch applied: `site/data/status-scenarios.js` no longer ships a `status-healthy` fixture, which `?scenario=` could have used to render fabricated healthy state over a degraded pipeline. Re-verified after the change: node status contract passed, `npm run build` passed, 41/41 Chromium, artifact scan passed (38,816,137 bytes). `pytest` was not re-run because removing a browser fixture cannot affect it.

## Design Notes

Staleness lives client-side. The existing prose ("final CPI normally advances in the middle of the following month") becomes a declared, validated schedule, and the deadline derives from the represented period rather than fetch time:

```yaml
publication_schedule:
  period: monthly
  expected_by_day_of_following_month: 15
  grace_days: 7
```

Map `affected_columns` to report slots through the `report.yml` lineage already compiled by `catalog.py` instead of inventing a second lineage format. Keep status in its own same-origin JSON rather than folding it into `browser-data.json`, so a failed status read can never break data loading.

Presentation stays deliberately small. The homepage lists each pipeline as name, state, last attempt, and a safe diagnostic when degraded. The report adds one line to the existing provenance `<dl>` at `report.js:986`, appearing only when state is not `succeeded`, of the form "Suspect data — affects Figure 2 and Figure 3" or "Suspect data — affected visuals unknown". Nothing is attached to individual figures: figures keep drawing, and the per-figure `role="alert"` path at `report.js:259` stays reserved for render failures, since suspect data is a qualification rather than an interruption.

## Verification

**Commands:**
- `uv run --no-sync pulse status` -- prints the derived state for every expected pipeline.
- `uv run --no-sync pytest` -- contract, state-derivation, precedence, and deadline-transition tests pass.
- `uv run --no-sync pulse verify` -- Python and Node stages pass.
- `npm run verify` -- contract tests, browser state matrix, and artifact scan pass.

**Manual checks (if no CLI):**
- Browser verification requires `uv sync --frozen`, `npm ci`, and `npx playwright install chromium firefox`; none are present in this environment, and Story 1.6 established that passing smoke tests alone do not evidence completion.

## Suggested Review Order

**Freshness derivation — the invariant the design rests on**

- Canonical vocabulary and precedence own the whole state model in one place.
  [`status.py:35`](../../runtime/pulse/contracts/status.py#L35)

- Deadline derives from the represented period, so July is late only once August misses.
  [`status.py:99`](../../runtime/pulse/contracts/status.py#L99)

- The reader resolves staleness against its own clock, never the build's.
  [`status-client.js:159`](../../site/data/status-client.js#L159)

- Published status omits `stale` by design; this asserts nobody reintroduces it.
  [`artifact-scan.mjs:12`](../../tests/browser/artifact-scan.mjs#L12)

**Status compilation and publication**

- Compiles one entry per expected pipeline and rejects undeclared jobs.
  [`catalog.py:449`](../../runtime/pulse/catalog.py#L449)

- Records the attempt before anything can fail, so a failed build still reports one.
  [`datasets.py:326`](../../runtime/pulse/datasets.py#L326)

- Failures carry the canonical stage instead of blaming the transform for everything.
  [`datasets.py:47`](../../runtime/pulse/datasets.py#L47)

- An unattributable diagnostic cannot be displayed, so it is a contract error.
  [`dataset.py:87`](../../runtime/pulse/contracts/dataset.py#L87)

- Machine-readable schedule beside the prose it makes computable.
  [`source.yaml:55`](../../sources/insee-cpi/source.yaml#L55)

**The two surfaces, and only two**

- Homepage lists reports and pipelines from data; state is text, not colour.
  [`home.js:184`](../../site/data/home.js#L184)

- One provenance line names affected visuals; nothing attaches to a figure.
  [`report.js:407`](../../site/reports/french-consumer-prices/report.js#L407)

- Report impact resolves through existing `report.yml` lineage, not a second format.
  [`status-client.js:175`](../../site/data/status-client.js#L175)

**Supporting changes**

- Degraded fixtures only: a healthy fixture would let a link fake trust.
  [`status-scenarios.js:136`](../../site/data/status-scenarios.js#L136)

- State, precedence, deadline and lineage-precision coverage.
  [`test_status.py:1`](../../tests/runtime/test_status.py#L1)

- Homepage state matrix, keyed on scenario because two share the suspect state.
  [`pilot.spec.js:645`](../../tests/browser/pilot.spec.js#L645)

- Provenance qualification asserted per scenario, with figures still drawing.
  [`pilot.spec.js:737`](../../tests/browser/pilot.spec.js#L737)

