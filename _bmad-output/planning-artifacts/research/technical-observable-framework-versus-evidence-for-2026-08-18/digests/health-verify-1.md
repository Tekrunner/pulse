# Health claims — fresh-context verification

## Scope and method

Fresh verification of four load-bearing health claims from `health-r1-1.md` and `health-r2-1.md`. No overall candidate recommendation is made. I recomputed default-branch history from the repositories' Git objects, checked stable-package publication timestamps in the official npm registry, inspected Evidence's `next` branch topology, and bounded the Notebook Kit negative finding to official Observable/GitHub material. Commit quarters use UTC author timestamps, matching GitHub's displayed commit-author dates. “Human authors” consolidates obvious aliases and excludes `github-actions[bot]`; it is not a contributor-impact measure.

Accessed: **2026-08-18**.

## Verification results

### A. Default-branch commit cliffs and recent author concentration — VERIFIED

**Observable Framework (`main`).** The quarterly counts reproduce exactly: 2024-Q1 **392**, Q2 **161**, Q3 **108**, Q4 **53** (714 total); 2025-Q1 **3**, Q2 **4**, Q3–Q4 **0** (7 total); 2026-Q1 **9**, Q2 **3**, Q3 through 2026-08-18 **0**. Thus the stated 2024→2025 reduction is **99.0%**. The concentration claim also holds: of the 19 `main` commits dated 2025-01-01 onward, **18 are authored by Mike Bostock** and one by Lucas Cherkewski; Mike is the sole author in 2025-Q1, 2026-Q1, and 2026-Q2.

- **Source:** [observablehq/framework default-branch commit history](https://github.com/observablehq/framework/commits/main/)
- **Publisher:** Observable / observablehq on GitHub
- **Source date:** commit history 2024-01-01 through 2026-08-18; repository snapshot 2026-08-18
- **Accessed:** 2026-08-18

**Evidence (`main`).** The quarterly counts also reproduce exactly: 2024-Q1 **917**, Q2 **958**, Q3 **1,121**, Q4 **1,664** (4,660 total); 2025-Q1 **528**, Q2 **19**, Q3 **11**, Q4 **124** (682 total); 2026-Q1 **17**, Q2 **0**, Q3 through 2026-08-18 **0**. The stated 2024→2025 reduction is therefore **85.4%**. After the Q1-2025 cliff, the human pool consolidates to **2, 3, 5, and 3 people** in 2025-Q2, Q3, Q4, and 2026-Q1 respectively, after obvious aliases are merged and automation excluded. Recent commits are indeed concentrated around the GitHub identities corresponding to `hughess`, `Winterhart`, and `zachstence`, with a small number of other authors.

- **Source:** [evidence-dev/evidence default-branch commit history](https://github.com/evidence-dev/evidence/commits/main/)
- **Publisher:** Evidence / evidence-dev on GitHub
- **Source date:** commit history 2024-01-01 through 2026-08-18; repository snapshot 2026-08-18
- **Accessed:** 2026-08-18

**Correction/caveat:** The quarterly commit numbers are verified. Exact “unique author” values depend on GitHub-login resolution and alias consolidation; raw Git names overcount Evidence authors such as Sean Hughes, Zach Stence, Archie Wood, and Emanuele Bardelli. The digest already disclosed this limitation, and the concentration conclusion survives it.

### B. npm/release cadence and latest-version dates — DISPUTED IN ONE COUNT; OTHERWISE VERIFIED

The latest-version observations are exact:

- `@observablehq/framework` latest is **1.13.4**, published **2026-03-02T21:48:49.487Z**. Stable 2024 releases comprise **14 major/minor feature candidates and 5 patches**; 2025 has **3 patches**; 2026 through the access date has **1 patch**. No stable major/minor release appears after **1.13.0 on 2024-11-13**.
- `@evidence-dev/evidence` latest is **40.1.8**, published **2026-02-06T16:07:30.925Z**. The 2025 and 2026 counts reproduce as **1 major/minor + 12 patches** and **0 + 1 patch**, respectively.

However, Evidence's 2024 feature-candidate total is **19, not 18**. The round-2 table omitted stable **39.1.0**, published **2024-07-19T14:44:46.200Z**. Correct Evidence 2024 quarterly major/minor counts are **7, 8, 2, 2** (not 7, 8, 1, 2); the patch counts **11, 10, 12, 13** are correct. This arithmetic correction does not alter the observed move from dense 2024 releases to sparse patches in 2025–2026.

- **Source:** [npm registry document for `@observablehq/framework`](https://registry.npmjs.org/%40observablehq%2Fframework)
- **Publisher:** npm registry; package publisher Observable
- **Source date:** package timeline through 2026-08-18; latest version published 2026-03-02; registry metadata modified 2026-04-06
- **Accessed:** 2026-08-18
- **Source:** [npm registry document for `@evidence-dev/evidence`](https://registry.npmjs.org/%40evidence-dev%2Fevidence)
- **Publisher:** npm registry; package publisher Evidence
- **Source date:** package timeline through 2026-08-18; latest version published and metadata modified 2026-02-06
- **Accessed:** 2026-08-18

### C. Evidence `next` is an orphan, one-commit OSS snapshot with no release/default switch — VERIFIED

`next` contains exactly **one commit**, `2824f0c`, authored by Evidence on **2026-08-17T15:36:25-04:00**. Its message says it is a “Snapshot of the Evidence OSS surface as of 2026-08-17,” that “History starts here,” and that subsequent changes will sync from the internal repository. `git merge-base main next` yields no common ancestor. No tag contains the commit, the npm package timeline has no publication after 2026-02-06, and the repository-advertised `HEAD` still resolves to the same commit as `main`, not `next`. The status “real reset artifact, but not yet a released or default public line” is accurate as of the access time.

- **Source:** [Evidence initial `next` import commit](https://github.com/evidence-dev/evidence/commit/2824f0cd17c92a91bc0a6c3f73efcc6f911ed217)
- **Publisher:** Evidence / evidence-dev on GitHub
- **Source date:** 2026-08-17; branch/default/tag snapshot 2026-08-18
- **Accessed:** 2026-08-18

**Correction/caveat:** “Orphan” is verified in the Git-graph sense (no common ancestor with `main`), not as a claim that the branch lacks organizational ownership. “No release” means no containing Git tag/release and no corresponding npm publication as of 2026-08-18.

### D. Notebook Kit overlaps Framework but is not officially declared its replacement — VERIFIED AS A BOUNDED NEGATIVE FINDING

Observable's official Notebooks 2.0 page directly describes Notebook Kit as open-source tooling for **file-based workflows**, **static-site generation**, **self-hosting/continuous deployment**, a **Vite plugin**, and integration with **custom web applications**. Those are material overlaps with Framework roles. The same page labels the work a **Technology Preview** and frames it around notebooks. A bounded search of official Observable pages and `observablehq` repositories found no statement that Notebook Kit replaces, supersedes, or deprecates Framework, and no Framework-to-Notebook-Kit migration path.

- **Source:** [Observable Notebooks 2.0 Technology Preview](https://observablehq.com/notebook-kit/)
- **Publisher:** Observable
- **Source date:** undated live documentation; snapshot 2026-08-18
- **Accessed:** 2026-08-18

**Correction/caveat:** Preserve the digest's careful wording: capability overlap is directly supported; “replacement” is not. Absence of a statement is necessarily bounded to the official surfaces searched and the access date. It does not establish future intent or prove that engineering effort migrated from Framework.

## Correction ledger

| Claim | Verdict | Required correction |
|---|---|---|
| A. Commit cliffs/concentration | Verified | None; retain alias/login caveat. |
| B. npm/release cadence | Disputed in one count | Evidence 2024 stable major/minor feature candidates: **19**, with **2 in Q3**, because `39.1.0` was omitted. |
| C. Evidence `next` reset | Verified | Clarify “orphan” as Git topology and “no release” as of 2026-08-18. |
| D. Notebook Kit overlap/no replacement statement | Verified, bounded | Do not convert overlap or silence into an official succession claim. |
