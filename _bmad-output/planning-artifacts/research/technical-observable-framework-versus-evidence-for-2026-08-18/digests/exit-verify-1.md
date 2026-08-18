# Fresh-context verification — exit-cost claims

## Scope and method

- **Input inspected:** `exit-r1-1.md` only.
- **Claims checked:** (A) portability of deliberately framework-thin Observable custom visuals; (B) Svelte portability versus framework-neutral exit cost in Evidence.
- **Evidence policy:** primary technical artifacts from the publishers' own repositories, distinct from the documentation cited in the input digest. Five source URLs retained. Repository files are undated `main`-branch snapshots unless noted. Accessed 2026-08-18.
- **Status vocabulary:** verified / unverified / disputed / overturned. No overall framework recommendation is made.

## Claim A — Observable custom visuals can be portable ordinary DOM/SVG-returning local JavaScript modules when pages avoid reactive globals and implicit protocols

**Status: verified, with a scope correction.**

### What the independent technical evidence says

Observable's official example inventory distinguishes visualizations implemented as JavaScript components from visualizations written directly in Markdown, and describes the repository examples as reusable source that can be copied into another project [A1]. The official `hotel-bookings` example makes the boundary concrete: its project contains `src/components/bigNumber.js` and `src/components/donutChart.js` beside `src/index.md`, calls both JavaScript files reusable visualization components, and states that the project has no dependencies other than Framework [A2]. This independently supports the load-bearing architectural point that visualization logic **can** live in ordinary local JavaScript files rather than in page-level reactive Markdown.

The evidence verifies possibility and separability, not automatic portability. The retrieved repository views did not expose the bodies of the two component files, so this pass does not independently prove that those particular examples return only standards-based `Element`/`SVGElement` values or avoid every Observable global. The conditional in the claim therefore matters: portability follows only when the module's public boundary is plain JavaScript/data/DOM and all Framework reactivity, mounting, implicit imports, and special URL schemes remain in the disposable page adapter.

### Correction

Narrow the wording to: **“Observable Framework permits reusable local JavaScript visualization modules. Such a module is framework-neutral only if inspection confirms that it accepts plain data, returns or mutates standards-based DOM/SVG, and imports no Observable runtime/stdlib bindings or Framework-resolved protocols.”** Do not infer portability merely from a `.js` extension or a `components/` location.

### Sources

- **[A1]** [Observable Framework examples](https://github.com/observablehq/framework/tree/main/examples) — Publisher: Observable, Inc. / `observablehq` GitHub organization. Publication date: undated current repository snapshot. Accessed: 2026-08-18.
- **[A2]** [Official hotel-bookings example](https://github.com/observablehq/framework/tree/main/examples/hotel-bookings) — Publisher: Observable, Inc. / `observablehq` GitHub organization. Publication date: undated current repository snapshot. Accessed: 2026-08-18.

## Claim B — Evidence custom visuals are Svelte-portable, while framework-neutral exit cost rises through Evidence Markdown, `@evidence-dev` packages, the source runner, and generated manifests

**Status: verified.**

### What the independent technical evidence says

The published `@evidence-dev/evidence` package manifest identifies Svelte, SvelteKit, Vite, and the static adapter, while depending on `@evidence-dev/preprocess`, `@evidence-dev/sdk`, `@evidence-dev/telemetry`, and `@evidence-dev/universal-sql`; it also develops against Evidence component packages [B1]. This supports the distinction between a comparatively direct Svelte/SvelteKit migration and a framework-neutral migration that must replace Evidence-specific processing and runtime packages.

The CLI source makes the authoring and generated-data coupling explicit. It watches `pages/**`, rewrites Markdown page paths to SvelteKit `+page.md`, copies custom `components/**` into the generated template's `src/components/`, launches Vite inside `.evidence/template`, and exposes an Evidence `sources` command that delegates to `@evidence-dev/sdk/legacy-compat` to create Parquet files [B2]. The same CLI treats `.evidence/template/static/data/manifest.json` as a required source manifest, tells users that `npm run sources` generates it, and during production build reads and rewrites `manifest.renderedFiles` to content-hashed Parquet paths before copying the generated output [B2]. Thus the source runner and manifest/path semantics are operational code paths, not merely documentation terminology.

The package's template-build source further shows that Evidence ships a generated SvelteKit/Vite project containing Markdown pages and Svelte layouts, invokes `@evidence-dev/preprocess`, injects Evidence imports, and installs Evidence-specific SDK Vite plugins plus `@evidence-dev/core-components`, DuckDB-WASM, and Arrow in the generated toolchain [B3]. That confirms why preserving Svelte source is materially cheaper than removing Evidence altogether: a framework-neutral destination must replace page preprocessing, injected imports, query/source integration, and generated manifest/runtime conventions even when the visual markup itself remains understandable.

### Correction

Keep the claim, but avoid describing a complete Evidence component as automatically “portable to Svelte.” The precise claim is: **its Svelte syntax and framework-neutral HTML/CSS portions are reusable in another Svelte build, while imports, injected variables, query objects, preprocessing assumptions, and `@evidence-dev/*` dependencies still require adaptation.** Generated `manifest.json` and hashed Parquet paths should be treated as Evidence build artifacts unless the project deliberately adopts and versions that format as its own contract.

### Sources

- **[B1]** [`@evidence-dev/evidence` package manifest](https://raw.githubusercontent.com/evidence-dev/evidence/main/packages/evidence/package.json) — Publisher: Evidence / `evidence-dev` GitHub organization. Publication date: undated current repository snapshot; manifest version `40.1.8`. Accessed: 2026-08-18.
- **[B2]** [Evidence CLI source](https://raw.githubusercontent.com/evidence-dev/evidence/main/packages/evidence/cli.js) — Publisher: Evidence / `evidence-dev` GitHub organization. Publication date: undated current repository snapshot. Accessed: 2026-08-18.
- **[B3]** [Evidence template-build source](https://raw.githubusercontent.com/evidence-dev/evidence/main/packages/evidence/scripts/build-template.js) — Publisher: Evidence / `evidence-dev` GitHub organization. Publication date: undated current repository snapshot. Accessed: 2026-08-18.

## Verification result

- **Claim A:** verified with narrower wording; local JavaScript placement enables, but does not itself guarantee, framework-neutral DOM/SVG portability.
- **Claim B:** verified; repository code directly exhibits the Markdown-to-SvelteKit copying, Evidence package/preprocessor/runtime stack, source runner, and generated-manifest/hash-rewrite coupling asserted by the digest.
