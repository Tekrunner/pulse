# Observable Framework vs Evidence — health and trajectory (round 2 quantification)

## Scope and method

This follow-up quantifies the health signals from round 1. It uses official GitHub REST data for commits reachable from each repository's default branch, official GitHub release records cross-checked against the npm registry timeline, and official repository/product material for the two migration questions.

Commit totals include merge commits. “Unique author” means the GitHub login returned in the commit's `author` object, falling back to the Git author name; aliases can therefore overcount people. “Automation” is a conservative classification whose author/login matched `bot`, `github-actions`, or `dependabot`; automation committed under a human identity is not detected. Empty quarters are explicit zeros. The current quarter is 2026-Q3 through 2026-08-18.

Release classification is deliberately mechanical: stable major/minor releases are **feature candidates**, while stable patch releases are **maintenance candidates**. Semver alone cannot prove release content; it provides a reproducible cadence measure. Round-1 release-note inspection established that the most recent patches were dependency, CVE, bug-fix, documentation, or deprecation work.

## Findings

### Claim 1 — Framework's default-branch commit trajectory collapsed after 2024 and remained concentrated

- **Claim:** Framework recorded 714 commits in 2024, 7 in 2025, and 12 in 2026 through Q2, followed by zero in Q3 through 2026-08-18. That is a 99.0% reduction from 2024 to 2025. The author pool fell from 21 unique authors in 2024-Q1 to one (`mbostock`) in 2025-Q1, 2026-Q1, and 2026-Q2. No author identities matched the automation classifier.

| Quarter | Commits | Unique authors | Automation commits |
|---|---:|---:|---:|
| 2024-Q1 | 392 | 21 | 0 |
| 2024-Q2 | 161 | 13 | 0 |
| 2024-Q3 | 108 | 12 | 0 |
| 2024-Q4 | 53 | 6 | 0 |
| 2025-Q1 | 3 | 1 | 0 |
| 2025-Q2 | 4 | 2 | 0 |
| 2025-Q3 | 0 | 0 | 0 |
| 2025-Q4 | 0 | 0 | 0 |
| 2026-Q1 | 9 | 1 | 0 |
| 2026-Q2 | 3 | 1 | 0 |
| 2026-Q3* | 0 | 0 | 0 |

- **Source URL/title:** https://api.github.com/repos/observablehq/framework/commits?since=2024-01-01T00:00:00Z&until=2026-08-18T23:59:59Z&per_page=100 — “GitHub REST API: observablehq/framework commits” (all pages retrieved)
- **Publisher:** GitHub / observablehq
- **Publication date / snapshot date:** commit history 2024-01-01 through 2026-08-18; snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** High for counts; medium-high for unique-human interpretation
- **Class:** Quantitative repository observation

### Claim 2 — Evidence's default-branch cliff is later but even larger; a Q4-2025 maintenance spike does not restore prior velocity

- **Claim:** Evidence's default branch recorded 4,660 commits in 2024, 682 in 2025, and 17 in 2026-Q1, with zero in Q2 and Q3 through 2026-08-18. The 2025 total was 85.4% below 2024; after 528 commits in 2025-Q1, Q2–Q3 together had only 30. Q4 rose to 124 commits, but round-1 inspection showed that visible late-2025 work was dominated by CVEs, changesets, releases, and removal of Cloud references. The human author pool fell from 11–20 per quarter in 2024 to 2–5 in 2025 and 3 in 2026-Q1.

| Quarter | Commits | Unique authors (all / human) | Automation commits |
|---|---:|---:|---:|
| 2024-Q1 | 917 | 13 / 11 | 27 |
| 2024-Q2 | 958 | 21 / 20 | 18 |
| 2024-Q3 | 1,121 | 15 / 13 | 19 |
| 2024-Q4 | 1,664 | 20 / 19 | 22 |
| 2025-Q1 | 528 | 16 / 15 | 9 |
| 2025-Q2 | 19 | 3 / 2 | 1 |
| 2025-Q3 | 11 | 3 / 3 | 0 |
| 2025-Q4 | 124 | 6 / 5 | 8 |
| 2026-Q1 | 17 | 4 / 3 | 1 |
| 2026-Q2 | 0 | 0 / 0 | 0 |
| 2026-Q3* | 0 on `main`; 1 reset import on `next` | 0 on `main`; 1 on `next` | 0 |

- **Source URL/title:** https://api.github.com/repos/evidence-dev/evidence/commits?since=2024-01-01T00:00:00Z&until=2026-08-18T23:59:59Z&per_page=100 — “GitHub REST API: evidence-dev/evidence commits” (all pages retrieved)
- **Publisher:** GitHub / evidence-dev
- **Publication date / snapshot date:** default-branch history 2024-01-01 through 2026-08-18; snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** High for counts; medium-high for unique-human interpretation
- **Class:** Quantitative repository observation

### Claim 3 — Release cadence quantitatively separates a 2024 feature era from a 2025–2026 maintenance era for both projects

- **Claim:** Framework published 14 stable feature-candidate releases and 5 patches in 2024, then no feature candidate after v1.13.0 on 2024-11-13: 2025 contained three patches and 2026 one patch. Evidence published 18 stable major/minor feature candidates and 46 patches in 2024, then only one minor candidate and 12 patches in 2025, followed by one patch in 2026. For both projects, the last nine quarters show a clear transition from feature cadence to sparse patch cadence.

| Quarter | Framework feature / patch | Evidence major-or-minor / patch |
|---|---:|---:|
| 2024-Q1 | 6 / 3 | 7 / 11 |
| 2024-Q2 | 4 / 1 | 8 / 10 |
| 2024-Q3 | 2 / 1 | 1 / 12 |
| 2024-Q4 | 2 / 0 | 2 / 13 |
| 2025-Q1 | 0 / 2 | 1 / 7 |
| 2025-Q2 | 0 / 1 | 0 / 1 |
| 2025-Q3 | 0 / 0 | 0 / 0 |
| 2025-Q4 | 0 / 0 | 0 / 4 |
| 2026-Q1 | 0 / 1 | 0 / 1 |
| 2026-Q2 | 0 / 0 | 0 / 0 |
| 2026-Q3* | 0 / 0 | 0 / 0 |

- **Source URL/title:** https://registry.npmjs.org/%40observablehq%2Fframework — “npm registry document: @observablehq/framework”; https://registry.npmjs.org/%40evidence-dev%2Fevidence — “npm registry document: @evidence-dev/evidence”
- **Publisher:** npm registry / package publishers Observable and Evidence
- **Publication date / snapshot date:** package timelines through 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** High for dates/counts; medium for feature-vs-maintenance labels because classification is semver-based
- **Class:** Quantitative release observation; reproducible heuristic

### Claim 4 — Official npm data confirms that neither package has published a new version in the last five months

- **Claim:** The current npm version of `@observablehq/framework` is 1.13.4, published 2026-03-02T21:48:49Z. The registry document's package-level metadata was modified 2026-04-06, but no later version appears in the version timeline. The current `@evidence-dev/evidence` version is 40.1.8, published 2026-02-06T16:07:30Z; its registry document was last modified seconds later. At the access date, the latest-version ages were about 169 days for Framework and 193 days for Evidence.
- **Source URL/title:** https://registry.npmjs.org/%40observablehq%2Fframework — “npm registry document: @observablehq/framework”; https://registry.npmjs.org/%40evidence-dev%2Fevidence — “npm registry document: @evidence-dev/evidence”
- **Publisher:** npm registry / package publishers Observable and Evidence
- **Publication date / snapshot date:** latest versions 2026-03-02 and 2026-02-06; snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** High
- **Class:** Official package-registry observation

### Claim 5 — Evidence's promised open-source reset surfaced one day before this research as a real but unreleased orphan branch

- **Claim:** On 2026-08-17 Evidence created a `next` branch with no common ancestor to `main`. Its sole commit is authored as “Evidence” and says: “Snapshot of the Evidence OSS surface as of 2026-08-17. History starts here; subsequent changes sync commit-by-commit from the internal repo.” The branch is therefore the concrete open-source reset promised in June, not merely a renamed legacy branch. However, it contains only one public commit, has no public release, and `main` remains the default branch; renewed public cadence and community responsiveness are not yet demonstrated.
- **Source URL/title:** https://github.com/evidence-dev/evidence/commit/2824f0cd17c92a91bc0a6c3f73efcc6f911ed217 — “Initial import · evidence-dev/evidence”; https://github.com/evidence-dev/evidence/tree/next — “evidence-dev/evidence at next”
- **Publisher:** Evidence / evidence-dev GitHub organization
- **Publication date / snapshot date:** 2026-08-17; branch snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** High
- **Class:** Direct repository migration signal; maturity caveat

### Claim 6 — Notebook Kit now overlaps several Framework roles, but no official source says it replaces Framework

- **Claim:** Notebook Kit is an active, separate open-source repository (312 commits in the current GitHub view) explicitly described as a CLI for building static sites from file-based Observable Notebooks, with a Vite plugin and low-level JavaScript API for custom web applications. Official documentation also gives it build-time Node/Python/R data loaders and continuous-deployment workflows. These capabilities overlap Framework's static generation, file-based/repository workflow, polyglot precomputation, and custom-web integration roles. But Notebook Kit remains labeled a Notebooks 2.0 Technology Preview and is notebook-oriented; no official source found in this round calls it a Framework successor, deprecates Framework in its favor, or offers a Framework-to-Notebook-Kit migration path.
- **Source URL/title:** https://github.com/observablehq/notebook-kit — “observablehq/notebook-kit”; https://observablehq.com/notebook-kit/ — “Observable Notebooks 2.0 Technology Preview”
- **Publisher:** Observable / observablehq GitHub organization
- **Publication date / snapshot date:** technology preview current as of 2026-08-18; repository snapshot 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** High for overlap and preview status; high that no replacement statement was found within the bounded official-source search
- **Class:** Direct capability comparison; negative finding on formal replacement

### Claim 7 — Round 2 changes one part of the round-1 conclusion, but not the comparative health verdict

- **Claim:** Round 2 **partially changes** round 1 for Evidence: “awaiting an announced reset” is now stale because a reset artifact appeared on 2026-08-17. The corrected status is **strategically redirected, with a newly imported open-source `next` surface whose public maintenance/release trajectory is not yet established**. The quantitative history strengthens, rather than weakens, the broader conclusion: Framework's commit count fell 99% from 2024 to 2025 and Evidence's fell 85%, both stopped feature-candidate releases after early 2025, both latest npm versions are five to six months old, and recent authorship is highly concentrated. Notebook Kit demonstrates that Observable's open-source static-site work moved into an adjacent product, but there is no formal Framework replacement statement. Thus round 2 does not reverse the round-1 health comparison; it adds a potentially positive but extremely early Evidence trajectory signal.
- **Source URL/title:** synthesis of the official GitHub and npm sources above
- **Publisher:** Observable; Evidence; GitHub; npm
- **Publication date / snapshot date:** 2024-01-01 through 2026-08-18
- **Accessed:** 2026-08-18
- **Confidence:** High on quantitative trajectory; medium-high on forward-looking interpretation
- **Class:** Comparative synthesis limited to health/trajectory

## Contradictions resolved in round 2

1. **Evidence `pushed_at` in August vs no new `main` commits.** GitHub's repository metadata reflected activity on non-default branches. Events showed an August 17 `legacy` push and creation of `next`; `main` still had no commits after February. The apparent contradiction was branch topology, not a faulty commit count.
2. **Evidence `next` as possible branch rename vs actual reset.** `main...legacy` was identical, while `main...next` had no common ancestor. The sole `next` commit explicitly calls itself an internal-repository snapshot and promises future sync. It is a new history boundary.
3. **Notebook Kit static generation vs Framework's static generation.** The overlap is real and material, but the artifacts target different authoring units (notebook cells/file format versus Framework report/data-app projects). Without an official successor or migration statement, “role overlap” is supported; “replacement” is not.
4. **Evidence's Q4-2025 commit spike vs strategic slowdown.** Q4's 124 commits are far below 2024 quarters and accompanied only by patch releases. The spike is compatible with maintenance batches and does not restore feature cadence.

## Remaining leads

- Monitor `evidence-dev/evidence:next` for the first post-import synchronized commits, README/roadmap changes, public release, default-branch switch, issue migration, and contribution policy. These events will determine whether the reset becomes an active open-source project or a source mirror.
- Inspect the `next` branch's package graph and licenses once the project publishes documentation; the single snapshot commit makes current trajectory metrics meaningless.
- Seek an explicit Observable maintainer statement comparing Framework and Notebook Kit. Capability overlap alone cannot establish support lifetime or migration intent.
- Re-run the quarterly extraction after 2026-Q3 closes; Framework's three Q2 commits and Evidence's one-day-old reset are too small to establish a new trend.

## What was sought but could not be found

- A release, announcement, blog post, or contribution guide explaining Evidence's new `next` branch. The commit message is the only official explanation found.
- A public mapping between Evidence Studio's internal repository and the new open-source surface, including which features remain closed.
- An Observable statement that Notebook Kit supersedes, replaces, or guarantees continued coexistence with Framework.
- A defensible content-level feature/maintenance label for every historical release. The table therefore uses transparent semver categories, not subjective retrospective coding.
