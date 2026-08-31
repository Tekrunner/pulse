# INSEE CPI source contract

This public source acquires one combined, credential-free INSEE BDM SDMX 2.1
`StructureSpecificData` response for provider series `011814056`, `011814057`,
and `011814058`. The declaration retains their provider IDs and French catalogue
names.

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
