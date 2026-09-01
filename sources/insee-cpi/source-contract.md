# INSEE CPI source contract

This public source acquires one combined, credential-free INSEE BDM SDMX 2.1
`StructureSpecificData` response for these provider series:

- `011814056` — *Indice des prix à la consommation - Base 2025 - Ensemble des ménages - France - Ensemble hors Tabac*
- `011814057` — *Indice des prix à la consommation - Base 2025 - Variation mensuelle - Ensemble des ménages - France - Ensemble hors Tabac*
- `011814058` — *Indice des prix à la consommation - Base 2025 - Glissement annuel - Ensemble des ménages - France - Ensemble hors Tabac*

These are INSEE's French catalogue names, retained without renaming.

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
