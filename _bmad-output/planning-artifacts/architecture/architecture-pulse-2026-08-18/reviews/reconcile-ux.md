# UX input reconciliation

**Verdict:** RECONCILE BEFORE FINALIZATION

The spine establishes the right report/data dependency direction, per-source isolation, immutable lineage, and purpose-built report model. It does not yet make several settled UX contracts enforceable across independently built reports, visuals, and pipeline units. The load-bearing gaps are per-Visual failure isolation, complete pipeline-health coverage, report/Visual metadata semantics, accessibility and theme conformance, and responsive rendering.

## Scope and authority

- Architecture reviewed: [`ARCHITECTURE-SPINE.md`](../ARCHITECTURE-SPINE.md).
- Settled UX decisions reviewed: [UX `.memlog.md`](../../ux-designs/ux-pulse-2026-08-11/.memlog.md).
- [`EXPERIENCE.md`](../../ux-designs/ux-pulse-2026-08-11/EXPERIENCE.md) is still `in-progress` and contains frontmatter only. Exact Homepage design is explicitly deferred until immediately before Homepage implementation; this review does not treat the unapproved design directions or the Instrument mockup as requirements.
- This reconciliation covers architecture capabilities and contracts only. It excludes visual styling and page-layout choices that can safely remain with later UX design.

## What already landed

- AD-7 makes the Report the owner of controls, reactivity, annotations, provenance copy, routing, and dataset queries while keeping Visual modules independent of SQL and the framework. This supports rich, purpose-built Reports and the UX decision that exploration and cross-Visual coordination are defined per Report rather than globally.
- The Deferred section correctly avoids fixing a system-wide cross-filtering or query topology before a Report needs one.
- AD-3 and AD-4 provide the foundation for per-source status, suspect-data propagation, and source-to-dataset lineage.
- The Time convention separates source-data dates from acquisition and build times, consistent with the UX prohibition on an ambiguous generic “data date.”
- AD-6 and AD-7 preserve framework-neutral DOM/SVG Visuals and leave exact Homepage and Report visual design open.

## Findings

### UX-R1 — The Report-level error rule conflicts with settled per-Visual failure isolation

**Settled UX input:** When technically possible, no-row, query-error, and schema-incompatibility states are isolated and explained inside the affected Visual while the rest of the Report remains usable. Shared DuckDB-WASM initialization or data-delivery failures may justify a broader Report-level state (`.memlog.md` lines 43–44).

**Spine evidence:** AD-7 says, “The report renders explicit shared no-data and query-error states before visual rendering” (line 81). AD-9 tests an assembled Report and DuckDB startup/query failures but does not require one Visual to survive another Visual's failure (line 105). Schema incompatibility is absent from the browser-state convention (line 123).

**Gap / contradiction:** “Shared” can be implemented as a Report-wide gate, and the Report currently owns all SQL. Two compliant Report implementations could therefore make opposite choices: one fails the entire Report on any query error; another contains each query and rendering failure to one Visual. The current rules do not preserve the settled UX behavior.

**Required reconciliation:** Define a Visual-slot boundary owned by the Report. Each slot must independently resolve and render loading, no-row, query-error, schema-incompatibility, and render-error states while sibling slots remain usable. Define the narrower set of failures that can escalate to Report or site scope, such as shared DuckDB-WASM initialization and unavailable data delivery. Extend conformance/E2E coverage with a multi-Visual Report in which one slot fails and the others remain interactive.

### UX-R2 — The status contract covers sources, not every independently executable pipeline

**Settled UX input:** Homepage health must account for every independently scheduled or executable pipeline. The compact view must make missing or unhealthy executions apparent and show at least pipeline name, status, and execution date; expanded detail must expose actionable failure evidence; suspect-data warnings must always appear (`.memlog.md` lines 15–17, 25–27, and 37–40).

**Spine evidence:** AD-3 creates one independently scheduled workflow per source plus a separate site workflow (line 57). AD-4 creates “one replaceable status projection per source” with stage outcomes, freshness, assertions, and latest usable dataset (line 63). No complete expected-pipeline set or site-workflow status contract is defined.

**Gap / contradiction:** The UX unit is every executable pipeline, while the architecture status unit is a source. The separate site workflow is not covered. A Homepage built only from status files that happen to exist also cannot distinguish “never ran / missing” from “not expected,” so it cannot prove that all expected pipelines executed. “Stage outcomes” does not guarantee actionable diagnostic evidence or an explicit execution date.

**Required reconciliation:** Define stable pipeline identity and a complete discoverable set of expected pipelines without violating AD-2's no-central-source-registry rule—for example, derive source pipelines from source declarations and add well-known non-source pipeline identities. Require one current status projection per independently executable pipeline with at least name/ID, expected cadence or trigger, last execution time, state, stage outcomes, suspect-data state, latest usable output, and sanitized actionable diagnostics. Define the missing/never-run state and include the site workflow or explicitly justify its exclusion from Homepage health.

### UX-R3 — Accessibility, reduced motion, and dark-theme ownership are not architecture contracts

**Settled UX input:** Pulse must meet WCAG 2.2 Level AA, including keyboard operation, visible unobscured focus, semantic structure and labels, non-color-only status, AA contrast, zoom/reflow, adequate targets, reduced-motion support, and accessible equivalents for data Visuals. Dark is the default theme, and motion is restrained and reduced or removed when the operating system requests it (`.memlog.md` lines 48–54).

**Spine evidence:** The dependency diagram mentions “Theme and authoring conventions” (line 89), but no AD, consistency convention, owner, interface, or test binds them. The Observable pilot and Playwright rules do not require accessibility verification (lines 75 and 105).

**Gap / contradiction:** The diagram names a dependency that the normative rules never define. Independently built Visuals can obey every AD while choosing incompatible focus behavior, semantics, status colors, motion behavior, and hardcoded palettes. WCAG conformance and reduced motion cannot be recovered reliably as final-page polish when interactive DOM/SVG modules own behavior.

**Required reconciliation:** Add a shared accessibility/theme contract owned outside individual Visuals. It should bind semantic theme tokens, dark-default behavior, non-color state cues, focus and keyboard conventions, reduced-motion propagation, and the requirement for an accessible equivalent or representation for each data Visual. Add automated and manual conformance gates at Visual and assembled-Report levels; the architecture need not prescribe the eventual visual design.

### UX-R4 — Report catalog and per-Visual temporal/provenance semantics are incomplete

**Settled UX input:** Each Homepage Report entry needs a name and last-update date and can sort alphabetically or by that date. “Last updated” means the last substantive change to data or content used by the Report, not routine regeneration. Exact represented periods and provenance belong per Visual; pipeline execution time, Report generation time, and represented data period must remain distinct (`.memlog.md` lines 18–24 and 28–29).

**Spine evidence:** AD-4 records acquisition time and source-data date in source lineage (line 63), and the Time convention distinguishes source-data, acquisition, and build times (line 118). AD-7 says the Report owns provenance copy (line 81). The structural seed has no Report catalog or Report/Visual metadata contract, and no rule defines substantive Report update time.

**Gap / contradiction:** The raw facts exist, but their Report-facing ownership and derivation do not. Separate Report implementations could label build time, newest source acquisition, newest represented observation, or a Git modification time as “last updated.” A static Homepage also lacks a canonical list of Report name, route, and substantive update time for sorting. Nothing requires exact observation period and provenance to accompany each Visual rather than appear once at Report scope.

**Required reconciliation:** Define a build-time Report catalog contract with stable Report ID, name, route, and last-substantive-update semantics. Define what inputs change that value and ensure unchanged-input regeneration does not. Define a per-Visual metadata envelope for represented period, source/provenance references, and any relevant dataset version, while keeping acquisition, build, and observation timestamps separately named. The site build should validate these contracts before publication.

### UX-R5 — Lineage does not yet support honest Visual-level suspect-data impact

**Settled UX input:** Suspect-data warnings must appear in the affected pipeline. Affected Reports or Visuals should also show them when reliable impact traceability is practical; Pulse must not claim Report-level impact when traceability is unreliable (`.memlog.md` lines 40–42).

**Spine evidence:** AD-3 propagates a warning from a suspect source run (line 57). AD-4 links snapshots, landing data, and datasets and makes Reports consume status/lineage contracts (line 63). AD-7 says the Report owns dataset selection but defines no machine-readable Report-to-Visual dependency declaration (line 81).

**Gap / contradiction:** Source-to-dataset lineage is defined, but dataset-to-Report/Visual lineage remains implicit in page code and SQL. The site cannot consistently determine which Visual is affected, and different Report implementations can overstate, understate, or omit impact.

**Required reconciliation:** Require each Report/Visual slot to declare the published datasets it depends on, or explicitly declare that impact cannot be resolved below Report scope. Join those declarations to Pulse lineage/status contracts at build or runtime. Show Visual- or Report-level suspect warnings only when that join is reliable; otherwise keep the warning at pipeline scope and avoid false precision. This dependency declaration can share the metadata envelope introduced for UX-R4.

### UX-R6 — The Visual interface has no responsive sizing or reflow contract

**Settled UX input:** Pulse is desktop-primary, but Report Visuals must remain readable on smartphones; landscape is an acceptable minimum. Smartphone use prioritizes quick indicator checking, and advanced controls are lower priority there (`.memlog.md` lines 13 and 45–47).

**Spine evidence:** AD-7 defines a Visual as a function that accepts rows plus display options and returns DOM/SVG (line 81). It defines cleanup only for external resources but does not assign sizing, resize observation, re-render/update behavior, or narrow-layout responsibility.

**Gap / contradiction:** Independently built Visuals can satisfy AD-7 while using incompatible fixed dimensions, clipping at browser zoom, or requiring framework-specific resize handling. The page shell and Visual can also both assume the other owns responsive updates.

**Required reconciliation:** Assign ownership of container measurement and responsive updates between Report and Visual. Require Visuals to render legibly at the agreed desktop and narrow/landscape envelope, support browser zoom/reflow, and avoid framework-specific sizing dependencies. Allow advanced controls to simplify on narrow viewports while preserving the readable indicator and essential metadata. Exact breakpoints and layout remain deferred to the later design.

### UX-R7 — The spine cites an empty UX artifact rather than the settled decision record

**Settled UX input:** The UX run is paused; exact Homepage design and final `DESIGN.md`/`EXPERIENCE.md` are deferred. The current settled decisions exist in the append-only UX memlog (`.memlog.md` lines 55–63).

**Spine evidence:** Spine frontmatter names `EXPERIENCE.md` as its UX source (line 15). That file contains only frontmatter and is marked `in-progress`; the UX memlog is not named.

**Gap / contradiction:** The spine's provenance implies reconciliation with a source that contains none of the settled UX decisions. Future reviewers cannot tell whether the requirements above were intentionally inherited, missed, or deferred, and a later regenerated `EXPERIENCE.md` could silently diverge from the draft spine.

**Required reconciliation:** During architecture finalization, record the current UX memlog as the decision authority or explicitly log the inherited UX constraints in the architecture memlog. When UX is finalized, reconcile the resulting `EXPERIENCE.md` again and update source provenance without importing the deferred visual design into the architecture spine.

## Non-findings and intentional deferrals

- The UX examples of country/group selection, date ranges, absolute versus year-over-year views, and alternate indicator definitions are illustrative, not a fixed system-wide capability list. AD-7's Report-owned controls and the Deferred per-Report coordination decision are appropriately open.
- The small Report collection, lack of elaborate taxonomy, exact Homepage layout, Instrument stylistic register, and removal of the aggregate health box are UX composition choices, not missing architecture invariants.
- English-only v1 labels do not require an architecture rule while localization remains explicitly out of scope.
- The exact diagnostic fields can remain implementation-dependent, but the status contract must reserve a structured, sanitized way to carry actionable diagnostic evidence.

## Acceptance condition

This reconciliation passes when the spine or its authoritative memlog binds the contracts in UX-R1 through UX-R6 and corrects the source-authority gap in UX-R7, without fixing the deferred Homepage visual design or imposing a global exploration model.
