# INSEE CPI snapshot contract

This public acquisition package fetches one combined, credential-free INSEE BDM
SDMX 2.1 `StructureSpecificData` response. Its provider-native scope is declared
in `source.yaml`: sixteen Base-2025 IPC series covering the headline index and
changes, food, energy, actual rents paid, annual basket weights, and official
broad-component contributions.

Those series are acquisition scope, not a declaration of any Pulse dataset.
Their INSEE IDs and French catalogue titles are retained exactly so the adapter
can reject missing, unexpected, duplicate, or renamed provider series before a
snapshot is accepted.

The adapter preserves every `Series` and `Obs` attribute as a string-valued
Parquet column. It repeats series attributes on each observation without
analytical renaming, typing, calculation, classification, or report shaping.
The machine-readable `snapshot-contract.yaml` requires the source-native fields
`IDBANK`, `TITLE_FR`, `TIME_PERIOD`, `OBS_VALUE`, `FREQ`, `REF_AREA`, and
`UNIT_MULT`; compatible provider attribute additions are retained and change the
observed-schema hash.

`source_data_date` is derived transparently from the greatest provider
`TIME_PERIOD`: monthly `YYYY-MM` becomes the first day of that represented month.
Acquisition time remains a separate runtime timestamp. The adapter sends the
SDMX StructureSpecific XML media type, uses a 30-second timeout, and needs no
credentials.

INSEE normally advances the monthly part of this scope after the final CPI
release. Reuse is under Licence Ouverte / Open Licence 2.0 with the attribution
declared in `source.yaml`. The only durable output owned here is faithful raw
Parquet plus the generic immutable `snapshot.json` manifest.

Dataset selection, output columns, analytical types, formulas, basket-weight
alignment, contribution interpretation, tests, and report limitations belong to
independent packages under `datasets/`. `pulse source acquire insee-cpi` never
loads or executes them.
