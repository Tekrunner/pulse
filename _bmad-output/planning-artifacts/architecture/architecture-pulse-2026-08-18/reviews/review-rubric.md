# Reviewer Gate — Good-spine rubric walk

## Gate verdict

**Conditional fail — no critical findings, 2 high, 3 medium, 1 low.** The spine now covers most feature-altitude divergence points with enforceable boundaries and a credible operational envelope. It should not be finalized until the remaining FR-6 semantic change and status-projection ownership contradiction are resolved. The medium findings are bounded fixes, not reasons to reopen the paradigm.

## Tiered findings

### High 1 — AD-1 still changes the PRD's full-rebuild meaning without acknowledging an upstream override

- **Checklist dimensions:** covers the driving spec; no invariant contradicts its parent requirement; real divergence points fixed.
- **Evidence:** AD-1 says a one-source run rebuilds only that dataset slice and only the whole-pipeline command rebuilds every slice (spine line 45). The PRD requirement named in `Binds` says the **warehouse**—defined as the collection of datasets—is rebuilt in full from raw on **every pipeline run**. The spine's new “no persisted shared warehouse” model is coherent, but it changes the unit of rebuild and the meaning of pipeline run rather than merely implementing the requirement.
- **Divergence risk:** a downstream source epic can treat source-local publication as a complete pipeline run while report/verification work assumes every published state is a coherent all-dataset rebuild.
- **Disposition: discuss.** Choose one authority explicitly: (a) retain literal FR-6 and make all publication paths rebuild every slice; or (b) adopt source-slice rebuild semantics and update/record the upstream requirement change. Do not keep claiming unqualified FR-6 coverage.

### High 2 — replaceable non-source status has conflicting ownership and persistence rules

- **Checklist dimensions:** each Rule is enforceable and prevents its stated divergence; state ownership; operational/environmental envelope.
- **Evidence:** AD-4 requires a current projection for **every independently executable pipeline**, including well-known non-source pipelines, and the seed stores `status/<pipeline-id>.json` (spine lines 63 and 162). The State convention still says **only per-source** current-status projections are replaceable (line 127). AD-8 then says every default-branch mutation is a source-scoped change through the repository writer, while site builds use a separate latest-wins group (line 99).
- **Divergence risk:** implementers have no single answer for where report-generation/site/publish projections live, whether they may be replaced, and which job is allowed to update them. A site job cannot both avoid default-branch mutation and persist a current publish projection under the rules as written.
- **Disposition: autofix after ownership choice.** Make the State convention agree with AD-4, then bind non-source projection storage and writer. If publish failures are represented only by site-validity expiry rather than a persisted failed projection, state that exception explicitly.

### Medium 1 — the cross-visual convention store is not an owned contract

- **Checklist dimensions:** fixes all real divergence points; covers FR-13; no whole structural concern left implicit.
- **Evidence:** AD-11 binds shared semantic tokens, and the diagram mentions “Theme and authoring conventions,” but no Rule or structural seed owns the authoring-guidance store, its consumer, or its revision path. Runtime tokens cover only the subset of conventions expressible as shared artifacts.
- **Divergence risk:** separate visual epics can create different agent guidance files or hardcode non-token conventions while each still satisfies AD-11.
- **Disposition: autofix.** Name one application-owned visual-language/conventions artifact, require the authoring workflow to consume it, and retain the PRD rule that it starts minimal and changes without mass visual edits.

### Medium 2 — FR-4 is claimed as bound, but the manual private-ingestion boundary is absent

- **Checklist dimensions:** covers the driving spec's capabilities; scope dimensions decided or explicitly deferred.
- **Evidence:** AD-5 binds FR-4 and thoroughly governs downstream private builds, but neither its Rule nor the seed fixes the PRD's input boundary: private data is manually placed in a known local location and never enters the public repository. The seed has profiles and snapshot roots but no private inbox/input contract.
- **Divergence risk:** private-source implementations can read arbitrary user paths, copy files directly into snapshots, or introduce incompatible per-source manual commands.
- **Disposition: defer explicitly or autofix.** Because private ingestion is a v1 Could, either add a Deferred item with a revisit condition or bind one ignored local inbox plus the common CLI acquisition path.

### Medium 3 — exact stack “currentness” is not fully evidenced and already drifts at patch level

- **Checklist dimensions:** named technology is verified-current and fit before binding.
- **Evidence:** the Stack gives exact pins but no per-entry verification date/source or compatibility tuple. An official uv release/package surface already shows 0.12.1 while the spine pins 0.12.0; Python 3.13.14 is supported but no longer the newest feature line. An older exact pin can be deliberate, but the artifact does not distinguish “latest checked” from “compatibility-selected seed.” Observable is correctly protected by a fresh pre-pilot recheck, while the rest of the stack lacks an equivalent provenance/recheck rule. Sources checked: [uv official releases](https://github.com/astral-sh/uv/releases), [Python 3.13.14 release](https://www.python.org/downloads/release/python-31314/), [dbt-duckdb on PyPI](https://pypi.org/project/dbt-duckdb/), and [DuckDB releases](https://github.com/duckdb/duckdb/releases/).
- **Divergence risk:** downstream work may “upgrade to latest” independently or assume the table is a tested compatibility set when it is only a set of individually existing versions.
- **Disposition: autofix.** Label the table as a cold-start compatibility seed, record one verification date/tuple in the companion memory, and require the first lockfile/CI smoke test to ratify it. Exact patch freshness then belongs to the lockfiles, not repeated architecture edits.

### Low 1 — one operational acceptance term remains subjective

- **Checklist dimensions:** enforceability.
- **Evidence:** AD-4 requires each visual slot to expose “reliable suspect-data impact” (line 63), but “reliable” has no contract or test meaning. Nearby fields—represented period, dependencies, provenance—are concrete.
- **Divergence risk:** implementations can make incompatible claims about which visuals are affected by suspect inputs.
- **Disposition: autofix.** Replace “reliable” with a computable lineage rule: derive impact from declared dataset/column dependencies, with an explicit unknown/conservative state when precision is unavailable.

## Complete checklist walk

| Good-spine criterion | Result | Assessment |
| --- | --- | --- |
| Fixes the real divergence points for the level below and misses none | **Partial** | Strong coverage of artifact boundaries, source ownership, privacy, browser dependencies, workflows, testing, and deployment. The convention-store and private-input boundaries remain silent. |
| Every AD Rule is enforceable and prevents its stated divergence | **Partial** | Most rules are testable. Status-projection ownership conflicts across AD-4, AD-8, and State; “reliable suspect-data impact” is underspecified. |
| Nothing in Deferred permits incompatible downstream choices | **Pass** | Each deferred choice has a local owner or a revisit gate. External-publish fallback and multi-source data explicitly block silent per-unit choices. Cross-filter/query topology remains safely behind the report/data-client boundary. |
| Named technology is verified-current and fit | **Partial** | Versions exist and are plausibly compatible, and Observable has a fresh pilot recheck. The overall exact tuple lacks auditable fit provenance; uv has already moved one patch beyond the listed seed. |
| Ratifies rather than contradicts brownfield reality | **N/A / not demonstrated** | The spine identifies planning artifacts, not an existing codebase, as its sources. This is acceptable if Pulse is greenfield. If implementation already exists, a code-ratification pass is still required before finalization. |
| Covers all capabilities of its driving spec | **Partial** | Nearly all claimed FR/NFR areas are now represented, but FR-6 semantics are changed and FR-4's manual input boundary plus FR-13's authoring-convention store are not actually fixed or deferred. |
| Preserves inherited parent-spine invariants | **N/A** | No inherited parent spine is declared. |
| Every owned structural dimension is decided, deferred, or open | **Pass with status caveat** | Data lifecycle, privacy/security, execution, testing, browser/runtime, deployment/environments, provider/cost, accessibility, performance, and reversibility are present. Non-source status persistence is present but internally inconsistent rather than absent. |

## What is working and should remain stable

- The named pipes-and-filters/static-artifact paradigm carries the system shape cleanly.
- AD-2, AD-5, AD-7, AD-10, and AD-11 set unusually clear tool, privacy, visual, deployment, and accessibility boundaries.
- The pilot/exit seam is an enforceable phase gate rather than a vague recommendation.
- The manifest/state model is comprehensive once its projection ownership contradiction is repaired.
- Deferred items are disciplined: each is bounded by a trigger and does not authorize competing implementations today.
- The structural seed is minimal enough to remain seed while showing the important ownership boundaries.

## Gate condition

Resolve both High findings before setting `status: final`. The Medium findings can be handled through small Rule/seed additions and a stack-provenance entry; none requires a new architecture paradigm or broad redesign.
