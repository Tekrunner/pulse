# Pulse agent instructions

## Layer responsibilities

Pulse has four layers. Each owns one question, and may assert only what it can
answer from what it owns.

| Layer | Owns | Its assertions answer |
| --- | --- | --- |
| Source — `sources/`, `snapshots/` | the provider's response, preserved faithfully | is this response well formed, complete and current? |
| Dataset — `datasets/`, `publish/` | analytical meaning over one snapshot | is this table correctly typed and grained, and complete against the classifications this package declares? |
| Report — `site/reports/` | the questions asked, and everything a reader sees | do the published rows reach the reader intact, and do the joins this report performs hold? |
| Visual — `site/visuals/` | marks on a surface | does what was drawn match the rows and display inputs it was handed? |

Knowledge flows one way. A report may know everything beneath it; nothing
beneath may know that a particular consumer exists. Three consequences:

- **A lower layer never names a consumer or its choices.** Say "a consumer", not
  "the report" or "the choropleth". A guarantee written around one consumer
  breaks when that consumer changes its mind, which turns a presentation
  decision into an edit of an acquisition or analytical contract.
- **Where a guarantee must cover a subset, name what the provider or the world
  lacks, not what a consumer wants** — an area the provider discontinued, a
  series it has never split. An exclusion is a fact; an inclusion is a
  preference.
- **A property spanning two packages belongs to whoever joins them.** dbt cannot
  `ref` across packages, so copying one package's contents into another's test
  creates a second source of truth that drifts in silence.

The test when it is unclear: if satisfying a decision at one layer requires
editing a layer beneath it, the lower guarantee was written around a consumer.
Fix the guarantee rather than propagate the change.

`tests/runtime/test_layer_isolation.py` fails the build on the commonest
symptom — a source or dataset naming a consumer, or a visual reaching for
storage — but it is a backstop for the principle above, not a statement of it.

## Verification strategy

- `uv run --no-sync pulse verify` is the single full-repository gate. It runs the status and workflow contracts, the full Python suite, and `npm run verify:frontend`.
- Do not run the full Python suite or `npm run verify:frontend` immediately before or after `pulse verify`; that duplicates work already performed by the aggregate gate.
- During implementation, run the smallest relevant tests. Expand to the affected subsystem only after focused tests pass.
- For report browser work, use `npm run browser:test:report -- <report-id> --project=chromium` during iteration. Omit the project option when focused cross-browser evidence is needed; reserve the complete `npm run browser:test` for the final aggregate gate.
- After the final code change and consolidated review fixes, run `uv run --no-sync pulse verify` once. Rerun it only when it fails or later changes invalidate the result.
- Use `npm run verify:frontend` by itself only when intentionally verifying the frontend without the Python, status, and workflow gates.
- Main-push CI runs the repository half and the production-artifact half on separate runners, then deploys only after both pass. `pulse verify --repository-only` is the CI split point; it is not a replacement for the complete local gate.

## Tests over published data

Scheduled workflows commit new snapshots and publications, and the browser
suite gates the artifact that deploys. A test that restates the latest release
fails that gate at the next refresh while saying nothing about whether the code
is right. So a test over committed or published data never hardcodes what a
release determines: row counts, content hashes, represented-period edges, the
latest value or period, "the last estimated year", or which series stops early.

- Python tests read the expectation from the committed manifest:
  `publish/public/data/<id>/dataset.json`, `snapshots/public/<source>/*/snapshot.json`.
  A rebuild is checked against the committed hash, not a literal one.
- Browser specs query the served Parquet with `publishedRows` from
  `tests/browser/published-data.mjs` and format the expectation themselves, so
  the page and its expectation never share an implementation.
- Absence, negative and other edge paths are found in the data. When the current
  release has none, record a test annotation and return; never fail on it.
- Literals stay where the input is frozen: recorded source fixtures, synthetic
  rows, pure functions, status scenarios, and numeric-boundary evidence, which is
  a one-time record pinned to its `dataset_revision` and is never repeated in a
  live spec.

## Cross-client skills

- Project-owned `pulse-*` skills are canonical under `.agents/skills/`; never edit their generated `.claude/skills/` mirrors directly.
- After changing or adding a Pulse skill, run `uv run --no-sync python scripts/sync_agent_skills.py --write` and commit both trees.
- `pulse verify` checks that every Pulse skill mirror is present and byte-identical. BMad-installed skills remain managed by the BMad installer in both trees and are outside this synchronizer.

# Commit messages

Keep commit messages concise. No wall of text that no one will bother reading.
