# Implementation-fit verification — fresh-context spot check

## Scope and method

- Read only `fit-r1-1.md` and `fit-r2-1.md`; no other project files or ambient project context were inspected.
- Checked the three requested load-bearing claims against primary technical material: current vendor documentation plus current repository issues containing firsthand reproductions. Five distinct URLs were retained from six web calls. Accessed 2026-08-18.
- Status vocabulary: **verified** means the load-bearing claim survives the check; a wording correction can still narrow it. No overall product recommendation is made.

## A — Client DuckDB-WASM over Parquet and static GitHub Pages

**Status: verified.**

- **Observable Framework:** its current v1.13.4 SQL reference explicitly describes client-side DuckDB, registers a local Parquet file as a table, and later identifies the engine as DuckDB-Wasm. Its current getting-started material says `build` produces `dist` for a static HTTP server and explicitly describes GitHub Pages deployment. These are the two halves of the claimed deployment/runtime combination, not merely generic DuckDB and not a server query path.
- **Evidence:** the official GitHub Pages guide says GitHub Pages can deploy Evidence apps, describes the required repository subpath/build-directory configuration, and frames the output as HTML/CSS/JavaScript. A firsthand current repository report identifies Evidence's Parquet cache as consumed by DuckDB-WASM at runtime in the browser (and during SSR) and points to the repository's `buildMultipartParquet` implementation. This is sufficient to verify the architecture, although the runtime half is evidenced by a reproducible repository report rather than a maintainer-authored architecture specification.
- **Wording correction:** say **“Both have supported static GitHub Pages build paths and browser DuckDB-WASM paths that query Parquet”**, not “the complete production combination is proven.” The sources do not constitute a project-specific proof of worker/WASM asset paths, offline behavior, CORS/range requests, or performance on a GitHub Pages repository subpath.

Sources:

1. Observable, [SQL | Observable Framework](https://observablehq.com/framework/sql), current living documentation for v1.13.4; page footer © 2026; accessed 2026-08-18.
2. Observable, [Getting started | Observable Framework](https://observablehq.com/framework/getting-started), current living documentation for v1.13.4; page footer © 2026; accessed 2026-08-18.
3. Evidence, [GitHub Pages | Evidence Docs](https://docs.evidence.dev/deployment/self-host/github-pages), living documentation, undated; accessed 2026-08-18.
4. Evidence repository / jameswinegar, [Issue #3301: Optimize parquet writer output for duckdb-wasm in `buildMultipartParquet`](https://github.com/evidence-dev/evidence/issues/3301), opened 2026-04-23; accessed 2026-08-18.

## B — Observable has the thinner plain-DOM boundary; Evidence requires Svelte and its current exact stack

**Status: verified.**

- **Observable:** current v1.13.4 documentation defines a Framework component as a JavaScript function returning a DOM element and says the function may live in an ordinary standalone `.js` module. That is materially thinner than a compiled UI-component contract. It does not mean “no framework semantics”: page reactivity, display, resize/invalidation, and lifecycle ownership still come from Observable's runtime/calling cell.
- **Evidence:** the Core 40.1.8 reproduction in issue #3303 exercises Evidence's Svelte-markup preprocessing and reports the resolved stack as Svelte 4.2.19 and SvelteKit 2.8.4, alongside `@evidence-dev/sdk` 4.0.2 and `@evidence-dev/preprocess` 6.0.7. The failure itself exists because Evidence preprocesses Svelte attribute syntax before SvelteKit prerendering. This independently corroborates that escaping to reusable arbitrary UI remains a Svelte/compiler boundary rather than a plain DOM-returning function boundary.
- **Wording correction:** replace **“Evidence requires Svelte and the current exact stack”** with **“Evidence Core 40.1.8 custom markup/components run through a Svelte compiler boundary; the reproduced installed stack is exactly Svelte 4.2.19/SvelteKit 2.8.4.”** “Exact” should attach to that reproduced Core version, not be presented as an immutable all-version contract. Likewise, Observable is “plain DOM-returning JavaScript at the reusable component boundary,” not framework-free end to end.

Sources:

1. Observable, [Getting started | Observable Framework](https://observablehq.com/framework/getting-started), current living documentation for v1.13.4; page footer © 2026; accessed 2026-08-18.
2. Evidence repository / Etumos, [Issue #3303: `addBasePathToHrefAndSrc` mangles expression-form attributes](https://github.com/evidence-dev/evidence/issues/3303), opened 2026-05-05 against Evidence Core 40.1.8; accessed 2026-08-18.

## C — Evidence issue #3303 is narrow and lintable, not an unconditional gate failure

**Status: verified, conditionally.**

- The firsthand reproduction is narrowly triggered by a configured non-root `deployment.basePath` plus unquoted Svelte expression-form `href={...}` or `src={...}`. The reported preprocessor regex captures only the opening `{`, prepends the base path, and causes SvelteKit prerender 500s.
- The issue says its existing spec covers double-quoted, single-quoted, and unquoted literal forms but lacks expression-form coverage. The reporter's downstream workaround is explicit: use quoted interpolation (`href="{somePath}"`) and enforce it with CI lint. The issue remained open, unassigned, with no linked PR when accessed.
- **Wording correction:** call this **“a narrow, convention-and-lint-manageable build defect, not an intrinsic GitHub Pages capability failure.”** Do not say it is harmless: without the convention/lint it is a real build failure for valid Svelte syntax, and the current issue supplies no maintainer fix or regression test. “Not a gate failure” is therefore conditional on adopting and testing the workaround.

Source:

1. Evidence repository / Etumos, [Issue #3303: `addBasePathToHrefAndSrc` mangles expression-form attributes](https://github.com/evidence-dev/evidence/issues/3303), opened 2026-05-05 against Evidence Core 40.1.8; accessed 2026-08-18.

## Verification result only

| Claim | Result | Required qualification |
|---|---|---|
| A. Both support browser DuckDB-WASM over Parquet plus static GitHub Pages | **Verified** | Capability paths are established; a combined project/subpath proof remains separate implementation testing. |
| B. Observable's custom boundary is thinner/plain DOM; Evidence is Svelte/current stack | **Verified** | Observable is not framework-free; Evidence's exact versions are scoped to the reproduced Core 40.1.8 installation. |
| C. #3303 is narrow/lintable rather than a hard gate failure | **Verified, conditionally** | It still breaks prerender unless the quoted-interpolation convention/lint (or an upstream fix) is enforced. |
