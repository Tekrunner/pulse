# Observable Framework vs Evidence — current implementation reality (round 2)

## Scope and method

- Decision served: choose a report-site substrate for Pulse v1.
- Follow-up scope only: exact current runtime/dependency versions and recency; Evidence base-path issue #3303 and exposure of custom SVG on GitHub Pages; lifecycle/testing boundaries; whether current Evidence docs describe Core 40.1.8 or have drifted toward Evidence Studio.
- Research firewall: no project files or ambient project context were inspected. Evidence came only from current official manifests, official releases/docs/source-test surfaces, npm package metadata, and a firsthand issue with a complete reproduction.
- Method: broad search, then direct inspection of official manifests, issue reproduction/system information, official E2E instructions, and the docs-to-repository linkage. No packages were built or installed.
- Budget: eight retained decision sources. Approximately ten broad/direct web operations were planned; a few direct GitHub paths returned cache misses and were replaced by the issue's quoted source/test evidence and browsable repository pages.
- Accessed: 2026-08-18.

## Findings

### Claim 1 — The current built-in DuckDB-WASM generation is exactly 1.29.0 in both candidates

- **Claim:** Observable Framework v1.13 introduced built-in DuckDB-WASM 1.29.0 aligned to DuckDB 1.1.1 and Observable Runtime 6.0.0; the current v1.13.4 manifest still depends on `@observablehq/runtime ^6.0.0`. Evidence's current monorepo manifest pins `@duckdb/duckdb-wasm` to exactly 1.29.0. For the required built-in browser SQL path, the candidates therefore start from the same DuckDB-WASM generation rather than Evidence being materially newer or older.
- **Source:** [Releases | observablehq/framework](https://github.com/observablehq/framework/releases); [package.json | observablehq/framework](https://github.com/observablehq/framework/blob/main/package.json); [package.json | evidence-dev/evidence](https://github.com/evidence-dev/evidence/blob/main/package.json)
- **Publisher:** Observable, Inc.; Evidence
- **Publication/current-version date:** Observable v1.13.4 released 2026-03-02; current manifests on `main` accessed 2026-08-18; Evidence Core 40.1.8 was the installed version in the May 2026 reproduction below
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** version/compatibility / hard-gate integration

### Claim 2 — Both umbrella framework releases are outside the one-month freshness bar

- **Claim:** Read-only npm registry metadata returns Observable Framework 1.13.4 published 2026-03-02T21:48:49.487Z and Evidence Core 40.1.8 published 2026-02-06T16:07:30.925Z. Both are more than five months old on the access date and fail the technical pack's requested one-month freshness bar for versions/compatibility. Current manifests and a May 2026 Core reproduction corroborate the installed version stacks, but neither candidate has a fresh umbrella release to absorb later upstream runtime changes.
- **Source:** [Releases | observablehq/framework](https://github.com/observablehq/framework/releases); [@evidence-dev/evidence | npm](https://www.npmjs.com/package/%40evidence-dev/evidence); [package.json | evidence-dev/evidence](https://github.com/evidence-dev/evidence/blob/main/package.json)
- **Publisher:** Observable, Inc.; Evidence/npm
- **Publication/current-version date:** Observable 1.13.4 published 2026-03-02; Evidence Core 40.1.8 published 2026-02-06
- **Accessed:** 2026-08-18
- **Confidence:** high for package versions/recency; medium for future maintenance implications
- **Class:** version/compatibility / freshness

### Claim 3 — Observable's current runtime/tooling versions are lean and loosely ranged, not a UI framework stack

- **Claim:** Framework's current manifest is v1.13.4 and specifies `@observablehq/runtime ^6.0.0`; its application runtime does not require Svelte, SvelteKit, or Vite. The build tool itself currently uses esbuild `^0.27.3`, Rollup `^4.6.0`, and TypeScript `^5.2.2 <5.6.0`. The caret ranges mean an installed lockfile determines the precise patch for several dependencies; the manifest alone guarantees the major/minor floor, not a single resolved patch.
- **Source:** [package.json | observablehq/framework](https://github.com/observablehq/framework/blob/main/package.json)
- **Publisher:** Observable, Inc.
- **Publication/current-version date:** current `main`, package version 1.13.4; latest tagged release 2026-03-02
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** version/compatibility / implementation footprint

### Claim 4 — Evidence Core 40.1.8 is pinned to an older, exact Svelte 4/SvelteKit 2/Vite 5 stack

- **Claim:** Evidence's current monorepo manifest pins `@duckdb/duckdb-wasm` 1.29.0, Svelte 4.2.19, SvelteKit 2.8.4, Vite 5.4.21, adapter-static 3.0.1, TypeScript 5.4.2, and the root development copy of `@sveltejs/vite-plugin-svelte` 3.0.2. Issue #3303's system information confirms an actual Core 40.1.8 project resolves Svelte 4.2.19 and SvelteKit 2.8.4. The stack is exact and reproducible, but several major lines are behind current upstream (Svelte 5 and much newer SvelteKit 2 releases exist), increasing framework-coupling and eventual upgrade cost relative to Observable's plain-DOM component boundary.
- **Source:** [package.json | evidence-dev/evidence](https://github.com/evidence-dev/evidence/blob/main/package.json); [issue #3303 | evidence-dev/evidence](https://github.com/evidence-dev/evidence/issues/3303)
- **Publisher:** Evidence; firsthand reproduction by Etumos
- **Publication/current-version date:** current `main` accessed 2026-08-18; issue opened 2026-05-05 against `@evidence-dev/evidence` 40.1.8
- **Accessed:** 2026-08-18
- **Confidence:** high for exact versions; medium for upgrade-cost implication
- **Class:** version/compatibility / framework coupling

### Claim 5 — Evidence issue #3303 is a real Core 40.1.8 GitHub Pages subpath risk, but only for expression-form `href`/`src`

- **Claim:** With `deployment.basePath` configured, Evidence Core 40.1.8's `addBasePathToHrefAndSrc` preprocessor treats unquoted Svelte expression attributes such as `href={somePath}` or `src={somePath}` as literals beginning with `{`, producing malformed markup and SvelteKit prerender 500s. The issue quotes the responsible regex and notes that the official spec covers quoted, single-quoted, and unquoted literal attributes but not expression-form attributes. The reporter's workaround—quoted interpolation such as `href="{somePath}"` plus a CI lint—is explicit and successful. The issue remained open with no linked fix when accessed.
- **Source:** [issue #3303: `addBasePathToHrefAndSrc` mangles expression-form attributes | evidence-dev/evidence](https://github.com/evidence-dev/evidence/issues/3303)
- **Publisher:** Evidence GitHub repository; firsthand reproduction by Etumos
- **Publication/current-version date:** opened 2026-05-05 against Core 40.1.8, SDK 4.0.2, preprocess 6.0.7
- **Accessed:** 2026-08-18
- **Confidence:** high for reproduction and affected versions; medium that current unreleased `main` is still affected because the direct source path was not retrievable and no maintainer resolution is recorded
- **Class:** defect / base-path compatibility / hard-gate risk

### Claim 6 — Custom SVG is materially exposed only when it contains dynamic `href` or `src`; ordinary SVG drawing and interaction are unaffected

- **Claim:** Because the failing preprocessor targets `href=` and `src=` attributes in Svelte markup, a custom SVG using `<path>`, `<circle>`, `<rect>`, styles, ARIA, event handlers, or static references is outside the demonstrated failure. Exposure arises for constructs such as dynamic SVG `<use href={...}>`, `<image href={...}>`, linked SVG content, or neighboring dynamic `<img src={...}>` when a non-root base path is enabled. The failure occurs during static prerender and should fail a strict GitHub Pages build rather than silently corrupt a successfully generated artifact. This is a material convention/lint burden for Evidence custom components, but the narrow trigger and documented workaround prevent it from becoming a hard-gate failure.
- **Source:** [issue #3303 | evidence-dev/evidence](https://github.com/evidence-dev/evidence/issues/3303)
- **Publisher:** Evidence GitHub repository; firsthand reproduction by Etumos
- **Publication/current-version date:** 2026-05-05
- **Accessed:** 2026-08-18
- **Confidence:** high for affected attribute forms; medium for the SVG element extrapolation because the reproduction uses HTML `<a>`/`<img>`, while the regex is markup-wide
- **Class:** custom component / deployment / implementation fit

### Claim 7 — Observable DOM components have an explicit page-cell disposal hook, but reusable component cleanup is caller-owned

- **Claim:** Observable's reactive page cells can rerun repeatedly and expose an `invalidation` promise for cancelling animation frames, timers, sockets, and similar resources. A reusable component is still an ordinary DOM-returning function: Framework does not inject component-level mount/unmount methods into that function. Therefore a stateful component should either accept/pass the page cell's invalidation signal, return an explicit disposer, or keep side effects in the calling cell. This boundary is simple to unit-test as JavaScript, but cleanup discipline is explicit rather than framework-owned.
- **Source:** [Reactivity | Observable Framework](https://observablehq.com/framework/reactivity); [package.json | observablehq/framework](https://github.com/observablehq/framework/blob/main/package.json)
- **Publisher:** Observable, Inc.
- **Publication/current-version date:** living docs for v1.13.4; current package manifest
- **Accessed:** 2026-08-18
- **Confidence:** high for cell invalidation; medium for the recommended component patterns because they are an implementation inference from the published boundary
- **Class:** lifecycle / testing boundary

### Claim 8 — Observable's own tests do not become a project test scaffold

- **Claim:** The Framework repository itself runs Mocha, TypeScript checks, ESLint, Prettier, jsdom-based tests, and per-file coverage. That proves the generated DOM/runtime is testable with ordinary JavaScript tooling, but those scripts test Framework itself. No candidate-supplied project-local component test harness was found in this pass. For report projects, the practical boundary remains separately testable JavaScript modules plus a team-selected DOM/browser runner.
- **Source:** [package.json | observablehq/framework](https://github.com/observablehq/framework/blob/main/package.json)
- **Publisher:** Observable, Inc.
- **Publication/current-version date:** current `main`, package version 1.13.4
- **Accessed:** 2026-08-18
- **Confidence:** high for repository test stack; medium for absence of a project scaffold, bounded to inspected official material
- **Class:** testing / debuggability

### Claim 9 — Evidence has a documented real-project E2E route, but its template's default “test” is only a build

- **Claim:** Evidence's official E2E README says its tests create real projects from the public Evidence template and use Playwright in both dev and built-preview modes. Its setup instructions explicitly replace the template's default `"test": "evidence build"` script with `test:dev` and `test:preview` Playwright commands. Thus Evidence provides a credible integration-test recipe for project-local Svelte components, routing, hydration, and base paths, but users must add it; no preconfigured unit/component-test harness ships in the normal project template.
- **Source:** [E2E README | evidence-dev/evidence](https://github.com/evidence-dev/evidence/tree/main/e2e)
- **Publisher:** Evidence
- **Publication/current-version date:** current `main` accessed 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** testing / lifecycle verification

### Claim 10 — Evidence project-local component lifecycle is richer but more framework-coupled than Observable's DOM function boundary

- **Claim:** Evidence project-local components compile as Svelte 4.2.19 inside SvelteKit 2.8.4, so Svelte owns component creation, reactive updates, and teardown at route/component boundaries; lifecycle hooks and component tests must run through the Svelte compiler/runtime rather than as dependency-free DOM functions. Evidence's official E2E harness is therefore the most directly supported way found to catch integration lifecycle problems. This is a trade: less hand-managed mount/unmount wiring inside components, but a larger and older framework surface to reproduce in unit tests.
- **Source:** [package.json | evidence-dev/evidence](https://github.com/evidence-dev/evidence/blob/main/package.json); [E2E README | evidence-dev/evidence](https://github.com/evidence-dev/evidence/tree/main/e2e)
- **Publisher:** Evidence
- **Publication/current-version date:** current `main` accessed 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high for runtime/test boundary; medium for comparative testing cost
- **Class:** lifecycle / testing / framework coupling

### Claim 11 — Current Evidence docs still describe Core, with Studio promoted as a separate product; no deciding-cell syntax drift toward Studio was found

- **Claim:** The current docs homepage calls Evidence an open-source SQL/Markdown framework, enumerates Core concepts/components/deployment, states that the docs site itself is an Evidence app, and separately labels Evidence Studio as an introduced linked product. Its “Edit page” destination targets `evidence-dev/evidence`, not the minimal `evidence-studio-template` repository. More importantly, issue #3303 reproduces the docs' `deployment.basePath` and Svelte-expression syntax on Core 40.1.8. The deciding docs used in round 1 therefore apply to Core rather than being Studio-only syntax.
- **Source:** [What is Evidence? | Evidence Docs](https://docs.evidence.dev/); [issue #3303 | evidence-dev/evidence](https://github.com/evidence-dev/evidence/issues/3303)
- **Publisher:** Evidence
- **Publication/current-version date:** living docs accessed 2026-08-18; issue opened 2026-05-05 against Core 40.1.8
- **Accessed:** 2026-08-18
- **Confidence:** high for product separation and deciding syntax; medium for complete page-by-page version fidelity
- **Class:** documentation applicability / version compatibility

### Claim 12 — Documentation-version drift remains a real but bounded Evidence risk

- **Claim:** Although the deciding syntax is Core-compatible, the docs' edit link targets an `evidence-dev/evidence` `next`-branch path, while the retrievable published package remains Core 40.1.8 and the repository/Studio surfaces continue evolving. The exact docs commit or package-version selector was not exposed. Consequently, nontrivial snippets should still be verified against the pinned 40.1.8 artifact or its source before adoption; this caveat does not overturn the specific custom-component, filter, static build, or base-path claims verified against current Core evidence.
- **Source:** [What is Evidence? | Evidence Docs](https://docs.evidence.dev/); [issue #3303 | evidence-dev/evidence](https://github.com/evidence-dev/evidence/issues/3303); [package.json | evidence-dev/evidence](https://github.com/evidence-dev/evidence/blob/main/package.json)
- **Publisher:** Evidence
- **Publication/current-version date:** living docs/current `main`; Core 40.1.8 reproduction dated 2026-05-05
- **Accessed:** 2026-08-18
- **Confidence:** medium
- **Class:** documentation drift / implementation risk

## Hard-gate and implementation-fit delta from round 1

### Hard gates

- **No hard-gate conclusion changes.** Both still satisfy static GitHub Pages output, client DuckDB-WASM over Parquet, arbitrary custom HTML/SVG/CSS/interaction, repository-first reproducibility, and the possibility of structural public/private separation.
- Evidence issue #3303 does **not** create a hard failure. It is conditional on a configured non-root base path plus unquoted expression-form `href`/`src`; a documented syntactic workaround exists, and a production static build should expose the failure.
- The DuckDB-WASM gate remains a pass, but it is now precisely a **1.29.0** gate for both integrated paths. Claims based on later DuckDB-WASM or native DuckDB behavior cannot be assumed.

### Implementation fit

- **Observable:** round 2 strengthens the “thin custom boundary” conclusion. Lifecycle cleanup is explicit through cell invalidation/caller ownership; modules are ordinary JavaScript, but a report project must choose its own component test runner.
- **Evidence:** round 2 increases the implementation-friction assessment slightly. Core is coupled to exact older Svelte/SvelteKit/Vite versions, dynamic `href`/`src` requires a base-path-safe convention, and the normal template does not ship a component-test harness. Evidence partly offsets this with framework-owned Svelte lifecycle and an official Playwright recipe for real Evidence projects.
- **Docs:** round 2 removes the concern that the deciding Evidence documentation is secretly Studio-only. The docs promote Studio separately and the base-path/Svelte syntax is reproduced on Core 40.1.8. Version drift still warrants pin-and-verify discipline.

## Contradictions and reconciliations

1. **“Current docs” versus old embedded engines.** Both sites are current, but both integrated DuckDB-WASM paths are 1.29.0 while npm's active line is 1.33.1 development builds. Current documentation does not imply current upstream engine internals.
2. **Evidence `main` versus published Core.** The monorepo manifest and a real Core 40.1.8 reproduction agree on Svelte 4.2.19/SvelteKit 2.8.4; this consistency reduces, but does not eliminate, docs/main/tag drift risk.
3. **Evidence base-path support versus a build-breaking preprocessor bug.** GitHub Pages subpaths are supported, but one valid Svelte attribute form is not. Support remains real when a quoting convention/lint is enforced.
4. **Framework lifecycle simplicity versus automatic cleanup.** Observable components are plain functions, but plain functions do not receive component lifecycle automatically. Evidence components have Svelte lifecycle semantics, at the cost of testing/compiler coupling.
5. **Evidence docs versus Studio.** Studio is prominent marketing on the docs homepage, yet the docs navigation, repository edit target, and reproduced syntax remain Core-oriented. Promotion is not evidence of syntax replacement.

## Leads for implementation proof / later verification

1. Pin a lockfile for both candidates and record the actually resolved `@observablehq/runtime` patch plus transitive DuckDB-WASM/Arrow assets; manifests alone contain ranges on the Observable side.
2. For Evidence, add a repository lint banning `href={...}` and `src={...}` in `.svelte`/Markdown markup when `deployment.basePath` is non-root; require quoted interpolation or the documented base-path helper.
3. Add an SVG-specific Evidence fixture using `<use href={...}>`, `<image href={...}>`, nested links, and fragment URLs; run both dev and prerendered GitHub Pages paths.
4. Add lifecycle probes to identical custom visuals: animation frame, global event listener, ResizeObserver, Web Worker/DuckDB connection, and route navigation. Verify disposal with browser instrumentation.
5. Use a small unit suite around Observable's pure DOM functions and a Svelte-aware unit suite around Evidence components, plus the same Playwright black-box acceptance suite for both.
6. Record the exact docs commit used for Evidence or vendor the required pages/behaviors into architecture tests; the live site does not expose a simple Core-version selector.

## What I sought but could not find

- A directly browsable current source and spec file for `addBasePathToHrefAndSrc`; the direct GitHub paths cache-missed. Issue #3303 quotes the exact regex, missing test case, versions, reproduction, and workaround, but no maintainer confirmation or merged fix was present.
- A preconfigured project-local unit/component testing setup in either normal starter. Observable documents/test-drives ordinary modules internally; Evidence documents Playwright E2E setup, but both leave project unit-test selection to the team.
- An Evidence docs version selector or explicit banner saying “applies to Core 40.1.8.” Applicability was triangulated from the Core-oriented docs tree, repository edit destination, manifest, and a 40.1.8 reproduction.
- Exact publication dates for every pinned DuckDB-WASM/Svelte/SvelteKit/Vite patch within the eight-source cap. Their exact pinned versions are verified; the umbrella framework release recency was checked directly.
- Evidence Studio implementation/package syntax to compare line-by-line: the official `evidence-studio-template` repository exposed only a README in the browsed surface. No deciding Core syntax was found to depend on that repository.

## Retained source set (8 distinct URLs)

1. Observable, [Releases | observablehq/framework](https://github.com/observablehq/framework/releases), accessed 2026-08-18.
2. Observable, [package.json | observablehq/framework](https://github.com/observablehq/framework/blob/main/package.json), current `main`, accessed 2026-08-18.
3. Observable, [Reactivity | Observable Framework](https://observablehq.com/framework/reactivity), living docs, accessed 2026-08-18.
4. Evidence, [package.json | evidence-dev/evidence](https://github.com/evidence-dev/evidence/blob/main/package.json), current `main`, accessed 2026-08-18.
5. Evidence, [issue #3303: base-path preprocessor mangles expression-form attributes](https://github.com/evidence-dev/evidence/issues/3303), opened 2026-05-05, accessed 2026-08-18.
6. Evidence, [E2E README | evidence-dev/evidence](https://github.com/evidence-dev/evidence/tree/main/e2e), current `main`, accessed 2026-08-18.
7. Evidence, [What is Evidence? | Evidence Docs](https://docs.evidence.dev/), living docs, accessed 2026-08-18.
8. Evidence/npm, [@evidence-dev/evidence](https://www.npmjs.com/package/%40evidence-dev/evidence), Core 40.1.8 published 2026-02-06, accessed 2026-08-18.
