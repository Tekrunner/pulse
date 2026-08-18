# Claude Design handoff — Pulse Homepage

## Your role

Work interactively with Yann to design the exact Homepage for **pulse**, a personal data hub and reporting tool. You are the specialist visual-design producer for this screen. Explore alternatives, explain concrete trade-offs in plain language, refine from Yann's reactions, and only then produce the final design artifact.

This is not permission to redesign the product model or pre-design Report Visuals. Treat the requirements below as the behavioral contract. The exact composition, visual hierarchy, typography, palette, spacing, and component styling are yours to explore with Yann.

## Product intent

Pulse helps Yann rebuild and maintain familiarity with indicators he considers important for understanding the world. It publishes a small, curated collection of rich, purpose-built **Reports**. Reports explore several aspects of a subject through multiple Visuals; they are not summary dashboards.

The Homepage has two functions, in this priority order:

1. Browse and open Reports.
2. Verify at a glance that every expected data pipeline executed and is healthy.

The primary reader is Yann. The public site also acts as portfolio evidence, but this is not a consumer SaaS product: there is no login, onboarding, multi-user model, configuration UI, or growth-oriented call to action.

## Working method

1. Start with two or three materially different Homepage compositions within the accepted register below. Do not treat the prior mockup as a template.
2. Show both an ordinary healthy state and a state with one unhealthy or suspect pipeline.
3. Let Yann react to hierarchy, density, typography, color, and component treatment.
4. Iterate toward one exact Homepage design.
5. Deliver the approved design in the most implementation-useful form your environment supports, together with explicit visual tokens and responsive/state notes.

Do not silently turn provisional content, representative dates, or pipeline names into product requirements.

## Accepted starting register — not an approved design

Yann preferred the general **Instrument** direction over the Observatory and Editorial experiments. Interpret that only as a loose preference for a precise, operational, developer-adjacent dark interface with useful density.

It does **not** mean:

- Copy the existing Instrument HTML.
- Preserve its layout, typography, colors, components, labels, or proportions.
- Treat any thumbnail or representative content in it as approved.
- Make the pipeline area visually equal to or more important than Reports.

If useful, Yann can attach `direction-instrument.html` as a reference. Treat it as a conversation artifact with known mistakes, not a specification.

## Homepage content contract

### Report directory — primary

- The Report collection is expected to remain small. Do not design a marketplace, content portal, taxonomy, search system, or dashboard of headline metrics.
- Each Report row/listing shows only:
  - Report name.
  - Last substantive update.
- “Last substantive update” changes when data or content used by the Report changes. Routine regeneration with identical inputs does not change it.
- Provide sorting by:
  - Alphabetical order.
  - Last substantive update.
- The v1 real Report is **French macroeconomics**. Additional entries may be visibly labeled as representative when needed to test a small-list layout.
- Do not show Report-Visual thumbnails, chart previews, KPI cards, sparklines, or invented report summaries on the Homepage.

### Pipeline status — secondary but habitual

- The Homepage must account for **every independently scheduled or executable pipeline**. Do not collapse this into only one latest overall run.
- In the compact/default presentation, every pipeline exposes at least:
  - Pipeline name.
  - Status.
  - Execution date/time.
- Each pipeline can expand to show as much actionable diagnostic information as the system provides.
- Exact diagnostic fields are not settled because the pipelines do not yet exist. Use representative diagnostic copy only when demonstrating the design, and label it as representative.
- Status must distinguish meaning without color alone. Expected concepts include healthy, failed, late/stale, suspect data, and never ran; exact vocabulary can be refined with Yann.
- Suspect data is published but marked. The pipeline status must always expose the problem.
- Do **not** add a redundant aggregate box such as “2 healthy / 1 needs attention” above or beside the pipeline list. The list itself is the at-a-glance status surface.
- An unhealthy pipeline may deserve stronger visual attention than a healthy one, but Report browsing remains the Homepage's primary function.

### Relationship to affected Reports

- If the eventual architecture can reliably trace impact, affected Reports or Visuals should also show suspect-data warnings.
- Do not claim that lineage exists in the Homepage design. This is an architecture-dependent enhancement.

## Explicit exclusions

- Do not design individual Report Visuals in this engagement.
- Do not define a chart vocabulary, data-visualization style, or reusable Visual template.
- Do not include tiny chart thumbnails merely to make the mockup look complete.
- Do not infer that all Reports share exploration controls. Exploration is purpose-built per Report or Visual.
- Do not create system-wide rules for country selection, dates, comparisons, absolute values, year-over-year changes, or indicator variants. Previously discussed examples were illustrative only.
- Do not add authentication, user profiles, onboarding, settings, notifications, configuration, or pipeline-triggering controls.
- Do not turn the Homepage into a summarized data dashboard.

## Platform and responsive behavior

- Responsive web, desktop-primary.
- Smartphone use is primarily quick lookup and Report access, not detailed analysis.
- For this Homepage engagement, make the Report directory and pipeline states usable on phone without trying to solve Report Visual responsiveness.
- Report Visuals will be designed later per Report; their separate requirement is readability on phone, at least in landscape orientation.

## Visual and interaction constraints

- Dark theme by default.
- Dense, analytical, functional, elegant, and purpose-built; avoid consumer-app gamification or decorative dashboard tropes.
- English interface copy.
- Motion is restrained and functional only.
- Respect `prefers-reduced-motion`.
- Meet WCAG 2.2 Level AA, including keyboard operation, visible and unobscured focus, semantic structure, non-color-only status communication, contrast, browser zoom/reflow, and adequate target sizes.
- Collapsible pipeline details must work with keyboard and assistive technology.

## States the design must demonstrate

At minimum, show:

1. Normal Homepage with a small Report list and all pipelines healthy.
2. Homepage with one failed, late, or suspect pipeline, still preserving Report access.
3. One expanded unhealthy pipeline with representative actionable diagnostics.
4. Narrow/mobile Homepage treatment for the Report list and pipeline status.

The exact layout and visual treatment of these states are design decisions to make with Yann.

## Final handoff requested

Once Yann approves a direction, provide:

- The exact Homepage design for desktop and narrow/mobile widths.
- Healthy, unhealthy/suspect, collapsed, expanded, loading, and empty/no-pipeline states where applicable.
- Explicit color, typography, spacing, radius, border, and component tokens.
- Interaction notes for sorting, expansion, keyboard focus, and status communication.
- Implementation-ready assets or code available from your tool.
- A concise list of decisions Yann approved and questions intentionally left to architecture.

Save or export the final outputs into the Pulse UX import folder so BMAD can reconcile them into `DESIGN.md` and `EXPERIENCE.md`:

`_bmad-output/planning-artifacts/ux-designs/ux-pulse-2026-08-11/imports/claude-design-homepage/`

The eventual `DESIGN.md` and `EXPERIENCE.md` contracts will win if a later mockup conflicts with them.
