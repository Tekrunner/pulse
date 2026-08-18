# Observable Framework vs Evidence — lock-in, failure modes, and exit cost

## Scope and method

- **Decision served:** choose a report-site substrate for Pulse v1.
- **Angle only:** framework-specific authoring/runtime surface, unusual syntax, generated-artifact and internal-API dependence, component portability, data-pipeline coupling, abandonment/forking scenarios, and practical migration to a generic Vite/static app. This digest does **not** name an overall winner.
- **Hard gates tested against the sources:** fully static GitHub Pages output; client-side DuckDB-WASM over Parquet; hand-authored HTML/SVG/CSS and interactions without a visualization library; repository-first reproducibility; continued possibility of structural public/private separation.
- **Method:** broad-first search, followed by official documentation/source/package metadata and one firsthand maintainer-hosted user discussion. Only primary sources are used. Eight distinct source URLs were retained. Documentation without a displayed publication date is labeled as a current snapshot. The unresolved user report is treated as an anecdote, not proof of a general defect.
- **Accessed:** 2026-08-18.

## Findings — individual claims

### Claim 1 — Observable's durable core is ordinary files and front-end JavaScript, but its page execution model is not a generic static-app runtime

- **Claim:** Observable Framework is an open-source static-site generator whose repository describes JavaScript on the front end and arbitrary-language build-time analysis. That makes repository ownership and static hosting plausible. However, an authored Framework page is compiled into and depends at runtime on the Observable runtime/standard library whenever it uses reactive Markdown cells or Framework built-ins; the static HTML is therefore deployable without a server but not framework-free source.
- **Source:** [Observable Framework repository](https://github.com/observablehq/framework)
- **Publisher:** Observable, Inc. / observablehq GitHub organization
- **Publication date / current snapshot:** current snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high for static/open-source/file-oriented properties; medium for the exit-cost inference
- **Class:** architecture / authoring lock-in / inference

### Claim 2 — Observable local JavaScript modules are the strongest portability asset; implicit imports, special protocols, and reactive globals are the main lock-in surface

- **Claim:** Framework supports local JavaScript modules and standard package libraries, but Markdown pages may rely on implicit bindings and two Framework-resolved schemes: `observablehq:` for its runtime/stdlib and `npm:` for packages. The build rewrites local imports to content-hashed files under `_import`, emits additional `_observablehq` assets, and rewrites paths. The generated directory layout is therefore an implementation output, not a sensible application API. A component written as a plain local module returning a DOM/SVG element is much easier to carry to Vite than code embedded in reactive cells using `display`, `view`, `Mutable`, `Generators`, `FileAttachment`, implicit `sql`, or Framework-resolved import schemes.
- **Source:** [Observable Framework — Imports](https://observablehq.com/framework/imports)
- **Publisher:** Observable, Inc.
- **Publication date / current snapshot:** current documentation snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high for mechanisms; high for the relative-portability inference
- **Class:** runtime surface / generated artifacts / component portability

### Claim 3 — Observable's implicit package resolution can weaken clean-clone reproducibility unless versions and caches are deliberately controlled

- **Claim:** The imports documentation says recommended libraries are implicit npm imports and that, when a requested library is absent from the Framework npm cache, the latest version is downloaded by default; it also documents explicit semver ranges and cache seeding as controls. A repository that leaves these imports implicit/unversioned can rebuild to different transitive client assets over time even if its own `package-lock.json` is unchanged. A reproducible pilot must pin every nonlocal import or prove that the cache/lock policy freezes resolution in clean CI.
- **Source:** [Observable Framework — Imports](https://observablehq.com/framework/imports)
- **Publisher:** Observable, Inc.
- **Publication date / current snapshot:** current documentation snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** reproducibility / dependency failure mode

### Claim 4 — Observable directly satisfies the DuckDB-WASM/Parquet direction, but its convenience SQL surface is a replaceable adapter, not the seam to preserve

- **Claim:** Framework documents client-side SQL powered by DuckDB, including registration and querying of Apache Parquet, and exposes the SQL fence as shorthand for an `sql` tagged template from `@observablehq/duckdb`. That package-level boundary offers an exit route, but Markdown SQL fences, frontmatter table registration, and implicit `sql` are Framework authoring constructs. The cheapest migration keeps query text and Parquet contracts but replaces registration/reactivity with a small explicit client module. The same source documents a DuckDB-WASM prepared-statement limitation for array arguments and warns that string interpolation workarounds require injection care.
- **Source:** [Observable Framework — SQL](https://observablehq.com/framework/sql)
- **Publisher:** Observable, Inc.
- **Publication date / current snapshot:** current documentation snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** data runtime / portability / failure mode

### Claim 5 — Observable is legally forkable, but a fork is operationally costlier than a page-shell migration

- **Claim:** The public repository identifies Observable Framework as ISC-licensed and exposes the implementation, tests, templates, and examples. The license permits an abandonment fork, but maintaining the compiler, runtime/stdlib integration, import rewriting, loader/cache behavior, and browser compatibility would be a materially larger obligation than moving framework-thin pages onto Vite. Forkability is thus a last-resort continuity mechanism, not the cheapest hedge.
- **Source:** [Observable Framework repository](https://github.com/observablehq/framework)
- **Publisher:** Observable, Inc. / observablehq GitHub organization
- **Publication date / current snapshot:** current repository snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high for metadata; medium-high for maintenance-cost inference
- **Class:** ecosystem / abandonment / forkability

### Claim 6 — Evidence's data pipeline creates a highly reusable format boundary but couples extraction to Evidence commands and source conventions

- **Claim:** Evidence extracts all configured sources into Parquet via `npm run sources`, uses source-specific plugins/configuration, and names tables from `/sources/[source]/...` query files. Parquet is an excellent framework-independent handoff format. The extraction command, connection conventions, source manifests, table naming, and incremental-source behavior are Evidence pipeline contracts. Exit is cheapest if the project treats the emitted Parquet datasets and its own manifest/schema as the contract, and treats Evidence's source runner as replaceable production machinery.
- **Source:** [Evidence — Data Sources](https://docs.evidence.dev/core-concepts/data-sources)
- **Publisher:** Evidence
- **Publication date / current snapshot:** current documentation snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** data pipeline / coupling / portability

### Claim 7 — Evidence custom UI is portable primarily to another Svelte build, not automatically to a generic framework-neutral Vite app

- **Claim:** Evidence custom components are `.svelte` files; the guide says Evidence is built on Svelte, requires Svelte syntax, and shows direct imports from `@evidence-dev/core-components` and `@evidence-dev/component-utilities`. Plain HTML and CSS inside those components remain understandable, and Vite can host Svelte, but component logic is not vanilla-Web-Component code. A migration that keeps Svelte is moderate; migration to vanilla DOM, React, or another view layer requires template/reactivity rewrites. Imports from Evidence component packages increase exit cost further and should be prohibited in the portability-critical visualization layer.
- **Source:** [Evidence — Custom Components](https://docs.evidence.dev/components/custom/custom-component)
- **Publisher:** Evidence
- **Publication date / current snapshot:** current documentation snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** authoring syntax / component portability

### Claim 8 — Evidence supports GitHub Pages, but base-path and nested-build-path configuration are part of the deployment contract

- **Claim:** Evidence's GitHub Pages guide explicitly says Evidence apps can deploy from a GitHub repository and requires both `deployment.basePath` and a matching `EVIDENCE_BUILD_DIR` nested under `build` for the default `github.io/<repo>` subpath. This satisfies the static-host target in principle but creates a path-sensitive failure mode: success at `/` or on a preview server does not prove correctness at the actual repository subpath.
- **Source:** [Evidence — GitHub Pages](https://docs.evidence.dev/deployment/self-host/github-pages)
- **Publisher:** Evidence
- **Publication date / current snapshot:** current documentation snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high
- **Class:** deployment / hard gate / path failure mode

### Claim 9 — Evidence's framework package is a SvelteKit/Vite assembly, so abandoning Evidence need not mean abandoning its underlying web toolchain

- **Claim:** The Evidence package metadata identifies an MIT-licensed public package and lists Svelte, SvelteKit, Vite, the static adapter, Evidence preprocessing/SDK/universal-SQL packages, and a generated project template. This makes a fork legally possible and means a Svelte-flavored Vite exit can retain some underlying skills. It also shows that maintaining a fork would mean owning a multi-package preprocessor/query/runtime/static-adapter stack, not merely a Markdown renderer.
- **Source:** [Evidence framework package metadata](https://github.com/evidence-dev/evidence/blob/main/packages/evidence/package.json)
- **Publisher:** Evidence / evidence-dev GitHub organization
- **Publication date / current snapshot:** current repository snapshot retrieved 2026-08-18 (page content displayed package version 40.1.8)
- **Accessed:** 2026-08-18
- **Confidence:** high for package composition and license; medium-high for fork-cost inference
- **Class:** ecosystem / abandonment / forkability

### Claim 10 — One current Evidence v40 report exposes the exact generated-artifact coupling the pilot must try to reproduce or rule out

- **Claim:** A user reported that an Evidence v40 static build completed, Parquet files, manifest, worker files, and a 34 MB WASM binary all returned HTTP 200, yet every page stayed at “Loading...” and DuckDB-WASM did not execute. The user suspected incompatibility between a separately run `npm run sources`, hashed Parquet paths/`static/` prefixes in the manifest, and the static build's runtime resolution. The discussion was unanswered at capture time, so this is not evidence of a general Evidence defect or confirmed root cause. It is strong evidence for a pilot test: the build's success and asset HTTP status alone are insufficient; an actual browser query must pass after the exact production source/build split.
- **Source:** [Evidence discussion #3292 — v40 static deploy, queries stuck loading](https://github.com/evidence-dev/evidence/discussions/3292)
- **Publisher:** Firsthand user report hosted in the Evidence GitHub repository
- **Publication date / current snapshot:** 2026-03-26; unanswered snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** high that the reported incident exists; low for suspected cause or general prevalence
- **Class:** firsthand failure anecdote / generated artifacts / runtime initialization

### Claim 11 — No retrieved source establishes first-class structural public/private separation in either framework

- **Claim:** Both candidates can publish a static build directory, but the retained primary sources do not document a framework-level public/private partition that is strong enough to count as a security boundary. For this decision, separation must be enforced above the framework: distinct source roots or repositories, distinct build jobs/credentials, explicit allowlisted public Parquet outputs, and artifact inspection. This is an absence-of-evidence finding, not a claim that either framework makes separation impossible.
- **Source:** Synthesized absence across the eight sources listed above
- **Publisher:** Observable and Evidence primary materials
- **Publication date / current snapshot:** current snapshots 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** medium
- **Class:** hard-gate gap / security architecture / absence of evidence

## Migration comparison to a generic Vite/static app

| Exit surface | Observable Framework | Evidence | Practical migration treatment |
|---|---|---|---|
| Page source | Markdown plus reactive top-level JavaScript/SQL and implicit runtime bindings | Evidence/Svelte-oriented Markdown plus SQL/component preprocessing | Rewrite the shell/routing layer; do not treat framework Markdown as the durable domain artifact. Keep prose separately if it needs reuse. |
| UI components | Best case: ordinary local `.js` functions returning DOM/SVG; worst case: reactive cells and Observable stdlib/global bindings | `.svelte` components; additional coupling when importing Evidence component/utilities packages | Put custom visualizations in framework-independent TypeScript modules that accept plain rows and return `Element`/`SVGElement`, or deliberately choose Svelte as the post-framework portability target. |
| HTML/SVG/CSS without a visualization library | Compatible with front-end JavaScript/DOM, but Framework reactivity can leak into component orchestration | Feasible inside Svelte components, but the component itself remains Svelte source | Pilot one nontrivial hand-authored SVG with hover/focus/filter interactions and zero visualization-library imports; inspect source for runtime-specific helpers. |
| Client SQL | Framework SQL fences/frontmatter wrap `@observablehq/duckdb`/DuckDB-WASM | Evidence query preprocessing/runtime sits over Parquet and DuckDB-WASM | Own a direct `dataClient` module with explicit initialization, table registration, parameter binding, error surfacing, and teardown. Framework pages call it; Vite can call it unchanged. |
| Parquet/data pipeline | Static Parquet is usable directly; Framework conveniences should not define dataset identity | Evidence deliberately normalizes sources to Parquet, a strong exit asset; its commands/manifests/table naming remain coupled | Publish an application-owned manifest with stable logical table names, schema/version, URL, hash, and visibility classification. Do not make a framework-generated manifest the only index. |
| Generated output | Hashed `_import` and `_observablehq` files and rewritten paths | Static build includes generated runtime, manifests, workers/WASM, and path conventions | Never post-process or import from generated internal directories. Validate them as disposable output only. |
| Fork on abandonment | ISC permits it, but owning compiler/runtime/import/loader behavior is substantial | MIT permits it, but owning SvelteKit template/preprocessor/query/runtime/plugin stack is substantial | Prefer a frozen last-known-good version briefly while migrating through the seam. Fork only for a narrow security/compatibility patch with an explicit sunset. |
| Likely exit effort | Low-to-moderate if pages are thin and UI/query modules are explicit; high if logic lives in reactive Markdown and implicit imports | Moderate if the destination keeps Svelte and avoids Evidence packages; high for framework-neutral Vite when report logic lives in Evidence Markdown/built-ins | Measure with an exit drill during the pilot, not a speculative estimate. |

## Cheapest reversibility hedge

The cheapest seam is **not** an abstraction that mimics either framework. It is a small, application-owned browser/data contract:

1. `public-data/manifest.json` is generated by the repository's own script and is the only page-visible dataset index. Each entry has a logical table name, schema/version, content hash, relative Parquet URL, and `public` classification.
2. `dataClient.ts` imports DuckDB-WASM explicitly, accepts that manifest, registers Parquet URLs, exposes parameterized query operations, and surfaces worker/WASM/path errors. It contains no Observable reactive globals, Evidence query objects, or generated-manifest assumptions.
3. Visualization modules accept plain arrays/Arrow rows and return standard DOM/SVG elements; their CSS is application-owned. They import neither a visualization library nor `@evidence-dev/*`, `observablehq:*`, or Framework implicit globals.
4. Framework pages are disposable adapters: they mount returned elements and bridge input events. The adapter layer contains all framework-specific reactivity/routing.
5. The data-production job writes only allowlisted public Parquet plus the application manifest. Private data extraction and report generation run in a separate job/source boundary; the public deploy job has no private credentials.

This hedge exploits the shared durable assets — Parquet, SQL text, DOM/SVG/CSS, static files, and Git — while refusing to stabilize either framework's generated internals.

## What a bounded pilot must falsify

The pilot should be rejected if **any** of these hypotheses survives. Use one representative multi-page report, one meaningful Parquet dataset, and one hand-built interactive SVG; add breadth only when a failure needs diagnosis.

1. **“Static build means production works.”** Deploy to the real `github.io/<repo>` base path and run an automated browser test that initializes DuckDB-WASM, loads Parquet, executes a filter query, navigates between pages, reloads a deep link, and reports worker/WASM failures visibly.
2. **“Clean clone is reproducible.”** Build twice from fresh dependency/cache state with pinned tooling; compare an application-level asset manifest and query results. For Observable, explicitly test resolution with an empty Framework npm cache. For Evidence, test both the documented combined build and the intended separated `sources` then `build` CI sequence.
3. **“Custom visuals are portable.”** Move the visualization and `dataClient` unchanged into a minimal Vite page during the pilot. Timebox the shell adaptation in advance (for example, one engineer-day); failure to complete identifies real exit coupling while it is still cheap.
4. **“Generated internals are disposable.”** Delete all generated caches/build directories, rebuild, and verify that no application source or post-build script imports `_observablehq`, `_import`, Evidence's generated manifest layout, hashed source directories, or worker/WASM locations.
5. **“Public/private is structural.”** Run the public build with no private credentials and with private source trees unavailable. Fail if the build needs them. Scan the complete GitHub Pages artifact for private filenames, schema names, credentials, source SQL, non-allowlisted Parquet, sourcemap contents, and manifest entries.
6. **“No visualization library is required.”** Dependency and bundle inspection must show the selected page does not pull a built-in chart library transitively merely because the framework is present; exercise keyboard focus, resizing, and interaction on the hand-authored SVG.
7. **“The framework can be frozen safely.”** Pin the candidate version, save the complete clean-build procedure, then verify that a frozen build can run without the vendor cloud. Record exactly which npm/download endpoints remain required for disaster recovery.

## Contradictions and tensions

1. **Static output vs client runtime dependence:** Both products describe static deployment, yet “static” means no application server, not “HTML with no framework runtime.” Observable emits its runtime/import assets; Evidence static reports still need its browser query/runtime assets. Exit planning must not equate static hosting with source portability.
2. **Standard formats vs nonstandard orchestration:** Observable exposes Parquet through DuckDB-WASM and Evidence deliberately normalizes to Parquet. In both cases the data bytes are portable, while table registration, reactive query execution, manifests, and path resolution are framework-shaped.
3. **Open-source forkability vs economical continuity:** ISC (Observable) and MIT (Evidence) permit forks, but the package/source surfaces show that either fork inherits a compiler/runtime/toolchain, not a small renderer. Legal freedom does not make forking the low-cost exit.
4. **Evidence package-version freshness:** the retrieved Evidence package metadata page displayed 40.1.8, while the March 2026 firsthand report says the affected project used 40.2.2. The latter is user-supplied project metadata, not verified release metadata. No version conclusion depends on resolving this discrepancy; round 2 should inspect current npm registry metadata and tags if version freshness becomes decision-bearing.
5. **Evidence failure report vs official support:** the official guide supports GitHub Pages, while the retained failure report concerns Vercel and an unusual separated source/build sequence. It is a useful failure shape, not a contradiction proving GitHub Pages is broken.

## Leads for round 2

- Inspect current npm registry metadata and release/tag histories for both projects to distinguish active maintenance from merely available documentation; trace maintainer concentration and release cadence over time rather than using repository stars.
- Locate official source for each runtime's generated data manifest and DuckDB worker/WASM resolution, then identify which symbols/formats are public contracts versus internal implementation.
- Find maintained, minimal official examples of hand-authored SVG/DOM interaction with no chart library and test whether unused built-ins are actually tree-shaken from production bundles.
- Examine official build/source code for sourcemap defaults and artifact inclusion rules relevant to public/private leakage.
- Seek maintainer answers or fixed issues corresponding to Evidence discussion #3292 before treating its suspected manifest mismatch as current.
- Run a concrete two-page exit drill in both candidates and record changed lines/files, retained modules, bundle contents, cold-build behavior, and GitHub Pages base-path results.

## What was sought but could not be found within budget

- A first-class, documented structural public/private partition in either framework.
- A maintained official migration guide from either candidate to generic Vite.
- A maintainer-confirmed root cause or fix for Evidence discussion #3292.
- A primary-source postmortem of a real production abandonment/migration from either framework.
- A formal stability guarantee for either framework's generated directory structure, data manifest, worker paths, runtime globals, or internal package APIs.
- Current, time-series maintainer/contributor concentration and release-cadence evidence; repository snapshots alone are insufficient.
- A source-backed estimate of migration person-days. The pilot exit drill should generate this evidence locally rather than borrowing an unsupported estimate.
