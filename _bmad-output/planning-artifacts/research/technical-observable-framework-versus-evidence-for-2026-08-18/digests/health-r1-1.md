# Observable Framework vs Evidence — health and trajectory (round 1)

## Scope and method

This digest compares only project health and trajectory for Observable Framework and Evidence Core as candidate report-site substrates. It covers the prior 24–36 months, with emphasis on the most recent six months: release cadence, commit direction, maintainer concentration, issue/PR responsiveness, dependency freshness, organizational backing, product direction, and migration of activity to other products or repositories. It does not make the overall substrate recommendation.

Research was conducted on 2026-08-18 using primary sources only: official GitHub repositories, commit/release/issue/discussion pages, and official product/blog pages. GitHub's contributor graph did not expose its underlying values in the retrieved HTML, so contributor concentration is described conservatively from named authors/committers in releases and recent commit history rather than asserted as a precise percentage. Repository counts are point-in-time snapshots and can change.

## Findings

### Claim 1 — Observable Framework has moved from feature development to low-frequency maintenance, but is not abandoned

- **Claim:** Framework launched in February 2024 and accumulated a substantial feature train through v1.13.0 (including DuckDB-WASM/runtime work). The visible cadence then stepped down: v1.13.1 and v1.13.2 were bug-fix patches, v1.13.3 deprecated the `deploy` command, and the latest v1.13.4 release on 2026-03-02 contained dependency/example maintenance only (`tar`, `esbuild`, `mocha`, Python requirements). This is better described as mature/quiet maintenance than abandonment, but there has been no visible feature release since v1.13.0.
- **Source URL/title:** https://github.com/observablehq/framework/releases — “Releases · observablehq/framework”; https://observablehq.com/blog/observable-2-0 — “Observable 2.0”
- **Publisher:** Observable / observablehq GitHub organization
- **Publication date / snapshot date:** launch post 2024-02-15; releases through 2026-03-02; repository snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** High
- **Class:** Direct observation; lifecycle interpretation

### Claim 2 — Framework maintenance is visibly concentrated in two company maintainers

- **Claim:** The recent release record is dominated by Mike Bostock (`mbostock`) and Philippe Rivière (`Fil`): v1.13.4, v1.13.3, v1.13.1, v1.13.0, v1.12.0, v1.11.0, v1.10.x, and v1.9.0 were released by Bostock, while v1.13.2 was released by Fil. Release notes do acknowledge outside contributors, but release ownership and the sampled support responses remain highly concentrated. This creates key-person/organizational-priority exposure even though the project accepts community contributions.
- **Source URL/title:** https://github.com/observablehq/framework/releases — “Releases · observablehq/framework”; https://github.com/observablehq/framework — “observablehq/framework”
- **Publisher:** observablehq GitHub organization
- **Publication date / snapshot date:** releases 2024-06 through 2026-03; repository snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** Medium-high (direction is clear; no defensible percentage was available)
- **Class:** Direct observation; risk inference

### Claim 3 — Framework has evidence of responsive maintainer support, but current backlog signals are weak

- **Claim:** In a December 2024 React 19 breakage, Bostock responded the same day, Fil contributed a fix within two days, and the issue closed via a follow-up PR within four days. A July 2025 Framework Q&A received an answer from Fil the next day. Conversely, the repository snapshot showed roughly 141 open issues and 40 open PRs, and issues opened in March–April 2026 remained open in the retrieved listing. The evidence therefore supports historically fast handling of bounded regressions, not a claim of broad current responsiveness.
- **Source URL/title:** https://github.com/observablehq/framework/issues/1866 — “Framework v1.13 building a broken version of React 19”; https://github.com/observablehq/framework/discussions/2013 — “How to refresh data in a Plot over a Web API”; https://github.com/observablehq/framework/issues?q=is%3Aissue+sort%3Aupdated-desc — “Issues · observablehq/framework”
- **Publisher:** observablehq GitHub organization
- **Publication date / snapshot date:** 2024-12-05 to 2024-12-09; 2025-07-24 to 2025-07-25; issues snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** Medium
- **Class:** Direct observation; bounded responsiveness assessment

### Claim 4 — Observable still backs the ecosystem, but its product roadmap has shifted away from Framework as the center

- **Claim:** Observable's official 2025 review highlights Canvases, verifiable AI, Notebooks 2.0, Notebook Kit, and Notebook Desktop, and says its 2026 plans focus on Canvases, charting, education, performance, and stability across canvases/notebooks/charts/dashboards. Framework remains documented and released, but it is not named as a 2026 investment theme. This is a strategic redirection signal rather than an abandonment announcement.
- **Source URL/title:** https://observablehq.com/blog/observable-2025-year-in-review — “Observable’s 2025 year in review”
- **Publisher:** Observable
- **Publication date / snapshot date:** 2025-12-17
- **Accessed:** 2026-08-18
- **Confidence:** High for stated priorities; medium-high for the inference about relative priority
- **Class:** Direct roadmap signal; inference from omission and emphasis

### Claim 5 — Observable's Framework-specific commercial deployment path was discontinued

- **Claim:** Observable Cloud launched in September 2024 as a hosting/development platform “focused exclusively” on Framework apps, but the same official post now states it was deprecated on 2025-04-15 and no new instances can be created. Framework v1.13.3 subsequently added a deprecation notice to its `deploy` command. This removes a significant organizational/product adjacency around Framework while leaving the open-source static generator available.
- **Source URL/title:** https://observablehq.com/blog/announcing-observable-cloud — “Announcing Observable Cloud”; https://github.com/observablehq/framework/releases — “Releases · observablehq/framework”
- **Publisher:** Observable / observablehq GitHub organization
- **Publication date / snapshot date:** post 2024-09-10, updated 2025-04-15; v1.13.3 released 2025-04-16
- **Accessed:** 2026-08-18
- **Confidence:** High
- **Class:** Direct product-direction signal

### Claim 6 — Evidence Core's activity fell sharply because company effort moved to Evidence Studio; this is explicit, not inferred

- **Claim:** On 2025-07-09, Evidence cofounder/maintainer Archie Wood said focus on the open-source repository was “significantly lower” while the company built Studio, that substantial open-source component code was being reused, and that the team planned to return to make the project compatible with Studio syntax. He also said Studio replaced DuckDB with a ClickHouse-based query engine for multi-user/multi-instance workloads. On 2026-06-09, cofounder Hugh J. Smith said an update with changes clarifying the open-source/paid relationship was coming “very soon”; as of the access date, the retrieved thread contained no substantive follow-up. Evidence Core is strategically redirected and maintained, not simply abandoned, but the promised convergence remains unverified.
- **Source URL/title:** https://github.com/evidence-dev/evidence/discussions/3177 — “Clarify relationship between paid offering and open-source”
- **Publisher:** Evidence maintainers on evidence-dev GitHub
- **Publication date / snapshot date:** opened/answered 2025-07-09; updated 2026-06-09
- **Accessed:** 2026-08-18
- **Confidence:** High
- **Class:** Firsthand maintainer statement; unfulfilled roadmap signal

### Claim 7 — Evidence Core's latest commit/release activity is predominantly security and upkeep, with no main-branch commits visible after February 2026

- **Claim:** The main-branch commit page showed the latest commit on 2026-02-18. The visible December 2025–February 2026 history consisted mostly of CVE/dependency overrides, changesets/releases, removal of Evidence Cloud references, a Studio note, and an install-page cleanup. The latest monorepo release batch on 2026-02-06 was patch-level and largely CVE/dependency work; `@evidence-dev/evidence@40.1.8` was the repository's latest aggregate release. This is a maintenance posture, with a roughly six-month main-branch quiet period at the snapshot date.
- **Source URL/title:** https://github.com/evidence-dev/evidence/commits/main/ — “Commits · evidence-dev/evidence”; https://github.com/evidence-dev/evidence/releases — “Releases · evidence-dev/evidence”; https://github.com/evidence-dev/evidence — “evidence-dev/evidence”
- **Publisher:** evidence-dev GitHub organization
- **Publication date / snapshot date:** commits through 2026-02-18; releases through 2026-02-06; snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** High
- **Class:** Direct observation; lifecycle interpretation

### Claim 8 — Evidence Core maintenance is also concentrated in a small company cohort

- **Claim:** The recent visible commit history is dominated by `hughess`, `Winterhart`, and `zachstence`, plus release automation; the release batch is automation-authored. The broader repository has external contributors and incoming PRs, but recent merging/release authority is concentrated in a small company cohort. Exact concentration cannot be responsibly quantified from the retrieved contributor graph.
- **Source URL/title:** https://github.com/evidence-dev/evidence/commits/main/ — “Commits · evidence-dev/evidence”; https://github.com/evidence-dev/evidence/releases — “Releases · evidence-dev/evidence”
- **Publisher:** evidence-dev GitHub organization
- **Publication date / snapshot date:** 2025-12-15 through 2026-02-18; snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** Medium-high
- **Class:** Direct observation; concentration assessment

### Claim 9 — Evidence's public support surface shows a meaningful responsiveness deficit

- **Claim:** The repository snapshot showed about 250 open issues and 21–22 open PRs. The open-PR list included community PRs from March–December 2025 and January–May 2026. The discussions list showed a March 2026 static-deploy failure unanswered, alongside multiple unanswered 2025–2026 data-source, DuckDB, and UI questions. This does not prove all channels are unresponsive (the project also directs users to Slack), but GitHub responsiveness is weak for a repository-first adopter.
- **Source URL/title:** https://github.com/evidence-dev/evidence/pulls — “Pull requests · evidence-dev/evidence”; https://github.com/evidence-dev/evidence/discussions — “evidence-dev/evidence Discussions”
- **Publisher:** evidence-dev GitHub organization
- **Publication date / snapshot date:** open items dated 2025-03 through 2026-08; snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** Medium-high
- **Class:** Direct observation; support-risk inference

### Claim 10 — Dependency hygiene exists in both projects, but freshness is reactive rather than evidence of feature vitality

- **Claim:** Framework's latest release updated current build/test dependencies (`tar`, `esbuild`, `mocha`) and Evidence's latest release batch patched multiple CVEs and dependency overrides. Both projects therefore retain some dependency/security maintenance. However, these releases should not be counted as evidence of active product evolution. Evidence's public list also contained an unanswered November 2025 question about updating DuckDB, while the company's Studio engine had already moved to ClickHouse.
- **Source URL/title:** https://github.com/observablehq/framework/releases — “Releases · observablehq/framework”; https://github.com/evidence-dev/evidence/releases — “Releases · evidence-dev/evidence”; https://github.com/evidence-dev/evidence/discussions — “evidence-dev/evidence Discussions”; https://github.com/evidence-dev/evidence/discussions/3177 — “Clarify relationship between paid offering and open-source”
- **Publisher:** observablehq and evidence-dev GitHub organizations
- **Publication date / snapshot date:** 2025-07 through 2026-03; snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** High
- **Class:** Direct observation; maintenance-quality interpretation

### Claim 11 — Evidence has active organizational backing, but that backing is now centered on a closed/commercial Studio product

- **Claim:** Evidence's current official site actively markets Studio, repository-defined BI, agents, access control, Git integration, and enterprise capabilities, while labeling “Evidence Core” as open source. The open-source repository itself directs users to Studio as the “new, faster” path. Combined with the maintainer statement, this indicates a live company and continuing reuse of Core, but not equivalent investment in the static open-source substrate.
- **Source URL/title:** https://evidence.dev/ — “Evidence — Business Intelligence as Code”; https://github.com/evidence-dev/evidence — “evidence-dev/evidence”; https://github.com/evidence-dev/evidence/discussions/3177 — “Clarify relationship between paid offering and open-source”
- **Publisher:** Evidence
- **Publication date / snapshot date:** site/repository snapshot 2026-08-18; maintainer statement 2025-07-09, updated 2026-06-09
- **Accessed:** 2026-08-18
- **Confidence:** High
- **Class:** Direct organizational/product signal; investment inference

### Claim 12 — Health/trajectory comparison for the decision, without an overall substrate recommendation

- **Claim:** On health alone, both candidates carry strategic-priority risk. Observable Framework has the stronger evidence of recent package maintenance and historically responsive core maintainers, but its last visible feature train ended in late 2024 and Observable's public roadmap has shifted to Canvases/Notebooks while its Framework-specific Cloud was deprecated. Evidence Core has an even clearer activity drop and weaker GitHub responsiveness; unlike Observable, its maintainer explicitly confirmed the diversion of effort to Studio and a future convergence plan that had not materialized publicly by 2026-08-18. The distinction is therefore **mature/quiet with organizational redirection** for Framework versus **strategically redirected, maintenance-only Core awaiting an announced reset** for Evidence—not “healthy fast-moving project” versus “abandoned project.”
- **Source URL/title:** synthesis of the primary sources above
- **Publisher:** Observable; Evidence; their official GitHub organizations
- **Publication date / snapshot date:** 2024-02 through 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** Medium-high
- **Class:** Comparative synthesis limited to health/trajectory

## Contradictions and how they resolve

1. **Recent releases vs apparent stagnation.** Both repositories have 2026 releases, but their content is overwhelmingly dependency, CVE, documentation, or release automation work. The contradiction resolves as continued maintenance without comparable feature momentum.
2. **Large cumulative release/commit counts vs current health.** Evidence shows 949 GitHub releases and Framework 78, but Evidence is a monorepo whose release page emits many package releases per batch, while cumulative counts mostly reflect earlier activity. These counts cannot be compared directly and do not rebut the current slowdown.
3. **Active companies vs quiet open-source repositories.** Both organizations are visibly active. Their activity has moved to newer products: Canvases/Notebooks for Observable and Studio/agents for Evidence. Corporate health therefore does not imply equal investment in the candidate substrate.
4. **“Not abandoned” vs current support risk.** Security/dependency patches, documentation, and occasional maintainer answers support “not abandoned.” Long open queues, feature-release gaps, and explicit product redirection still create material adoption risk.
5. **Evidence's promised return vs no visible reset.** Maintainers said in July 2025 that they planned to return and in June 2026 that an update was imminent. The public main repository had not resumed visible development by the snapshot date. Treat the future convergence as a lead, not a delivered fact.

## Leads for round 2

- Re-check Evidence's organization, blog, and package namespace for the “exciting changes” promised on 2026-06-09; look for a new repository, branch, package, or license/open-core announcement not indexed in the first pass.
- Retrieve GitHub REST/GraphQL contribution and merge data for both repositories to quantify commits per quarter, unique active maintainers, outside-contributor merge rate, median first-response time, and median PR age.
- Inspect the full tags/releases history around 2024–2025 to establish quarterly feature-vs-maintenance release counts without relying on the first release page.
- Verify current npm publication timestamps and supported Node/Svelte/Vite/DuckDB-WASM versions from registry APIs; npm's public pages returned 403 in this run.
- Check whether Observable Notebook Kit or another Observable repository now incorporates/replaces parts of Framework's static-site role, and whether maintainers describe a supported migration path.
- Check whether Evidence Studio syntax compatibility has landed anywhere outside `evidence-dev/evidence`, particularly `evidence-studio-template`, `markdoc`, or an unpinned new repository.

## What was sought but could not be found

- Precise contributor-concentration percentages: GitHub's contributor graph loaded only its shell, not the values.
- A current, explicit Observable maintainer statement declaring Framework's maintenance status or roadmap. The strategic-redirection conclusion for Framework is therefore an evidence-backed inference, not an announced policy.
- A public Evidence roadmap or delivered artifact corresponding to the June 2026 promised open-source update.
- Reliable npm registry pages for current publication timestamps; the retrieved npm package pages returned HTTP 403.
- Comprehensive issue/PR response-time distributions. The first-round evidence is a bounded sample plus current queue snapshots, not a statistical study.
