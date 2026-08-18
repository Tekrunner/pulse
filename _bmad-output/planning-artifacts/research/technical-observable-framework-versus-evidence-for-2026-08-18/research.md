---
title: 'Technical selection: Observable Framework versus Evidence for Pulse'
type: technical
topic: 'Observable Framework versus Evidence for Pulse'
decision: 'Choose the report-site substrate for Pulse v1'
source: 'native web research'
status: complete
preset: standard
validation: normal
claims_verified: 11
claims_unverified: 2
created: '2026-08-18'
updated: '2026-08-18'
---

# Technical selection: Observable Framework versus Evidence for Pulse

**Decision this research serves:** Choose the report-site substrate for Pulse v1.

## Executive summary

Choose **Observable Framework provisionally**, then bind it only after a small production-path and exit-seam pilot.

The maintenance concern is real for both candidates. Each moved from active feature development to sparse, concentrated maintenance, and both latest npm releases are five to six months old.[1][2][3][4] Evidence created a new open-source `next` snapshot on 2026-08-17, but one unreleased commit on a non-default branch is not yet a maintenance record.[8]

Neither candidate fails Pulse's hard gates. Both have supported static-build paths, browser DuckDB-WASM paths over Parquet, and arbitrary HTML/SVG/CSS interaction without a visualization library.[10][11][14][15][20] Observable leads because its visual boundary can remain an ordinary JavaScript function returning DOM/SVG. Evidence makes reusable arbitrary visuals Svelte components and couples more of the project to Evidence preprocessing, source commands, and generated manifests.[13][14][16][17][18]

Observable is not a healthy, fast-moving dependency. The recommendation survives only if Pulse keeps it as a disposable page shell. If the pilot cannot move the same visual and data client into a minimal Vite page unchanged, reject Observable.

## Requirements and hard-gate screen

The requirements below come from the project decision frame, not from web evidence.

| Hard gate | Observable Framework | Evidence |
| --- | --- | --- |
| Static GitHub Pages output | Pass: documented static build and deployment path.[10] | Pass: documented GitHub Pages build with base-path configuration.[15] |
| Browser DuckDB-WASM over Parquet | Pass: first-class client SQL over Parquet.[11] | Pass: generated Parquet is consumed by browser DuckDB-WASM.[20] |
| Arbitrary HTML/SVG/CSS without a visualization library | Pass: ordinary DOM-returning JavaScript components.[10] | Pass: scratch Svelte components; built-in chart components are optional.[14] |
| Repository-first reproducibility | Pass, provided implicit npm imports are pinned.[13] | Pass, provided the Core package and generated-data path are pinned.[16][17] |
| Structural public/private separation remains possible | Pass through separate source/build/artifact boundaries; no native classifier was found. | Pass through separate source/build/artifact boundaries; no native classifier was found. |

No candidate is eliminated. The public/private boundary remains a Pulse architecture responsibility and must be tested against the complete built artifact.

## Weighted decision matrix

Scores use a 0–5 scale. Weighted points are `score / 5 × weight`; the matrix is intentionally re-weightable.

| Criterion | Weight | Observable | Evidence | Basis for the scores |
| --- | ---: | ---: | ---: | --- |
| Visual-authoring and data-interface fit | 30 | 4.5 → 27.0 | 3.5 → 21.0 | Observable's reusable boundary can be plain DOM/SVG; Evidence's equivalent freedom crosses a Svelte/compiler boundary.[10][14] |
| Ecosystem health and five-year regret | 25 | 2.5 → 12.5 | 2.0 → 10.0 | Both had severe activity cliffs; Evidence's strategy moved explicitly toward Studio, while its new `next` reset is not yet released.[1][2][7][8] |
| Agent ergonomics, testing, debugging | 15 | 4.0 → 12.0 | 3.5 → 10.5 | Observable modules use ordinary JavaScript tooling but require explicit cleanup discipline; Evidence provides Svelte lifecycle and an official Playwright route at the cost of more compiler context.[12][14][22] |
| DuckDB/data delivery and performance fit | 15 | 4.0 → 12.0 | 4.5 → 13.5 | The examined versions of both frameworks integrate DuckDB-WASM 1.29.0; Evidence supplies more generated Parquet/cache machinery, though one current issue exposes a large-Parquet risk.[20][21][24] |
| Deployment and operational simplicity | 10 | 4.5 → 9.0 | 3.5 → 7.0 | Both deploy statically; Evidence adds exact base-path/build-directory rules and an unfixed expression-attribute preprocessing defect.[10][15][19] |
| Migration-away cost | 5 | 4.5 → 4.5 | 3.0 → 3.0 | Observable can isolate special imports/reactivity in page adapters; Evidence's CLI and build copy/preprocess Markdown and Svelte while generating runtime manifests and rewritten paths.[13][17][18] |
| **Total** | **100** | **77.0** | **65.0** | Observable leads by 12 weighted points. |

Giving both candidates the same health score still leaves Observable ahead because visual portability and framework reach dominate the stated weights.

## Current implementation reality

Observable's reusable visual boundary is the smaller one: a JavaScript function can return a DOM element and live in an ordinary local module. Page-level reactivity remains Observable-specific, including topological cell execution and invalidation-driven cleanup.[10][12] Portability depends on discipline: the module must accept plain data, return standard DOM/SVG, and avoid `observablehq:` imports, implicit globals, and Framework file/runtime protocols.[13]

Evidence can deliver the same visual freedom, but the escape hatch is a `.svelte` component compiled inside Evidence Core. Core 40.1.8's reproduced stack uses Svelte 4.2.19 and SvelteKit 2.8.4, and the project package includes Evidence preprocessors, SDK, universal-SQL, and component packages.[14][16][19] Svelte supplies a richer component lifecycle, but becomes the durable component model unless the visual is later rewritten.

The examined versions of both frameworks integrate DuckDB-WASM 1.29.0.[21][24] Observable documents direct client SQL over Parquet.[11] Evidence provides more source-extraction and generated-Parquet machinery, its strongest advantage for Pulse. That machinery also creates more failure surface: one issue documents large generated Parquet dominating a project's initial load, while another reproduces a non-root-base-path failure for valid expression-form `href` and `src` attributes.[19][20] A coding convention enforced by linting can mitigate the latter defect, but it remains unfixed.

No controlled, current performance comparison was found. Generated bundle size, WASM initialization, Parquet fetch behavior, time to first readable visual, and deep-link behavior remain pilot questions.

## Health and trajectory

| Signal | Observable Framework | Evidence Core |
| --- | --- | --- |
| Default-branch activity | 714 commits in 2024, 7 in 2025, 12 through 2026-Q2; 18 of 19 post-2024 commits came from one maintainer.[1] | 4,660 commits in 2024, 682 in 2025, 17 in 2026-Q1, then none on `main` through the access date.[2] |
| Release state | The last stable major or minor release with new features was 1.13.0 in November 2024; latest package 1.13.4 shipped 2026-03-02.[3] | Latest Core package 40.1.8 shipped 2026-02-06.[4] |
| Strategic direction | Observable emphasizes Canvases and Notebooks; Framework-specific Observable Cloud was deprecated.[5][6] Notebook Kit overlaps some Framework roles but remains a preview with no official replacement statement.[9] | A maintainer confirmed reduced Core focus while building Studio.[7] `next` is now one concrete reset commit, but has no release, public cadence, or default-branch status.[8] |
| Classification | Mature/quiet, highly concentrated, with organizational redirection. | Strategically redirected, with a concrete but unproven open-source reset. |

Taken together, the package-maintenance, support, repository, and strategy evidence favors Observable's present support posture slightly; repository activity alone is mixed. Evidence has the more interesting but riskier future signal.[1][2][3][4][7][8]

## Lock-in and failure modes

Both projects are permissively licensed and forkable, but either fork would inherit a compiler/runtime ecosystem rather than a small renderer.[16][23] As an engineering-cost judgment, freezing a known-good release while migrating is more credible than maintaining a long-lived fork.

Observable's lock-in concentrates in reactive Markdown, implicit imports, special protocols, generated `_import`/`_observablehq` paths, and convenience SQL registration.[13] These can remain in disposable page adapters.

Evidence's lock-in spans Evidence Markdown, Svelte preprocessing, `@evidence-dev/*` packages, source-to-Parquet commands, generated manifests, hashed path rewriting, and its generated SvelteKit template.[16][17][18] Parquet remains an excellent exit asset, but the framework-generated manifest should not become Pulse's only data contract.

## Verdict and overturning conditions

**Pick:** Observable Framework, provisionally. **Runner-up:** Evidence Core.

Maintenance risk and lock-in are multiplicative. Evidence's `next` branch could eventually become the healthier project, but choosing Evidence today also means accepting the broader framework-specific surface. Observable is safer for Pulse only if less of Pulse belongs to Observable.

Evidence becomes the better choice if Pulse deliberately adopts Svelte as its long-term visual model and values Evidence's packaged data machinery more than framework-neutral portability. It also wins if Evidence releases `next` as the default line, sustains several months of public commits and issue responsiveness, documents its Core/Studio contract, and materially modernizes the current coupling.

The strongest argument against Observable is that no stable release with new features has shipped since November 2024, post-2024 `main` activity is sparse and concentrated, and Observable's strategic attention moved elsewhere.[1][3][5][6] If Pulse cannot enforce the portable boundary, Observable's lower exit-cost argument collapses.

## Recommendations

1. **Run a bounded two-candidate pilot.** Use the same Parquet, one nontrivial interactive SVG, one nested report route, and the actual GitHub Pages repository subpath. Measure the time from a cold start to the first readable visual, WASM/query failure visibility, deep-link reload, keyboard behavior, artifact contents, and clean-clone reproducibility.
2. **Own the portable data seam.** Generate a Pulse manifest containing logical table name, schema version, content hash, relative Parquet URL, and visibility classification. Implement `dataClient.ts` with explicit DuckDB-WASM initialization, registration, parameterized queries, errors, and teardown.
3. **Keep visuals framework-neutral.** Visual modules accept plain data and return standard DOM/SVG. They import neither a visualization library nor Observable runtime globals or `@evidence-dev/*` packages. Framework pages only route, mount visuals, and bridge events.
4. **Include an exit drill.** Move the visual and `dataClient.ts` unchanged into a minimal Vite page. Reject any candidate whose framework-specific code has leaked into those modules.
5. **Make privacy structural.** Use separate public and private source roots, credentials, build jobs, and artifact scans. The public build must run without access to private data.
6. **If Observable passes, pin 1.13.4 and all resolved dependencies.** Ban unversioned implicit npm imports and treat generated paths as disposable.[3][13]
7. **If Evidence wins, adopt Svelte consciously.** Own the public manifest and enforce the base-path-safe `href`/`src` convention in CI.[14][17][19]
8. **Re-evaluate Evidence `next` if it is released before implementation begins.** It is too new to score as a maintained product now.[8]

## Open questions

- Which candidate produces the better production artifact and authoring workflow for the same purpose-built visual? Only the bounded pilot can answer this reliably.
- Will Evidence's `next` branch become a released, contribution-friendly Core line or remain an internal-source mirror?
- Does Observable intend Framework and Notebook Kit to coexist? No official statement was found.
- Can Pulse's data client remain framework-independent while preserving each candidate's useful caching and reactive-query behavior?

## Evidence appendix

### Source appendix

| Ref | Claim/finding supported | Publisher | Published / snapshot | Accessed | Confidence |
| --- | --- | --- | --- | --- | --- |
| [1] | Observable commit trajectory and concentration | [Observable GitHub](https://github.com/observablehq/framework/commits/main/) | 2026-08-18 snapshot | 2026-08-18 | High |
| [2] | Evidence `main` trajectory and concentration | [Evidence GitHub](https://github.com/evidence-dev/evidence/commits/main/) | 2026-08-18 snapshot | 2026-08-18 | High |
| [3] | Observable npm release timeline and 1.13.4 date | [npm registry](https://registry.npmjs.org/%40observablehq%2Fframework) | 2026-03-02 latest release | 2026-08-18 | High |
| [4] | Evidence npm release timeline and 40.1.8 date | [npm registry](https://registry.npmjs.org/%40evidence-dev%2Fevidence) | 2026-02-06 latest release | 2026-08-18 | High |
| [5] | Observable organizational roadmap emphasis | [Observable](https://observablehq.com/blog/observable-2025-year-in-review) | 2025-12-17 | 2026-08-18 | High for stated priorities; medium-high for inference |
| [6] | Observable Cloud deprecation | [Observable](https://observablehq.com/blog/announcing-observable-cloud) | Updated 2025-04-15 | 2026-08-18 | High |
| [7] | Evidence Core-to-Studio strategic shift | [Evidence maintainer discussion](https://github.com/evidence-dev/evidence/discussions/3177) | 2025-07-09 to 2026-06-09 | 2026-08-18 | High |
| [8] | Evidence `next` reset topology and intent | [Evidence initial import](https://github.com/evidence-dev/evidence/commit/2824f0cd17c92a91bc0a6c3f73efcc6f911ed217) | 2026-08-17 | 2026-08-18 | High |
| [9] | Notebook Kit role overlap and preview status | [Observable Notebook Kit](https://observablehq.com/notebook-kit/) | 2026-08-18 snapshot | 2026-08-18 | High for capabilities; bounded negative finding |
| [10] | Observable components and static build | [Observable getting started](https://observablehq.com/framework/getting-started) | v1.13.4 living docs | 2026-08-18 | High |
| [11] | Observable browser SQL over Parquet | [Observable SQL](https://observablehq.com/framework/sql) | v1.13.4 living docs | 2026-08-18 | High |
| [12] | Observable dataflow and invalidation semantics | [Observable reactivity](https://observablehq.com/framework/reactivity) | v1.13.4 living docs | 2026-08-18 | High |
| [13] | Observable import/runtime and generated-path lock-in | [Observable imports](https://observablehq.com/framework/imports) | v1.13.4 living docs | 2026-08-18 | High |
| [14] | Evidence custom Svelte component boundary | [Evidence custom components](https://docs.evidence.dev/components/custom/custom-component) | Living Core docs | 2026-08-18 | High |
| [15] | Evidence GitHub Pages/base-path deployment | [Evidence GitHub Pages](https://docs.evidence.dev/deployment/self-host/github-pages) | Living Core docs | 2026-08-18 | High |
| [16] | Evidence package/runtime stack | [Evidence package manifest](https://github.com/evidence-dev/evidence/blob/main/packages/evidence/package.json) | 40.1.8 snapshot | 2026-08-18 | High |
| [17] | Evidence source runner, generated manifest, and path rewriting | [Evidence CLI source](https://raw.githubusercontent.com/evidence-dev/evidence/main/packages/evidence/cli.js) | 2026-08-18 snapshot | 2026-08-18 | High |
| [18] | Evidence generated SvelteKit/Vite template coupling | [Evidence template build](https://raw.githubusercontent.com/evidence-dev/evidence/main/packages/evidence/scripts/build-template.js) | 2026-08-18 snapshot | 2026-08-18 | High |
| [19] | Evidence expression-form base-path defect | [Evidence issue #3303](https://github.com/evidence-dev/evidence/issues/3303) | 2026-05-05 | 2026-08-18 | High for reproduced Core 40.1.8 defect |
| [20] | Evidence DuckDB-WASM/Parquet path and performance risk | [Evidence issue #3301](https://github.com/evidence-dev/evidence/issues/3301) | 2026-04-23 | 2026-08-18 | High for architecture; low for generalizing timing |
| [21] | Observable Framework 1.13 DuckDB-WASM/runtime versions | [Observable releases](https://github.com/observablehq/framework/releases) | 2024-11 to 2026-03 | 2026-08-18 | High |
| [22] | Evidence real-project Playwright testing route | [Evidence E2E README](https://github.com/evidence-dev/evidence/tree/main/e2e) | 2026-08-18 snapshot | 2026-08-18 | High |
| [23] | Observable ISC license and forkable source surface | [Observable Framework repository](https://github.com/observablehq/framework) | 2026-08-18 snapshot | 2026-08-18 | High |
| [24] | Evidence root runtime dependency versions | [Evidence root package manifest](https://github.com/evidence-dev/evidence/blob/main/package.json) | 40.1.8 snapshot | 2026-08-18 | High |

### Staleness map

The claims ledger uses a one-month freshness window for version and compatibility claims, and a six-month window for ecosystem and performance signals.

| Claim class | Re-check | State on 2026-08-18 |
| --- | --- | --- |
| Observable 1.13.4 and Evidence 40.1.8 latest-version claims | Immediately before the pilot or adoption | The releases are already more than one month old, although live registry checks on 2026-08-18 confirmed that they remain the latest versions |
| Evidence base-path defect on Core 40.1.8 | Immediately before the pilot | Already beyond the one-month compatibility window; check for a fix or changed `next` implementation |
| Current component, DuckDB, and lock-in contracts | 2026-09-18 | Fresh |
| Evidence large-Parquet performance issue | 2026-10-23 | Fresh as a risk signal, not a benchmark |
| Repository trajectory and organizational direction | 2027-02-18 | Fresh; re-check Evidence sooner if `next` releases or becomes default |

The automated map's earliest re-check date is already past because the latest framework packages are old. Refresh the research immediately before pinning either dependency.
