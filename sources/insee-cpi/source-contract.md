# INSEE CPI source contract

This public source acquires one combined, credential-free INSEE BDM SDMX 2.1
`StructureSpecificData` response for these provider series:

- `011814056` — *Indice des prix à la consommation - Base 2025 - Ensemble des ménages - France - Ensemble hors Tabac*
- `011814057` — *Indice des prix à la consommation - Base 2025 - Variation mensuelle - Ensemble des ménages - France - Ensemble hors Tabac*
- `011814058` — *Indice des prix à la consommation - Base 2025 - Glissement annuel - Ensemble des ménages - France - Ensemble hors Tabac*

These are INSEE's French catalogue names, retained without renaming.

## Category-analysis extension

The additive `insee-cpi/category-analysis` publication is built only from the
expanded Base-2025 IPC snapshot. It contains food (`011813717`, `011813719`),
energy (`011813864`, `011813866`), actual rents paid, COICOP 04.1
(`011815633`), annual food/energy/rent weights (`011814578`, `011814509`,
`011815638`), and INSEE's official broad annual contributions for food,
services, manufactured products, and energy (`011813664`–`011813668`, excluding
the unused `011813667`). Weights are annual values per 10,000 and carry their
reference year; they are not monthly observations. The producer uses the latest
weight reference year no later than the represented calendar year.

INSEE does not publish a compatible monthly COICOP-04.1 rent annual change in
this selection. `actual_rent_annual_change_pct` is therefore Pulse-derived as
`(rent_index[t] / rent_index[t-12] - 1) * 100`; its companion
`actual_rent_pulse_contribution_pct_points` is `rent_weight / 10000 * derived
rent annual change`. It is a transparent approximation, is not an official
INSEE contribution, and makes no causal claim. The separately named official
broad contributions remain provider values. Monthly output ends at the latest
common complete required provider period; it never imputes asynchronous releases.

The adapter preserves every `Series` and `Obs` attribute as a string-valued Parquet
column. It repeats series attributes on each observation without renaming, typing,
calculating, or classifying them. Compatible new attributes are therefore retained
and change the observed-schema hash. `IDBANK`, `TITLE_FR`, `TIME_PERIOD`, and
`OBS_VALUE` are required; missing declared series, unexpected series, changed
provider names, malformed XML, and unflattenable attribute collisions fail before
archive acceptance.

`source_data_date` is derived transparently from the greatest provider
`TIME_PERIOD`: monthly `YYYY-MM` becomes the first day of that represented month.
Acquisition time remains a separate runtime timestamp. The adapter sends the SDMX
StructureSpecific XML media type, uses a 30-second timeout, and needs no credentials.

INSEE normally advances these series monthly after the final CPI release. Reuse is
under Licence Ouverte / Open Licence 2.0 with the attribution declared in
`source.yaml`. The durable adapter output is faithful raw Parquet plus the generic
Pulse snapshot manifest; analytical typing and semantics begin only downstream.

`uv run pulse source replay insee-cpi` is offline and snapshot-only. It rejects LFS
pointer stubs, creates faithful disposable landing data, then invokes the source-local
dbt-duckdb project to publish the wide monthly Base-2025 dataset. An invalid candidate
does not replace the selected output; a contract-valid candidate with failed assertions
is published with a `suspect` result in `dataset.json`.
