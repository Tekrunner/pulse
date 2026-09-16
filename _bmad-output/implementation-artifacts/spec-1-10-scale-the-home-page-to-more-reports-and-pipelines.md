---
title: 'Story 1.10: Scale the Home Page to More Reports and Pipelines'
type: 'feature'
created: '2026-09-16'
status: 'done'
baseline_commit: '7507674'
review_loop_iteration: 0
context: ['_bmad-output/implementation-artifacts/epic-1-context.md']
---

> Recorded after the work, not before it. The intent was settled on an approved
> design canvas rather than in a frozen spec, and this file exists so the change
> leaves the same trace in the backlog as every story around it. Treat the
> Acceptance Criteria in `epics.md` as the contract; this is the code map and
> the reasoning behind it.

## Intent

**Problem:** The home page carried the right information in the wrong shape. It
was styled in the pilot shell vocabulary while the reports had moved to the
design foundation established in Story 2.1, so the door did not look like the
rooms behind it. Structurally it stacked two flat lists, and pipeline health
already outweighed navigation by volume at 14 pipelines against 2 reports while
carrying the least information per row — every row a full-height disclosure
card, all of them reading identically when healthy. Every report added roughly
three more pipelines, so the layout degraded with use.

**Approach:** Adopt the report design foundation for the shell, give reports
cards that say something on their own, and turn pipeline health into a dense
board a reader narrows rather than scrolls. Keep the DOM contract Story 1.7's
tests assert, so the change is layout and not semantics.

## Boundaries & Constraints

**Always:** Every expected pipeline stays in the catalog beneath the board;
filtering hides rows and never removes one. Report cards render from the report
catalog alone — the catalogs stay independently read, and losing status costs a
reader the caveat, never the link. Report qualification reuses `qualifyReport`
and `qualificationLine` rather than restating the wording, so the home page and
the report page cannot drift. State stays carried by the marker glyph and the
state word, with colour additive. Each row value carries its own label, because
the column header is hidden below 900px and a bare date names nothing.

**Never:** No new field on the report catalog — cards show only what it already
declares. No interpretation of a failure: a diagnostic is rendered verbatim from
the sanitized code, stage, message and retryability the runtime wrote, because
nothing downstream can explain a failure the runtime did not explain itself. No
bespoke disclosure widget or ARIA table — the existing `details`/`summary`
pattern keeps the platform's keyboard behaviour and the heading inside the
summary. No change to `--color-accent` or any shared role that would restyle a
report.

## Code Map

- `site/data/home.js` -- rewritten. `pipelineItem` makes the `summary` itself
  the grid row; `labelled()` gives each cell a hidden label; `filterControl`
  reuses the reports' segmented-control pattern (native radios, so the group's
  keyboard behaviour is the platform's); `qualifyCard` is the third pass that
  joins both catalogs and is the only thing lost when status fails.
- `site/style.css` -- the `.site-index` block rebuilt on the `.pulse-report`
  vocabulary. `.pipeline-board` uses `overflow: clip` rather than `hidden`:
  `hidden` establishes a scrollport, and a scrollport that never scrolls strands
  the sticky header in normal flow.
- `site/index.md` -- standfirst and the same-origin sentence removed; the `h1`
  moved into the component so the masthead is one unit.
- `tests/browser/pilot.spec.js` -- the 26 existing homepage tests pass unedited.
  Six added for the filter, the qualification, and the self-labelling columns.

## Known Deferrals

- A one-line description per report would earn its place on a card but needs a
  new field in the report catalog and its validator.
- `qualificationLine` renders the retained period as `2026-07` inside sentences
  that otherwise say "July 2026"; `system:site` reports "Latest usable output:
  None yet" above a valid deployment date. Both pre-date this story and are
  reproduced faithfully rather than fixed here.
