# Observable Framework vs Evidence — current implementation reality (round 1)

## Scope and method

- Decision served: choose a report-site substrate for Pulse v1.
- Angle: current implementation reality only. Compared custom visual/component boundaries, arbitrary raw HTML/SVG/CSS, state and cross-visual interaction, client-side DuckDB-WASM over Parquet, static/base-path deployment, testing/debuggability, accessibility constraints, generated-site performance mechanics, and framework wrapping/chart-grammar friction.
- Hard gates supplied by the brief: fully static GitHub Pages output; client-side DuckDB-WASM over Parquet; arbitrary HTML/SVG/CSS and interactions without a visualization library; repository-first reproducibility; structural public/private separation must remain possible.
- Method: broad-first search, then contradiction/edge chasing in current official documentation, official repositories/releases, and a firsthand implementation issue. No project files were used as evidence. Only primary sources are cited. Source budget used: 8 distinct URLs; 10 web calls. Accessed 2026-08-18.
- Version posture: Observable's current documentation identifies Framework v1.13.4. Evidence's latest official umbrella release visible in the repository is `@evidence-dev/evidence@40.1.8`, released 2026-02-06. Neither release is within the requested one-month freshness bar, so version-sensitive conclusions are based on current living docs and current repository evidence as well as the latest tagged releases; this limitation lowers confidence where implementation could have changed without a new umbrella release.

## Findings

### Claim 1 — Both candidates generate static output suitable for GitHub Pages; neither fails the static-output gate

- **Claim:** Observable Framework builds a `dist` directory for upload to a static host and documents GitHub Pages deployment. Evidence documents direct GitHub Pages deployment of HTML/CSS/JavaScript build artifacts. Both therefore satisfy the fully static GitHub Pages gate in their documented default path.
- **Source:** [Getting started | Observable Framework](https://observablehq.com/framework/getting-started); [GitHub Pages | Evidence Docs](https://docs.evidence.dev/deployment/self-host/github-pages)
- **Publisher:** Observable, Inc.; Evidence
- **Publication/current-version date:** Observable living docs, undated, displaying v1.13.4 when accessed; Evidence living docs, undated
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** deployment / hard gate

### Claim 2 — Observable's custom visual boundary is a plain DOM-returning JavaScript function, with page-level reactive state outside the component

- **Claim:** In Observable Framework, a “component” is simply a function returning a DOM element, and shared components are ordinary local JavaScript modules. This permits raw DOM, HTML, SVG, and CSS without adopting a chart grammar or UI framework. The important boundary constraint is that only Markdown pages declare top-level reactive variables: components cannot define Framework reactive state, so state is passed in or implemented with ordinary DOM/module logic.
- **Source:** [Getting started | Observable Framework](https://observablehq.com/framework/getting-started); [Reactivity | Observable Framework](https://observablehq.com/framework/reactivity)
- **Publisher:** Observable, Inc.
- **Publication/current-version date:** living docs, undated, displaying v1.13.4 when accessed
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** component boundary / state / chart-grammar friction

### Claim 3 — Observable has a direct, documented browser DuckDB + Parquet path and makes dynamic SQL part of the page's reactive graph

- **Claim:** Observable Framework explicitly documents client-side SQL powered by DuckDB, registering local or remote Parquet files as tables, returning Arrow tables, and interpolating reactive input values into SQL. This is a first-class match for the client-side DuckDB-WASM-over-Parquet gate, even though the SQL page says “DuckDB” rather than spelling out “WASM” in its opening sentence; the Framework import documentation elsewhere names `@duckdb/duckdb-wasm`, and a maintainer describes the documented SQL example as client-side only.
- **Source:** [SQL | Observable Framework](https://observablehq.com/framework/sql)
- **Publisher:** Observable, Inc.
- **Publication/current-version date:** living docs, undated, displaying v1.13.4 when accessed
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** version/compatibility / hard gate / integration

### Claim 4 — Observable offers strong cross-visual coordination but imposes an Observable dataflow model at the page boundary

- **Claim:** Framework reruns only code blocks downstream of changed variables, supports inputs made from arbitrary HTML if they expose `.value` and emit `input`, and can treat a custom interactive visual as an input. This makes coordinated views straightforward without a visualization library. Friction appears when code needs local mutable component state or conventional top-down execution: Framework's cross-block evaluation is topological, not document order, while standalone modules are outside the page's reactive graph unless they expose generators/functions.
- **Source:** [Reactivity | Observable Framework](https://observablehq.com/framework/reactivity)
- **Publisher:** Observable, Inc.
- **Publication/current-version date:** living docs, undated, displaying v1.13.4 when accessed
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** interaction / state / implementation reality

### Claim 5 — Observable's build/runtime mechanics favor selective static assets and incremental rendering; testability is deliberately ordinary JavaScript

- **Claim:** Observable statically analyzes literal `FileAttachment` references so only referenced files/loaders are included, produces static build output, and incrementally reruns downstream blocks rather than the page. Shared JavaScript modules are explicitly recommended for reuse, unit tests, and linters. One notable debug/safety constraint is that Framework transpiles TypeScript but does not type-check during preview or build; teams must run `tsc` separately.
- **Source:** [Getting started | Observable Framework](https://observablehq.com/framework/getting-started); [Reactivity | Observable Framework](https://observablehq.com/framework/reactivity)
- **Publisher:** Observable, Inc.
- **Publication/current-version date:** living docs, undated, displaying v1.13.4 when accessed
- **Accessed:** 2026-08-18
- **Confidence:** high for selective assets/reactivity/module testing; medium for the TypeScript caveat because the type-check statement is on the current JavaScript reference page but not separately retained within the eight-source appendix
- **Class:** performance mechanics / testing / debuggability

### Claim 6 — Evidence's escape hatch is a real Svelte component, not an Evidence chart grammar, but it is a heavier framework boundary than Observable's function contract

- **Claim:** Evidence custom components are `.svelte` files discovered in a root `components/` directory. The docs say they may be built completely from scratch, use Svelte (HTML plus Svelte features), accept data as props, and can import Evidence components only when wanted. Thus arbitrary HTML/SVG/CSS and interactions can bypass Evidence's ECharts-oriented built-ins. The cost is a mandatory Svelte component/compiler boundary for reusable arbitrary visuals, plus explicit prop/export conventions; raw custom components do not support Markdown internally.
- **Source:** [Custom Components | Evidence Docs](https://docs.evidence.dev/components/custom/custom-component)
- **Publisher:** Evidence
- **Publication/current-version date:** living docs, undated
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** component boundary / chart-grammar friction / hard gate

### Claim 7 — Evidence's page grammar is report-first and SQL/component-oriented; cross-visual filters are first-class, while arbitrary coordination moves into Svelte

- **Claim:** Evidence's documented page-level coordination uses named input components, a global `inputs` object, and SQL interpolation; when an input changes, dependent query data and charts update. This is concise for dashboard filters shared across visuals. Compared with Observable's arbitrary reactive JavaScript cells, the public page authoring surface is more grammar-driven (named inputs, SQL fences, component props). Interactions that are not expressible as Evidence inputs/filters remain possible, but belong in custom Svelte components and must be wired through Svelte props/events/stores rather than Evidence's chart grammar.
- **Source:** [Filters | Evidence Docs](https://docs.evidence.dev/core-concepts/filters); [Custom Components | Evidence Docs](https://docs.evidence.dev/components/custom/custom-component)
- **Publisher:** Evidence
- **Publication/current-version date:** living docs, undated
- **Accessed:** 2026-08-18
- **Confidence:** high for documented filter coordination; medium for the characterization of nonstandard coordination because the docs do not publish a complete state-boundary contract
- **Class:** interaction / state / implementation reality

### Claim 8 — Evidence also uses browser DuckDB-WASM over generated Parquet, but large generated Parquet can dominate initial load

- **Claim:** Current repository evidence describes Evidence's generated Parquet cache as consumed by DuckDB-WASM both during SSR and at runtime in the browser. The same report records an approximately 10-second initial dashboard load in one Evidence project, dominated by fetching and scanning large Parquet files, and identifies current writer defaults (ZSTD plus otherwise default row-group/page-index properties) as an optimization opportunity. This confirms the required runtime architecture and surfaces a real performance risk, but the 10-second figure is one user's workload, not a general benchmark.
- **Source:** [Optimize parquet writer output for duckdb-wasm in `buildMultipartParquet` — evidence-dev/evidence issue #3301](https://github.com/evidence-dev/evidence/issues/3301)
- **Publisher:** Evidence GitHub repository; firsthand issue by jameswinegar
- **Publication/current-version date:** opened 2026-04-23; still open when accessed
- **Accessed:** 2026-08-18
- **Confidence:** high that browser DuckDB-WASM consumes generated Parquet; medium for the performance implication; low for generalizing the reported 10-second load
- **Class:** architecture / performance / implementation reality

### Claim 9 — Evidence passes GitHub Pages base-path deployment, with concrete custom-component and preprocessing sharp edges

- **Claim:** Evidence documents repository-subpath deployment by setting both `deployment.basePath` and a matching nested build directory. Its base-path docs state that links inside custom components are not automatically adjusted and must use `addBasePath`. A current open issue also reports that the base-path preprocessor can mangle Svelte expression-form `href`/`src` attributes; because that issue was found in the current issue list but not retained as one of the eight cited URLs, treat the specific bug as a round-2 lead rather than a verified deciding claim.
- **Source:** [GitHub Pages | Evidence Docs](https://docs.evidence.dev/deployment/self-host/github-pages)
- **Publisher:** Evidence
- **Publication/current-version date:** living docs, undated
- **Accessed:** 2026-08-18
- **Confidence:** high for documented deployment; medium for custom-component link handling because the detailed `addBasePath` wording lives on the companion Base Paths page; unverified for the current preprocessor bug until issue #3303 is read directly
- **Class:** deployment / base path / implementation risk

### Claim 10 — Evidence's tagged umbrella release is stale against the requested one-month version bar

- **Claim:** The official releases page identifies `@evidence-dev/evidence@40.1.8` as the latest umbrella release dated 2026-02-06, while component packages have later same-day releases on the page and the repository has continued issue activity in 2026. Therefore current docs may describe main-branch/current-site behavior newer than the last umbrella tag, and exact package compatibility should be rechecked from registry metadata or a lockfile before implementation.
- **Source:** [Releases | evidence-dev/evidence](https://github.com/evidence-dev/evidence/releases)
- **Publisher:** Evidence GitHub repository
- **Publication/current-version date:** 2026-02-06 for `@evidence-dev/evidence@40.1.8`
- **Accessed:** 2026-08-18
- **Confidence:** high for the release date/version; medium for the docs-versus-tag interpretation
- **Class:** version/compatibility / freshness

### Claim 11 — Neither framework supplies an accessibility guarantee for arbitrary custom SVG/HTML; custom visual semantics remain application work

- **Claim:** Both substrates allow developers to emit arbitrary DOM/SVG, which preserves the ability to implement semantic HTML, ARIA, keyboard interaction, focus behavior, reduced motion, and nonvisual equivalents. In the official candidate-specific material inspected, no end-to-end accessibility contract, audit mode, or guarantee was found for arbitrary custom visuals. Evidence's Svelte basis may provide compiler accessibility warnings, but that was not counted as candidate-specific evidence in this round; Observable's raw DOM/function model likewise provides control rather than enforcement. Accessibility is therefore not a hard-gate failure for either candidate, but neither can be credited with framework-enforced conformance from the evidence gathered.
- **Source:** [Custom Components | Evidence Docs](https://docs.evidence.dev/components/custom/custom-component); [Getting started | Observable Framework](https://observablehq.com/framework/getting-started)
- **Publisher:** Evidence; Observable, Inc.
- **Publication/current-version date:** living docs, undated; Observable docs display v1.13.4
- **Accessed:** 2026-08-18
- **Confidence:** medium (positive control is documented; absence of a guarantee is bounded to the inspected official material)
- **Class:** accessibility / implementation constraint

### Claim 12 — Repository-first reproducibility is native to both, but public/private separation is an architecture responsibility rather than a built-in classification feature

- **Claim:** Both candidates are file/repository-oriented static-site generators with explicit build directories and CI-friendly GitHub Pages deployment. Nothing found requires a hosted authoring service. Structural public/private separation remains possible by placing public and private report sources/data in separate projects/build roots or pipelines and publishing only the public artifact. No official source inspected describes a native page-level public/private classification that can safely redact a single build, so the boundary should be structural and verified at artifact level rather than entrusted to front matter or runtime hiding.
- **Source:** [Getting started | Observable Framework](https://observablehq.com/framework/getting-started); [GitHub Pages | Evidence Docs](https://docs.evidence.dev/deployment/self-host/github-pages)
- **Publisher:** Observable, Inc.; Evidence
- **Publication/current-version date:** living docs, undated; Observable docs display v1.13.4
- **Accessed:** 2026-08-18
- **Confidence:** high for repository/static build properties; medium for the separation implementation because separate-project composition is an architectural inference, not a named candidate feature
- **Class:** reproducibility / security boundary / hard gate

## Hard-gate screen

| Hard gate | Observable Framework | Evidence | Failure? |
|---|---|---|---|
| Fully static GitHub Pages output | Documented `dist` build and GitHub Pages path | Documented GitHub Pages workflow and static build artifacts | Neither fails |
| Client-side DuckDB-WASM over Parquet | First-class client SQL; Parquet table registration; reactive queries | Current architecture uses DuckDB-WASM in browser over generated Parquet | Neither fails; Evidence has a documented open performance concern on large Parquet |
| Arbitrary HTML/SVG/CSS and interactions without a visualization library | Plain DOM-returning JS functions; arbitrary HTML inputs; no chart library required | Scratch Svelte components can emit arbitrary markup/style/behavior; built-in charts optional | Neither fails; Evidence imposes Svelte `.svelte` boundary |
| Repository-first reproducibility | Source files, modules, loaders, lockable npm dependencies, static build | Markdown/SQL/Svelte files, source configuration, npm packages, static build | Neither fails |
| Structural public/private separation remains possible | Possible through distinct source roots/projects/build pipelines; no native classification found | Possible through distinct projects/build pipelines; no native classification found | Neither fails, provided separation is structural and artifact-tested |

**Hard-gate result:** no hard-gate failure found for either candidate in round 1. Evidence's client-side Parquet path is confirmed through current repository implementation evidence rather than a clear candidate-docs architecture page; this should be independently pinned to exact package versions in round 2.

## Comparative implementation summary (not an overall winner)

| Dimension | Observable Framework | Evidence |
|---|---|---|
| Custom boundary | Plain JS function returning DOM; ordinary modules | Svelte component in `/components`, props/exports |
| Raw HTML/SVG/CSS | Direct DOM or HTML/SVG templates; minimal wrapping | Full Svelte markup/style/script; reusable raw visuals require Svelte boundary |
| State and coordination | Page-level dataflow; arbitrary input protocol; incremental downstream rerun; component-local Framework state not available | Named inputs + global `inputs` + dynamic SQL are concise; unconventional coordination shifts into Svelte state/events |
| DuckDB/Parquet | Explicit first-class client SQL over Parquet | DuckDB-WASM reads generated Parquet in browser; source build writes runtime cache |
| Static/base path | Static `dist`; GitHub Pages documented; clean-URL host caveat | Static GitHub Pages documented; must align basePath and build directory; custom links need care |
| Testing/debuggability | Ordinary modules explicitly support tests/linters; live preview; separate `tsc` required | SQL/query preview and Svelte component boundary are inspectable; no candidate-specific custom-component test recipe found |
| Accessibility | Developer-controlled raw DOM; no candidate-specific conformance guarantee found | Developer-controlled Svelte DOM; possible compiler help not verified as Evidence build policy; no Evidence conformance guarantee found |
| Performance mechanics | Static snapshots, selective referenced assets, incremental reactive reruns | Static generation plus browser query cache; current Parquet writer/layout can make initial fetch/scan dominant |
| Chart-grammar friction | None required; Observable dataflow semantics are the main framework constraint | Built-in declarative chart grammar is optional, but escaping it means Svelte components and associated prop/event conventions |

## Contradictions and reconciliations

1. **“Static site” versus runtime database work.** Both are static in hosting/deployment terms while still shipping JavaScript, WASM, and data files that execute queries in the browser. “Static” must not be interpreted as “no client computation.”
2. **Evidence appears SQL-build-oriented, yet runtime DuckDB-WASM is real.** The user-facing docs emphasize SQL Markdown and static builds, while current repository evidence says generated Parquet is consumed by DuckDB-WASM at SSR and browser runtime. These are compatible: upstream/source extraction happens at build time; page/filter queries can execute against the shipped cache at runtime.
3. **Observable advertises vanilla JavaScript, but page JavaScript is not conventional module execution.** Components are ordinary JS functions, yet top-level page cells run under Observable's dependency graph and only pages own Framework reactive state. The “vanilla” claim concerns syntax/APIs, not execution order.
4. **Evidence's built-in chart grammar does not imply lock-in to ECharts.** The default authoring path is strongly component/prop driven, but official custom-component docs allow complete Svelte implementations from scratch. The real friction is the Svelte boundary, not inability.
5. **Evidence's GitHub Pages support versus base-path caveats.** Official deployment support is explicit, but custom components must participate correctly in base-path handling, and a current issue lead suggests expression-form attribute preprocessing may still be fragile. Support is real; zero-friction subpath behavior is not established.

## Leads for round 2

1. Read and reproduce Evidence issue #3303 (`addBasePathToHrefAndSrc` mangling expression-form attributes) against `@evidence-dev/evidence@40.1.8` and current main; decide whether it affects any planned custom components.
2. Pin exact versions of `@duckdb/duckdb-wasm`, `@observablehq/duckdb`, `@evidence-dev/universal-sql`, and Evidence's Parquet writer from current package manifests/registry metadata; the umbrella releases are older than the one-month freshness bar.
3. Build minimal proof sites for each candidate on a GitHub Pages project subpath, including nested routes, workers/WASM, one local Parquet file, a custom SVG input, and offline/no-CDN verification.
4. Measure generated artifact composition: JS/WASM bootstrap, Parquet bytes fetched before first render, range-request behavior, query latency, duplicate data across pages, and cache headers. Use identical Parquet and identical visuals.
5. Test public/private separation by producing a public artifact and mechanically scanning it for private filenames, strings, source connection metadata, query text, and unreferenced data.
6. Inspect official source/tests for hydration behavior and custom-component lifecycle: teardown, event listener cleanup, navigation, resize, and multiple copies of the same visual.
7. Run axe plus keyboard/screen-reader checks on equivalent hand-authored SVG in both proof sites; verify whether Evidence's actual build surfaces Svelte a11y compiler warnings and whether Observable templates preserve expected roles/titles/descriptions.
8. Compare debugging ergonomics firsthand: source maps, stack traces from page cells versus `.svelte` components, query inspection, HMR behavior, and unit-test harness setup.

## What I sought but could not find

- A current, official Evidence architecture page plainly specifying exact browser DuckDB-WASM and Parquet package versions. Current repository evidence confirms the architecture, but exact compatibility remains unpinned.
- Candidate-specific official accessibility guarantees, audit tooling, or WCAG conformance statements for arbitrary custom visuals.
- An official Evidence guide for unit-testing project-local custom Svelte components, or an official comparison of source maps/debugging for those components.
- Current controlled benchmarks comparing generated site size, first render, Parquet fetch behavior, or interactive query latency across Observable Framework and Evidence. The Evidence 10-second report is a single firsthand workload, not a benchmark.
- A first-class public/private content classifier in either framework. I found no basis to trust a single mixed build as a security boundary.
- Fresh (within one month) tagged releases for either umbrella framework. Observable docs show v1.13.4; Evidence's latest umbrella tag found is 40.1.8 from 2026-02-06.

## Source set (8 distinct URLs)

1. Observable, [Getting started | Observable Framework](https://observablehq.com/framework/getting-started), living docs, accessed 2026-08-18.
2. Observable, [Reactivity | Observable Framework](https://observablehq.com/framework/reactivity), living docs, accessed 2026-08-18.
3. Observable, [SQL | Observable Framework](https://observablehq.com/framework/sql), living docs, accessed 2026-08-18.
4. Evidence, [Custom Components | Evidence Docs](https://docs.evidence.dev/components/custom/custom-component), living docs, accessed 2026-08-18.
5. Evidence, [Filters | Evidence Docs](https://docs.evidence.dev/core-concepts/filters), living docs, accessed 2026-08-18.
6. Evidence, [GitHub Pages | Evidence Docs](https://docs.evidence.dev/deployment/self-host/github-pages), living docs, accessed 2026-08-18.
7. Evidence GitHub repository, [issue #3301: Optimize parquet writer output for duckdb-wasm](https://github.com/evidence-dev/evidence/issues/3301), opened 2026-04-23, accessed 2026-08-18.
8. Evidence GitHub repository, [Releases](https://github.com/evidence-dev/evidence/releases), latest umbrella release observed 2026-02-06, accessed 2026-08-18.
