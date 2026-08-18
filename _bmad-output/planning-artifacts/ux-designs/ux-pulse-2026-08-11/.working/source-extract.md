# UX source extract: pulse PRD + addendum

Extracted for UX discovery on 2026-08-11. This file uses only the two user-approved sources:

- `../../../prds/prd-pulse-2026-08-07/prd.md` (abbreviated **PRD**)
- `../../../prds/prd-pulse-2026-08-07/addendum.md` (abbreviated **Addendum**)

It separates source facts from UX questions. It does not select visual styling, layout, interaction patterns, or product behavior absent from those sources.

## Explicit source facts

### Product intent and experience outcome

- **pulse** is a personal data hub and reporting tool: its engine fetches public data automatically, accepts private data manually, keeps immutable snapshots, rebuilds a curated warehouse, and publishes dense, purpose-built reports. The engine and its workflows—not the content choices inside each individual visual—are the product scope. (PRD §0, lines 10–18; §1, lines 22–28)
- The primary human outcome is **Ambient familiarity**: Yann should carry the approximate magnitude and direction of important indicators in memory through frequent incidental exposure. Economic indicators are the worked example; climate and emissions are also contemplated. (PRD §1.1, lines 30–34)
- Two additional goals matter independently: the public repository is a **Portfolio**, and the project is a **Playground** where purpose-built visuals and duckdb-wasm are intrinsically valued. Those choices must not be optimized away casually. (PRD §1.1, lines 30–34)
- The product loop is explicit: the **Raw archive** compounds only through continued use, while continued use depends on reports being worth opening. Visualization is therefore co-equal with ingestion. (PRD §1, lines 24–28; Addendum §B.3, lines 135–144)
- “At-a-glance” means no assembly by the reader, not low information density. A **Report** may be dense, scrolling, or multi-page as long as it is pre-composed around a standing question. (PRD §1.2, lines 36–47)
- The primary measures of UX success are **Ambient familiarity** and **Habitual opening**. Secondary experience-adjacent measures are becoming Yann's reflex source for tracked indicators and producing something Yann judges functional and elegant. (PRD §8, lines 437–448)

### People and stakeholder roles

- **Yann as the user** wants to recall current approximate values and direction, verify his mental model of a topic on demand, accumulate history without hand curation, and recognize whether ingestion/modelling/presentation are working. (PRD §2.1, lines 63–69)
- **Yann as the builder** wants to add a **Source**, **Indicator**, **Visual**, or **Report** without a large project; enjoy building something functional and elegant; and show the result as evidence of how he works. (PRD §2.1, lines 71–74)
- **A stranger** is a repository reader/rebuilder, not a product operator: strangers may read and rebuild the public repository, but v1 has no configuration UI, onboarding, support commitment, or multi-user model for them. (PRD §2.2, lines 76–78)
- **Coding agents** are operational stakeholders. They perform extension and wiring work using defined workflows, stable contracts, repeated repository shape, shared implementation, and exemplars. Agent legibility—not novice-human ease—is the implementation workflow's ease metric. (PRD UJ-4/UJ-5, lines 87–88; FR-10, lines 211–227; FR-22–FR-24, lines 351–373; NFR-1, line 394)
- **Claude Design** is the named author in the current two-step visual-authoring pipeline; a coding agent then wires its HTML/SVG/CSS/JS output to real data and registers it on a report. (Addendum §C.1, lines 191–200)

### Named journeys and source-defined climax beats

The source says these are deliberately light because there is one operator, no authentication, and no multi-device handoff. (PRD §2.3, lines 80–89; §11, line 477)

1. **UJ-1. Yann checks a number he half-remembers.** In a conversation or while reading, Yann opens pulse, passes through the **Homepage**, opens the macro **Report**, and reads current French inflation in the context of recent trajectory and comparable countries. **Climax:** he recognizes the figure in context and leaves with it slightly more familiar. (PRD §2.3, line 84)
2. **UJ-2. Yann notices the system is fine.** Yann passes through the **Homepage** on his way to a report and sees every source's **Freshness** and the latest **Pipeline run** state without intentionally starting a health check. **Climax:** no source or pipeline issue is marked, so he proceeds without interruption. (PRD §2.3, line 85)
3. **UJ-3. Yann notices the system is not fine.** On the same path, Yann sees one stale **Source** and another with failed **Assertions**. **Climax:** he knows which figures and reports are untrustworthy and has enough information to begin investigating. (PRD §2.3, line 86)
4. **UJ-4. Yann adds a source.** Yann selects a new indicator, follows the defined extension workflow, and a coding agent implements it using known structure and shared code. **Climax:** the new **Source** appears in the next **Pipeline run** and on the **Homepage**. (PRD §2.3, line 87)
5. **UJ-5. Yann adds a visual.** Yann works with an agent to author a purpose-built **Visual** against a **Dataset**, substitute the real query, and register it on a **Report**. **Climax:** the new visual works with real rows while existing visuals remain unaffected. (PRD §2.3, line 88; Addendum §C.1, lines 195–200)
6. **UJ-6. A stranger rebuilds pulse.** A stranger clones the public repository and rebuilds the **Warehouse** and public site from the committed **Raw archive**, without Yann's machine or private data. **Climax:** the public output reproduces end to end. (PRD §2.3, line 89; NFR-2, line 395)

### Explicit surfaces, form factors, and platforms

- **Homepage**: the landing surface and habitual entry point. It navigates to reports and exposes current system health, specifically every pipeline stage and every source's freshness. It also states when the homepage itself was generated. (PRD glossary, lines 105–114; §4.7, lines 309–347)
- **Report**: a curated, multi-angle page on one topic, composed of arbitrary purpose-built visuals. Reports may scroll or span multiple pages and must state the date of the data shown. They are fully pre-composed unless they opt into additional in-browser exploration. (PRD §1.2, lines 42–44; FR-15–FR-17 and FR-25, lines 256–291; FR-20, lines 324–329)
- **In-browser exploration within a Report**: optional per report as a product capability; it lets a reader query beyond pre-composed views without a server round trip or leaving the page. The exploration appearance and cross-filtering behavior are unspecified. (PRD FR-25, lines 283–291; §10, line 467)
- **Local web serving**: static output is opened through a small local server with a single command; `file://` is not supported because duckdb-wasm requires HTTP serving. (PRD §4.6, lines 295–305)
- **Remote static site**: public output is deployable to ordinary static hosting, currently framed around GitHub Pages. The same static output model underlies local and hosted access. (PRD FR-18, lines 299–305; Addendum §C.4, lines 235–237)
- **Repository/workflow surface**: adding a **Source**, **Indicator**, **Visual**, or **Report**, and changing a **Dataset** schema, happen through defined repository workflows and exemplars rather than an application configuration UI. (PRD FR-22–FR-24, lines 351–373; §5, lines 377–388)
- The sources establish **web** as the reader-facing form factor. They explicitly exclude multi-device handoff but do not select desktop, tablet, mobile, or responsive priorities. (PRD §2.3, line 82)
- duckdb-wasm runs client-side on all pages, using static same-origin parquet. The selected single-threaded EH bundle requires no special headers; static hosting remains viable. (PRD FR-18, lines 297–305; Addendum §A.2, lines 19–35; §A.3, lines 37–45; §C.4, lines 219–237)

### Information architecture and content objects

The PRD's controlled vocabulary is binding; UX copy and documentation should preserve these names rather than introduce synonyms. (PRD §3, lines 93–114)

- **Source**: configured origin of data, public or private, with its own cadence, licence, attribution, and acquisition method. Public sources run automatically; private sources are supplied manually. (PRD glossary, line 97; FR-1–FR-4, lines 120–152)
- **Snapshot**: immutable copy of a source at a point in time. **Raw archive**: all snapshots and the only durable layer. (PRD glossary, lines 98–99; FR-5–FR-6, lines 156–174)
- **Dataset**: wide, typed table for one question area, built from snapshots and queried by visuals. Its documentation describes the dataset and columns; each **Indicator** carries unit, definition, provenance, and required attribution. (PRD glossary, lines 100–101 and 111; FR-7–FR-9, lines 178–203)
- **Warehouse**: disposable collection of datasets, rebuilt fully from the **Raw archive** each pipeline run. (PRD glossary, line 101; FR-6, lines 168–174)
- **Visual**: purpose-built rendering that answers one question against a dataset. Purpose-built describes the artifact; **Agent-authored** describes who produced it. (PRD glossary, lines 102–104; Addendum §C.2, lines 202–209)
- **Report**: topic-level standing analysis composed of visuals. A report declares its visuals and their arrangement. (PRD glossary, line 105; FR-15, lines 256–265)
- **Annotation**: contextual data—such as series breaks, definition changes, or external events—joined to visuals rather than hardcoded as coordinates. (PRD glossary, line 109; FR-16, lines 267–272)
- **Freshness**: how current a source or report is relative to that source's cadence. (PRD glossary, line 110; FR-2 and FR-9, lines 132–137 and 197–203)
- **Pipeline run**: fetch → snapshot → warehouse build → report generation → publish. (PRD glossary, line 112)
- **Build profile**: public or private; controls included reports and data. (PRD glossary, line 113; FR-17, lines 274–281)
- **Assertion**: a source-level plausibility check such as row count, expected columns, or expected latest-period advancement. (PRD glossary, line 114; FR-9, lines 197–203)
- **Data interface**: stable contract for delivering rows to a visual and registering that visual on a report. (PRD glossary, line 107; FR-10, lines 211–220)
- **Visual language**: shared, revisable cross-visual conventions consumed by the authoring agent. Render-time conventions such as colour, type, and spacing are shared tokens where applicable. (PRD glossary, line 108; FR-13, lines 237–244)
- Navigation is explicitly anchored by the **Homepage** leading to **Reports**. A single site manifest for navigation is identified as prior-art worth adopting, but not stated as a settled requirement. (PRD §4.7, lines 309–323; Addendum §B.4, lines 146–154)

### Functional requirements with direct UX impact

- **FR-1–FR-4 — source lifecycle:** source identity, acquisition, cadence, licence/attribution, public/private status, scheduled or on-demand runs, and manual file placement form the information needed for source status and builder workflows. (PRD lines 120–152)
- **FR-8 — semantic and provenance content:** datasets and columns are documented; indicators include units, definitions, provenance, and attribution. This content is available to agents and can support reader trust. (PRD lines 189–195)
- **FR-9 — plausibility signals:** collapsed row counts, missing columns, and late source periods can be flagged; lateness is evaluated against the publication schedule rather than ingestion cadence. Failed assertions do not stop the pipeline. (PRD lines 197–203)
- **FR-10–FR-11 — visual data states:** the data contract must define successful rows, zero rows, query failure, and detectable schema breakage. No-data must be explained to the reader rather than appearing as blank or broken content. Visuals render against declared mock schemas before real data exists. (PRD lines 211–227)
- **FR-12–FR-14 — visual-authoring constraints:** no chart/visualization library or chart-type selection is allowed; visuals may differ arbitrarily; shared conventions remain centralized and revisable; extending to new kinds cannot break existing visuals. (PRD lines 229–250)
- **FR-15–FR-16 — report composition:** reports declare their visuals and arrangement; annotations are data and update without visual-code changes. (PRD lines 256–272)
- **FR-17 — privacy propagation:** source privacy automatically propagates to reports. A public build contains neither private reports nor their data. A report may be made more private explicitly but never less private than its sources. (PRD lines 274–281)
- **FR-25 — optional exploration:** the pre-composed experience remains sufficient without interaction; opted-in reports permit client-side exploration without navigation away or server round trips. (PRD lines 283–291)
- **FR-18 — access and delivery:** the static web output works through a one-command local server and remote static hosting; all pages query data in-browser through duckdb-wasm. (PRD lines 295–305)
- **FR-19–FR-21 and FR-26 — trust/status:** the Homepage exposes all pipeline stages and source freshness; stale sources, failed source checks, and failed stages are visibly marked; reports state data dates; suspect data is published but marked; homepage age becomes a fault when older than the expected run interval; “never ran” differs from “ran and succeeded.” (PRD lines 309–347)
- **FR-22–FR-24 — extension workflows:** each extension act and dataset schema change has an explicit workflow based on repeated shape, shared implementation, and a working exemplar. (PRD lines 351–373)

### States, errors, permissions, trust, accessibility, and privacy

#### Explicit states and errors

- Pipeline stages are **fetch**, **snapshot**, **warehouse build**, **report generation**, and **publish**. At minimum the UX distinguishes failed, never ran, and succeeded; the source does not define additional stage states. (PRD glossary, line 112; FR-19 and FR-26, lines 315–345)
- A **Source** can be fresh or stale relative to its cadence/release calendar and can pass or fail **Assertions**. Suspect data still publishes and must remain visibly marked. (PRD FR-9, lines 197–203; FR-19–FR-21, lines 315–335)
- The **Homepage** itself can be current or fault-level stale based on its generated timestamp and expected pipeline interval. An old page cannot continue to imply healthy status after a failed pre-publish run. (PRD FR-26, lines 339–347)
- A visual query can return rows, return no rows, fail, or become incompatible after a dataset schema change. The no-row condition must be explained; schema incompatibility must be detectable rather than silently wrong. (PRD FR-10, lines 211–220)
- The source identifies “published but marked” suspect data as the v1 rule. Rebuilding a failing source from its last passing snapshot was considered more correct but deferred. (PRD FR-21 note, lines 330–337)
- Scheduled runs can be delayed or dropped; the next run recovers idempotently. Runs can also be triggered on demand for the whole pipeline or one source. (PRD FR-3, lines 139–146; Addendum §A.4, lines 47–53)

#### Permissions and privacy

- There is a single operator, no authentication, no multi-user permission model, and no multi-device handoff. (PRD §2.2–§2.3, lines 76–82)
- Privacy originates at the **Source** and propagates structurally through derived reports and data. **Build profiles** determine public/private output; a report-level declaration can only increase privacy. (PRD FR-17, lines 274–281; NFR-3, line 396)
- Private data never leaves Yann's machine or enters the public repository. Public snapshots are available to repository cloners. (PRD FR-4, lines 148–152; FR-5, lines 160–166)

#### Trust and provenance

- Trust information explicitly available includes source freshness, failed assertions, pipeline stage outcome, site generation time, report data date, indicator unit/definition/provenance, source licence/attribution, and immutable snapshots. (PRD FR-1, lines 124–130; FR-5, lines 160–166; FR-8–FR-9, lines 189–203; FR-19–FR-21 and FR-26, lines 315–345)
- The specific trust failure pulse is built to catch is a technically green run that publishes stale or structurally wrong data. A crashing run already announces itself; silent success is the dangerous case. (PRD §4.7, lines 309–313)
- Prior art suggests freshness metadata could include “as of”, source, and snapshot hash, but the addendum records this only as a convention worth adopting, not a committed UX requirement. (Addendum §B.4, lines 146–154)

#### Accessibility and adjacent concerns

- The approved sources state no accessibility conformance target, assistive-technology behavior, keyboard behavior, focus behavior, reduced-motion behavior, or non-colour status-signalling rule.
- The approved sources state no localization or internationalization requirement, despite French macroeconomic data being the MVP topic.
- The approved sources state no offline mode. Reports are static-hosted, but data queries use duckdb-wasm over HTTP and local viewing requires a server. (PRD FR-18, lines 295–305; Addendum §A.3, lines 37–45)
- The approved sources state no notification UX. GitHub may email repository administrators when scheduled workflows are disabled, but that is platform behavior, not a pulse product requirement. (Addendum §A.4, lines 47–53)
- The approved sources state no motion, touch, pointer, keyboard, voice, or other input-modality requirements.

### Voice, brand, and visual directives

- No colors, fonts, shape system, illustration style, logo treatment, or other explicit brand identity is defined in the approved sources.
- The product is repeatedly framed as **dense**, **purpose-built**, **functional and elegant**, and suitable as portfolio evidence. Density is accepted; the reader must not have to assemble an answer manually. (PRD §1, lines 24–28; §1.2, lines 40–47; §2.1, lines 71–74)
- Visuals are **expressiveness-first** and tailored to their question/data/message; there is no fixed chart vocabulary and no chart or visualization library at any layer. (PRD §1.2, lines 43–47; FR-12, lines 229–235)
- Cross-visual tokens for colour, type, and spacing are anticipated as shared render-time artifacts, but no actual values or rules are supplied. Conventions begin close to empty and emerge from real use. (PRD FR-13, lines 237–244)
- Source-defined terminology should remain stable. In particular: use **purpose-built**, not “hand-built/hand-written/hand-authored”; use **Report**, not “dashboard”; distinguish **purpose-built** (artifact) from **Agent-authored** (provenance). (PRD §3, lines 93–114; Addendum §C.2, lines 202–209; §C.5, lines 239–247)
- The PRD explicitly rejects system-wide rules for what individual visuals show—including precision, comparisons, layout, emphasis, magnitude-versus-exactness, annotation as a retention mechanism, and exposure cadence. Those are decided per visual, in session, against real data. (PRD §0, line 16; FR-14 note, line 252; Addendum §C.5, lines 239–249)

### Constraints and non-goals affecting UX scope

- v1 is not a data lab and has no natural-language querying or exploration-to-report promotion path. (PRD §5, lines 377–383)
- v1 has no revision/vintage model, no multi-source datasets, no durable private-data storage, no multi-user operation/configuration/onboarding, no chart library, and no continuously running service. (PRD §5, lines 383–388)
- The v1 vertical slice is one public source, one wide documented/tested dataset, and one French macroeconomic report with several purpose-built visuals; it includes one report with browser exploration, Homepage navigation/status, report freshness, static local/public delivery, and extension workflows. (PRD §7.1, lines 403–418)
- Per-source assertions beyond defaults, annotations-as-data, and a shared cross-visual convention store are **Should** scope. Manual private ingestion and second/third reports are **Could** scope. (PRD §7.2–§7.3, lines 420–429)
- Opening a report must be fast enough to become habitual. No numeric target exists; architecture is expected to define cold-load and time-to-first-readable-figure budgets once the delivery path is chosen. (PRD NFR-6, line 399)
- The system uses duckdb-wasm on every page. The selected single-threaded path trades intra-query parallelism for maximum static-host compatibility. Same-origin parquet is recommended, with roughly 5–50 MB files and year partitioning beyond that range. These may constrain loading and exploration behavior. (Addendum §A.2–§A.3, lines 19–45; §C.4, lines 219–237)
- All candidate site stacks produce static output, and GitHub project pages require correct `/reponame/` base-path configuration. (Addendum §C.4, lines 235–237)
- pulse deliberately keeps the expressive visual layer closed: no adopted framework may constrain or replace purpose-built visual authoring. Fetching, transformation, site build, data delivery, and local serving may be adopted. (PRD §1.3, lines 49–57; Addendum §C.4, lines 215–233)

### Source assumptions, contradictions, unresolved decisions, and notes

#### Tagged assumptions

- **Manual private-data ingestion** is a v1 **Could**, not a Must. (PRD FR-4, line 149; §11, line 478)
- v1 **Datasets** build from only the latest **Snapshot**; revision modelling is a non-goal. (PRD FR-7, line 187; §11, line 479)
- No numeric performance budget is set; “fast enough that opening it is not a decision” is the intent until architecture measures cold load and first readable figure. (PRD NFR-6, line 399; §11, line 480)
- One public **Source** and one **Report** make up the v1 vertical slice. (PRD §11, line 481)
- The journeys are intentionally light because the system has one operator, no authentication, and no multi-device handoff. (PRD §11, line 477)

#### Explicit contradiction

- **Private archive durability:** “Never losing history” is a core archive-first principle, but the v1 private archive exists only on one laptop. The PRD names this as real, deliberate, and unresolved; a backup story is required before the private archive becomes valuable. (PRD §1.2, line 40; §5, line 384; §9, line 459)

#### Unresolved decisions with UX consequences

- **Architecture candidate:** Evidence.dev, Observable Framework, or a general build tool with pulse's conventions. This can affect inherited UI-system behavior, navigation, rendering, and component constraints. (PRD §10, line 465; Addendum §C.4, lines 215–237)
- **Evidence visual wrapping friction:** whether converting authored HTML/SVG into Svelte is mechanical enough for a workflow must be tested with one visual through both candidate paths. (PRD §10, line 466; Addendum §C.3, lines 211–213)
- **Query scope and cross-filtering:** per-visual versus per-report querying is deferred behind the data interface. Cross-filtering is neither required nor excluded; if desired, it affects that choice. (PRD §10, line 467)
- **Local serving specifics** remain architecture's decision. (PRD §10, line 468)
- **Durable private raw storage** is deferred with private ingestion. (PRD §10, line 469)
- **dbt-duckdb external materialization:** a smoke test must confirm external models support expected tests and `ref()` behavior before the pipeline relies on the pattern. (PRD §7.1, line 412; Addendum §A.5, lines 55–65)
- **Framework currency:** Observable Framework investment and Evidence Universal SQL implementation are flagged as uncertain and should be verified before deep adoption. (Addendum §B.5, lines 156–160)

#### Superseded material that UX must not revive

- “Baked JSON by default, wasm opt-in” is superseded by duckdb-wasm on all pages. (Addendum §C.4–§C.5, lines 229–245)
- “Dashboard” is superseded by **Report**. (Addendum §C.5, line 246)
- A flat assumption that pulse must reinvent all layers is superseded by the layer split: only visual authoring is closed. (Addendum §B.2, lines 108–125; §C.4, lines 215–233)
- Prior discovery proposals to freeze visuals or create general rules about figures, precision, comparisons, annotation, or exposure cadence were rejected. (Addendum §C.5, line 249)

#### `[NOTE FOR UX]` inventory

- Neither approved source contains a literal `[NOTE FOR UX]` tag.
- The PRD has a direct UX handoff in the FR-25 note: what in-browser exploration looks like belongs to UX; cross-filtering remains unspecified. (PRD line 291)
- Three `[NOTE FOR PM]` passages constrain UX rather than assign it: visual content/layout/emphasis remains session-specific (PRD line 252); exploration appearance belongs to UX (PRD line 291); and last-known-good fallback was considered but deferred, leaving “publish and mark suspect data” as v1 behavior (PRD line 337).

## UX questions for coaching discovery

These questions are not answered by the sources. They should be elicited from Yann; no answer is implied here.

### Surface and journey closure

1. What device and context dominate UJ-1's brief, habitual check: desktop while reading, phone during conversation, or both? What responsive support is genuinely needed for v1?
2. Does every visit have to begin at the **Homepage**, including deep links/bookmarks, or is “passes through status” a desired navigation tendency rather than a hard routing rule?
3. What topic-level navigation must the Homepage provide for the one-report MVP, and how should that grow when second/third reports arrive?
4. When UJ-3 reveals bad data, does investigation happen inside pulse, in GitHub Actions/repository tooling, or through a handoff link? What minimum diagnostic information must the Homepage expose?
5. Are builder workflows purely agent/CLI conversations, or does any authoring or run-triggering action belong inside the web experience?
6. For UJ-6, is the stranger's experience fully repository/documentation based, or should the public site explain reproducibility and link to the build path?

### Report comprehension and exploration

7. For the French macro report, what real questions and real dataset should drive the first session-specific visual decisions? The PRD deliberately cannot answer this generically.
8. What does “reads the figure in context” require for UJ-1 beyond the visual itself: definition, unit, source, last-updated date, annotation, comparisons, or some subset?
9. What does optional **in-browser exploration** need to accomplish in the MVP report? Which reader question is impossible or inefficient with the pre-composed views alone?
10. Is cross-filtering between visuals useful for that question, or would it add interaction cost without serving the habitual-glance goal?
11. Should an exploration state be shareable, restorable, or reset on revisit? The sources specify no URL/state persistence.

### Trust, status, and recovery

12. What vocabulary should distinguish stale, suspect, failed, never-ran, and homepage-itself-stale states without requiring infrastructure knowledge?
13. How much detail appears at first glance versus on demand for healthy and unhealthy sources/pipeline stages?
14. Where should a report surface suspect-data status in addition to its data date, given UJ-3's requirement to know which figures and reports not to trust?
15. What should a no-row visual explain, and what action—if any—should a reader be offered? What should query failure and schema breakage say differently?
16. If the page cannot initialize duckdb-wasm or fetch parquet, is the whole report unavailable, partially readable, or recoverable? The sources specify the transport but not the degraded experience.
17. Should pulse provide any product notification outside a visit, or is incidental Homepage visibility deliberately sufficient?

### Privacy and public/private framing

18. How should Yann know which **Build profile** he is viewing locally, and which reports/sources are excluded from the public build?
19. Should private status be visible on reports and source status, or is structural exclusion enough?
20. How should the experience guard against portfolio pressure making personally useful but messy/private work less likely, a tension named in the risk register? (PRD §9, line 455)

### Accessibility, language, and platform expectations

21. What accessibility floor is required for the personal MVP: keyboard operation, screen-reader semantics, non-colour status cues, zoom/reflow, reduced motion, and/or a named conformance target?
22. Will labels, data definitions, and source material be English-only, French-only, or mixed? Is localization architecture needed even if v1 ships in one language?
23. Are motion and animation ever useful to explain change, or should the product remain static by default? What reduced-motion behavior is required?
24. Which input modalities need explicit support: keyboard/mouse only, touch, or both?

### Visual identity and voice

25. What should pulse feel like to Yann in three to five adjectives, beyond the source's “dense,” “functional,” “elegant,” “purpose-built,” and “playground” language?
26. Are there existing products, publications, data graphics, or personal artifacts Yann wants pulse to feel adjacent to—or explicitly unlike?
27. Should system-health language read like terse engineering telemetry, calm editorial guidance, or something else? How direct should bad-news copy be?
28. Does the public portfolio site and the private personal tool share one visual identity and voice, or do they need meaningful differences?

### Performance and architecture-dependent UX

29. What cold-load and time-to-first-readable-figure threshold makes opening pulse feel habitual on Yann's actual device/network?
30. What may render before duckdb-wasm finishes: report framing, narrative, last-known metadata, or nothing? The source sets the speed goal but not the progressive-rendering contract.
31. Once architecture selects a framework/UI system, which inherited visual and behavioral defaults are acceptable, and which would constrain the purpose-built visual layer?
