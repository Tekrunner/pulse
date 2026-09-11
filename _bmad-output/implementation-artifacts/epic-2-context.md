# Epic 2 Context: Extend Pulse Through Repeatable Agent Workflows

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable coding agents to extend Pulse with public sources, datasets and indicators, purpose-built visuals, reports, and data-driven annotations—and to evolve dataset schemas—through stable, source-neutral workflows. Each workflow must reuse shared contracts and implementation, preserve existing output unless dependencies explicitly require change, and remain understandable without inspecting or copying unrelated working examples.

## Stories

- Story 2.1: Establish the Report Design Foundation
- Story 2.2: Add a Public Source Through a Source-Neutral Workflow
- Story 2.3: Add and Evolve Dataset Packages Safely
- Story 2.4: Author and Register a Purpose-Built Visual
- Story 2.5: Build a Report from Questions, Sources, Visuals, and Annotations

## Requirements & Constraints

- Repository-owned workflows must separately cover adding a source, adding a dataset or indicator, changing a dataset schema, adding a visual, and adding a report. Each must expose the decisions, artifacts, commands, validation, and completion gates an agent needs without requiring unrelated implementation reading.
- Every workflow starts from a neutral template validated by synthetic fixtures and at least one complete working implementation. Existing implementations are conformance evidence, not scaffolds to copy; templates and shared runtime must contain no provider-, dataset-, report-, series-, or visual-specific behavior.
- Extensions must be independently discoverable from stable lowercase kebab-case declarations, reject identity and path collisions, and preserve unaffected sources, datasets, visuals, reports, catalogs, statuses, and public output.
- Public source workflows must capture identity, access and archival constraints, cadence and publication expectations, licence, attribution, visibility, assertions, offline fixtures, and explicit live-integration gates. Acquisition remains separate from analytical transformation.
- Dataset workflows must publish typed, wide, documented report-facing data with machine-readable unit, definition, provenance, licence, and attribution. Schema changes require consumer-impact analysis and classification; breaking changes require an atomic migration or an explicitly owned and tested compatibility adapter. Rebuilds start from immutable snapshots, not warehouse migrations.
- Visuals are authored against declared-schema fixture rows, then receive validated plain rows plus display and provenance inputs. They return ordinary DOM/SVG, provide accessible data equivalents, and must not use chart or visualization libraries or depend on SQL, DuckDB, storage paths, routes, framework globals, or lifecycle protocols.
- Reports declaratively own stable identity, route, visibility, dataset/column dependencies, visual slots, exploration choice, queries, interaction state, annotations, and substantive-change metadata. Annotations are versioned data joined to analytical rows before rendering, never hardcoded visual coordinates.
- The design foundation establishes semantic color roles, typography, spacing, state presentation, focus, responsive behavior, accessibility baselines, reduced-motion behavior, and concise agent-facing guidance. It must not prescribe chart types, report layouts, report content, a component catalog, or individual visual designs.
- Normal, interactive, loading, empty, suspect, stale, query-error, schema-incompatibility, render-error, and shared-engine-failure behavior must be distinguishable and accessible. Slot-local failures must leave sibling content usable.

## Technical Decisions

- Sources, datasets, and reports are independent package kinds connected only through immutable, versioned snapshot and dataset artifacts. Source packages own provider access, faithful decoding, assertions, fixtures, and snapshot contracts; dataset packages own analytical typing, semantics, models, tests, and report-facing contracts; reports never read snapshots.
- Versioned, strictly validated Pulse JSON manifests are the sole inter-stage API. Unsupported major versions fail. Reports resolve datasets only by opaque dataset IDs through the browser manifest and shared data client; declared dataset and column lineage drives visibility and suspect-impact resolution.
- Each v1 dataset has exactly one source. A report may query several independent datasets, but must not create an undeclared multi-source dataset. Missing source or report-facing contracts route report work through the corresponding source or dataset workflow before report work resumes.
- `site/design/tokens.css` is the canonical owner of dark-default semantic theme roles, typography, spacing, state colors, focus treatment, and reduced-motion signals. `site/design/visual-language.md` owns only current cross-visual authoring conventions. One-off choices remain local; new shared roles require cross-report consumer review and must not force unrelated rewrites.
- The source-neutral visual template demonstrates semantic tokens, declared-schema fixtures, display/provenance inputs, responsive containers, accessible states, and focused cleanup. Visual contract major changes require an atomic migration or an application-owned compatibility adapter.
- Shared behavior belongs in runtime only after it is demonstrably package-neutral. Provider-specific, report-specific, and novel visual behavior stays local until an independent second use supports a common contract.
- The repository-local Pulse CLI is the sole high-level automation interface. Thin scheduled and on-demand workflows invoke the same stages; default-branch mutations remain serialized through the shared repository-writer path.
- Conformance combines offline source and dataset fixtures, neutral synthetic packages, visual contract tests, and browser coverage for registration, catalogs, annotation joins, route behavior, accessibility, failure isolation, and static output.

## UX & Interaction Patterns

Pulse is dark-default and English-only in v1. Every visual and report must satisfy WCAG 2.2 AA with semantic structure, logical keyboard operation, visible focus, sufficient contrast, adequate targets, non-color-only state communication, zoom/reflow support, restrained motion honoring `prefers-reduced-motion`, and an accessible data equivalent. Rendering is container-responsive and remains readable and operable in narrow smartphone landscape; advanced controls may simplify, but the indicator and provenance must remain available. Figures, precision, comparison, emphasis, interaction, layout, and visual treatment are decided per report or visual against real content rather than inherited from a universal grammar.

## Cross-Story Dependencies

Story 2.1 supplies the canonical tokens, visual-language guidance, and neutral visual template consumed by Stories 2.4 and 2.5. Story 2.5 reuses existing dataset/column identities and invokes Story 2.2 when no suitable snapshot contract exists, Story 2.3 when no suitable report-facing contract exists, and Story 2.4 for each new purpose-built visual. Story 2.3 schema changes must identify and migrate or adapt every affected report query, exploration query, visual fixture and consumer schema, lineage declaration, and catalog entry. All extension stories depend on the shared discovery, manifest, CLI, conformance, visibility, and lineage contracts established by the existing system.
