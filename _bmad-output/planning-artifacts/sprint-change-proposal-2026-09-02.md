# Sprint Change Proposal — 2026-09-02

## 1. Issue Summary

Story 1.6 revealed that the published `insee-cpi/monthly` dataset is too narrow for a standing, multi-angle French inflation report. It contains exactly 367 monthly observations of one headline CPI level and its provider-published monthly and annual movements. It cannot show how food, energy, or housing costs diverge from headline inflation, nor support a defensible component analysis.

This is a new report-content requirement discovered during the required real-data design session, not a failure of the archive, transformation, browser catalog, or Visual Contract. The requested report focus is French consumer-price inflation: headline CPI, food, energy, and actual rents. It explicitly excludes residential property sale prices for this release: CPI covers rents paid by tenants, whereas property prices require a separate source and cadence.

Evidence: the committed snapshot and `dataset.json` declare only provider series `011814056`, `011814057`, and `011814058`. The INSEE Base-2025 catalogue provides category series under eCOICOPv2, including food, energy, and actual-rent categories, and publishes annual CPI basket weights. The present snapshot cannot be extended retrospectively; selection expansion requires a new immutable acquisition.

## 2. Impact Analysis

### Epic impact

Epic 1 remains viable and retains its goal. No new epic is necessary. The report must wait for an enriched, source-compatible CPI publication. Stories 1.7–1.9 remain correctly sequenced after the report and do not require acceptance-criterion changes.

### Story impact

Stories 1.3 and 1.4 remain done as valid first vertical-slice work; do not rewrite their history or replace their snapshot. Story 1.5 remains valid Visual Contract conformance evidence and keeps its current real-row implementation unchanged.

Insert a new Story 1.5a between 1.5 and 1.6: **Expand the INSEE CPI Dataset for Category Analysis**. Move Story 1.6 back only as a dependency ordering matter: it remains backlog until Story 1.5a publishes its enriched dataset. No rollback is needed.

### Artifact impact

- **Epics and sprint status:** add Story 1.5a and make it the immediate next backlog item.
- **Source selection and acquisition:** revise the INSEE source scope; select exact, mutually comparable Base-2025 IPC series and acquire a new snapshot. Preserve the existing one unchanged.
- **Dataset contract and transformation:** add documented category level and annual-change indicators plus annual basket weights, or publish a new source-owned analysis dataset if that keeps the existing headline dataset clearer. The implementation spec must choose one after consumer-impact review; no old consumer may break.
- **Tests and fixtures:** add exact-series, comparable-geography/population/measure, monthly-grain, metadata, replay, and contribution-method validation. Ordinary tests stay offline.
- **Report design:** Claude Design starts only after the enriched fixture schema and representative real values are available. Story 1.6 remains the report composition and visual-wiring story.

The PRD, architecture spine, and UX artifacts need no text change. They already permit additive indicators in a single-source dataset, require report-specific design against real data, and prohibit an undeclared multi-source dataset. The current UX artifacts contain no actionable requirements.

## 3. Recommended Approach

**Direct adjustment — moderate scope.** Add Story 1.5a within Epic 1, then resume Story 1.6. This preserves the completed source/contract work, keeps the report a coherent single-source CPI analysis, and avoids prematurely adding an international comparison source.

The new story begins with a recorded series-selection gate. It must select an all-households, France, Base-2025 *IPC* (not IPCH) headline and category set with compatible measure, geography, frequency, revision history, and licence/attribution. It must include:

- headline CPI and its existing monthly/year-on-year movements;
- food, energy, and actual rents paid by tenants as the minimum categories;
- annual category and headline CPI basket weights needed for a transparent component view; and
- any additional category only when it is comparably defined and materially helps the report.

The story must define its decomposition precisely. It may show source-provided weight/context and a documented index-based contribution calculation, but must not label an approximation as INSEE’s official contribution or make causal claims. It must state limitations caused by annual weights, rebasing, and category coverage.

**Effort:** medium. **Risk:** medium: category-series comparability and the contribution methodology require validation, but the provider, access pattern, archive model, and source slice already exist.

### Alternatives considered

- **Rollback Stories 1.3–1.5:** not viable. It would discard working archive and contract infrastructure without simplifying the additive source change.
- **Proceed with the current three indicators:** not viable for the chosen report objective; it would force decorative rather than question-driven visuals.
- **International comparison now:** defer. It needs at least one additional source or harmonized cross-country dataset and is independently shippable once this report establishes its single-source inflation analysis.
- **Property sale-price analysis now:** defer. It is not CPI and likewise requires another source and cadence.

## 4. Detailed Change Proposals

### Epics — insert new Story 1.5a

**OLD:**

```markdown
### Story 1.5: Render Real Data Through the Visual Contract
...
### Story 1.6: Compose and Explore the French Macroeconomic Report
```

**NEW:**

```markdown
### Story 1.5: Render Real Data Through the Visual Contract
...
### Story 1.5a: Expand the INSEE CPI Dataset for Category Analysis

As Yann,
I want a documented, source-compatible CPI dataset covering headline inflation, food, energy, and actual rents with the weights needed to interpret their relationship,
So that the French inflation report can explain divergence and composition rather than merely repeat a headline rate.

Acceptance criteria include: an approved Base-2025 IPC selection record; a new immutable snapshot; a source-owned, additive published contract with category metadata and comparable semantics; transparent, tested contribution methodology and limitations; full offline replay and consumer-compatibility evidence; and no modification of the prior snapshot or silent break to existing consumers.

### Story 1.6: Compose and Explore the French Macroeconomic Report
```

**Rationale:** makes the report’s data prerequisite explicit and reviewable while preserving completed work.

### Sprint status — add prerequisite tracking

**OLD:**

```yaml
1-5-render-real-data-through-the-visual-contract: done
1-6-compose-and-explore-the-french-macroeconomic-report: backlog
```

**NEW:**

```yaml
1-5-render-real-data-through-the-visual-contract: done
1-5a-expand-the-insee-cpi-dataset-for-category-analysis: backlog
1-6-compose-and-explore-the-french-macroeconomic-report: backlog
```

**Rationale:** gives the new dependency a stable identifier without changing existing IDs or completed history.

### Source and data artifacts — implementation handoff

**OLD:** current `insee-cpi` selection, source declaration, snapshot, fixture, transformation, tests, and manifest recognize only three headline series.

**NEW:** the Story 1.5a spec must name each approved provider series and update only the source-local declaration, selection record, acquisition fixture, decode expectation, dbt model(s), semantic metadata, source assertions, published manifest(s), and offline tests required for the additive category contract.

**Rationale:** preserves source ownership, immutable replay, and report-neutral semantics. It also gives Claude Design declared fixture rows rather than provider-coupled raw data.

## 5. Implementation Handoff

**Classification:** Moderate — backlog reorganization plus one additive source/schema change.

1. Developer agent: create and implement Story 1.5a, including official-series selection, new snapshot, additive source contract, reproducible fixtures, and verification.
2. Yann + Claude Design: after Story 1.5a publishes fixture schema and representative values, decide the standing questions, comparisons, precision, visual treatments, layout, and exploration controls. Claude Design returns no-library HTML/SVG/CSS/JS plus declared fixture schemas.
3. Developer agent: resume Story 1.6 and wire the approved designs to real parameterized queries through Visual Contract v1, preserving design rendering logic.
4. Future backlog: international comparison and property-sale prices are separately scoped source/report extensions; neither blocks this change.

## 6. Approval Gate

On approval, update `epics.md` and `sprint-status.yaml`, create the Story 1.5a implementation spec, and begin its source-selection/research gate. Do not begin Claude Design work or Story 1.6 implementation until the enriched dataset contract is published and verified.
