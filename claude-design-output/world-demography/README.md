# World demography — design handoff

The design for the `world-demography` report: six purpose-built visuals, four
report controls, nine state treatments and three viewports, authored against the
published Parquet rather than against representative arrays.

The interactive canvas is at
<https://claude.ai/artifact/H9H3KGygpfNurxiq4ST5J5>. Everything it holds is
copied into `design/` here, so this directory is the digest-lockable handoff and
the canvas is where it is read.

**Not approved.** Approval is a separate human action against this directory's
digest.

## What is here

| Path | What it is |
| --- | --- |
| `design/Main.dc.html` | The whole report at 1280px, interactive: working period presets and custom range, working observation-year slider, working country selection, working scenario selection, click-to-select on every figure. |
| `design/Narrow.dc.html` | 740px, smartphone landscape. Figures 1, 3 and 6 drawn, because those three carry the three distinct layout behaviours; the reflow rules are stated on the artboard. |
| `design/Zoom.dc.html` | 400% magnification, 320 CSS px of content. One-column reflow, in-frame horizontal scroll for the plot, disclosure open by default. |
| `design/States.dc.html` | Ready, loading, empty, suspect, stale, query error, schema incompatibility, render error, shared engine failure — plus slot-local isolation and what survives an asynchronous refresh. |
| `design/Decisions.dc.html` | The decisions and their reasons. **Binding on implementation once approved.** |
| `design/canvas.json` | The canvas layout. |
| `design/prototype-fixtures.js` | **Design-only. Do not port.** A compact extract of the published Parquet, built solely so the artboards could be drawn from real rows. |
| `contracts/*.contract.js` | Six Visual Contract v1 declarations with real boundary fixture rows. |
| `fixtures/*.json` | The same boundary rows as data, one file per dataset-and-visual pairing. |
| `handoff-manifest.json` | The manifest. |

## The six visuals

| Visual | Row spine | Also reads |
| --- | --- | --- |
| `world-population-path` | `world-demography-indicators` | `world-demography-scenarios` |
| `country-population-paths` | `world-demography-indicators` | `world-demography-scenarios` |
| `change-composition` | `world-demography-indicators` | — |
| `migration-flows` | `world-demography-indicators` | `european-immigration-flows`, `european-emigration-flows` |
| `fertility-longevity` | `world-demography-indicators` | `healthy-life-expectancy` |
| `age-structure` | `world-demography-age-structure` | — |

Three visuals read more than one dataset. Each declares its spine on its slot
and the rest as unreferenced queries; the report joins them in its own mapping
before the visual is called. The spine is the UN indicator table in every case
except the pyramid, because it is the only table with every country and every
year: a country Eurostat does not cover, or a year WHO has not reached, still
produces a row, so the figure can draw an absence rather than dropping the
country without saying so.

## Why the design is shaped this way

**The world is read first, and read differently.** It has no migration
component — migration nets to zero globally — and it is the only subject whose
projection range is worth showing in full. Its figure is the only one with the
scenario band drawn at full width.

**Estimates and projections share one axis, and are drawn apart.** Solid to the
boundary, dashed after, with a labelled rule at the join. The boundary is read
from `series_kind`, never from a remembered year, so it moves with the revision.
Because dash is spoken for, country identity is colour plus a direct label at
the line's end, never a dash pattern and never colour alone.

**The projection is a range of two kinds, and only one of them is a
likelihood.** The 95% prediction interval is the shaded band and the default.
The named scenarios are thin dashed lines with direct labels, because a filled
band reads as a probability and `Constant fertility` — which reaches 18.19bn at
2100 — carries none. The probabilistic `Mean` is never offered on a population
plot: it publishes fertility alone.

**Values reach the reader as marks.** Chips sit beside the selection line inside
each plot, stacked apart when series crowd and flipped left past the middle. No
figure has a readout beneath it. Units are what a reader says out loud — 8.09bn,
66.4M, +0.87% a year, −3.7‰ — and axes are scaled to match.

**Components are drawn, not stacked.** The provider's population change is
accounted for by natural change and net migration but is not their sum; the
residual reaches about 4,862 people for a country. Two filled areas from zero
and a dashed change line say "these account for it". A stack would say "these
add to it", and would be wrong.

**Where a series stops, the mark says so.** The United Kingdom's Eurostat flows
end in 2019 and the line ends there with "to 2019" at the terminus; its chip at
a later year reads "arrivals — not published". A country outside Eurostat's
collection gets a panel with no plot, a ✕, and a sentence naming the collection
it falls outside — and its UN net migration, so the panel still answers
something. Healthy life expectancy ends at 2021 the same way.

**Prose carries only what no mark can.** Every sentence was tested against
"could a figure on this screen show this instead?" and deleted where the answer
was yes. What remains is definitional, or a warning about the data: the two
migration providers not reconciling, France excluding its overseas departments,
the world having no migration component, the five-year grain putting the
working-age split at 15 and 65 rather than 18. No sentence states a value, a
direction, a ranking or a period. The world's peak year and the 2100 range
appear as marks and in the Decisions artboard, never in copy that ships.

## What the reader controls

Two standard, two added.

1. **Represented period** — four presets plus independent From and To selects;
   changing either moves the selection to Custom.
2. **Observation year** — a slider labelled "Observation year — or click any
   point on a figure", plus click-to-select on every figure. The age-structure
   figure exists because of this control: it renders the pyramid at whatever
   year is selected anywhere on the page.
3. **Countries compared** — removable chips carrying each country's series
   colour, plus a select to add one. Default France, Germany, United Kingdom.
   The legend reads "N of 184 selectable", which is where the universe rule is
   discoverable.
4. **Projection shown** — 95% interval, high and low fertility, all published
   bounds, or medium only.

One figure-local control: the components figure switches between people and per
1,000 population, because that changes what that figure measures and nothing
else.

**Departure recorded.** The standard observation control is a slider. With 151
years on the axis a slider alone is imprecise, so it is paired with a live
numeric readout and with click-to-select, which is how a reader reaches an exact
year.

## The country universe rule lives here

The datasets publish all 237 countries and areas the provider covers, because
which countries exist is a fact about the provider. Narrowing that list is a
reader's preference, so the report applies it: offer the countries whose
population reached 300,000 in the latest estimate year, which is 184 of the 237.
That keeps Iceland, Malta, Luxembourg and the French overseas departments and
drops Andorra, San Marino, Tuvalu and Nauru.

## Licence note that reaches the page

Healthy life expectancy is the only measure here not under an open licence. WHO
grants use for public health purposes with attribution, bars commercial use, and
requires prior written authorization to modify. Its panel carries its own
provenance line rather than sharing the report's, and the footer states it.
Every other measure is CC BY 3.0 IGO or Eurostat's reuse policy.

## Open questions carried to approval

- **Per 1,000 or per cent.** The components figure defaults to people and offers
  per 1,000, the provider's unit and the conventional one. A percentage, if
  wanted, belongs in the dataset rather than divided by ten in a visual.
- **How many countries at once.** The design reads well to about six; past that
  the direct labels at the line ends collide. A cap, or small multiples past a
  threshold, is worth deciding before implementation.
- **The overseas departments.** The provider publishes Guadeloupe, Martinique,
  French Guiana, Mayotte and Réunion separately, and its France excludes them.
  They are selectable; whether that needs saying beyond figure 2's caption is
  open.
