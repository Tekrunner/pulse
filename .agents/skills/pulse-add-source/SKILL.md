---
name: pulse-add-source
description: Add a credential-free public data source to Pulse through faithful acquisition, immutable snapshot archival, assertions, status, and an independent schedule. Use for ingestion and snapshot work; route analytical datasets, indicators, and report-facing output elsewhere.
---

# Add a Pulse source

Finish at a validated immutable source snapshot and public source-status evidence. Do not create or modify datasets, dbt models, analytical types, indicators, reports, visuals, or report-facing Parquet.

1. Establish the provider's public access, reuse rights, attribution, native identity, publication expectation, and whether the upstream is a file or an API/non-file response. Record authoritative provider evidence for cadence and publication timing. A cadence such as "monthly" does not establish a deadline or cron. If rights or scheduling evidence are unresolved, stop and ask rather than inventing values.
2. Read [references/source-package.md](references/source-package.md), then create one registry-free `sources/<source-id>/` package from the matching neutral asset. Use a lowercase kebab-case ID that matches its directory. Do not inspect or copy an unrelated source implementation.
3. Preserve downloaded file bytes with `format: original-file`. For APIs and other non-file responses, emit provider-native rows with `format: parquet`; do not rename, analytically type, calculate, or drop compatible provider fields.
4. Add offline fixtures and source-local assertions. Assertion failures mark the new snapshot suspect but usable; incompatibility rejects it without replacing an earlier snapshot. Keep adapter diagnostics sanitized and require an explicit opt-in for all live access. Every assertion must be answerable from the provider's own response — is it well formed, complete, current — and must never name what a consumer selects, defaults to or draws first. An assertion that lists a report's chosen entities makes a presentation change edit an acquisition contract, which is the coupling this layering exists to prevent; where a subset is unavoidable, declare the exclusion as the provider fact it is (an area the provider has discontinued, a series it has never split) rather than the inclusion as a consumer's preference. Never name a consumer: write "a consumer", not "the report", "the visual" or "the choropleth". `tests/runtime/test_layer_isolation.py` fails the build on a named one, because every coupling found so far announced itself in the comment justifying it.
5. Read [references/scheduling.md](references/scheduling.md), replace every schedule placeholder from cited evidence or an explicit human decision, configure a thin independent workflow, and keep all repository writes on the shared serialized-writer path through the Pulse CLI.
6. Run the gates in [references/verification.md](references/verification.md). Report snapshot identity, format, represented date, assertion state, status visibility, and remaining provider risks.

If the request also needs analytical or report-facing data, complete or identify the snapshot prerequisite, then route that work to the separate Pulse dataset workflow. Never create a dataset implicitly.
