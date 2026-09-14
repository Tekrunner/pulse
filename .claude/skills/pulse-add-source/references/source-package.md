# Source package contract

Create `sources/<source-id>/source.yaml`, `snapshot-contract.yaml`, `acquire.py`, and a short `source-contract.md` evidence record. The directory and `id` must match. Declare visibility, non-secret provider configuration, fetch cadence, machine-readable publication schedule, expected advancement, licence, and attribution. Credentials and unsafe upstream content must never enter declarations or diagnostics.

The evidence record must cite the authoritative provider page used for cadence and publication timing, note when it was checked, state the provider timezone, and explain the conversion into the declared deadline and UTC workflow cron. Do not infer a publication day, grace period, or cron from a word such as monthly. If the provider does not publish enough detail, ask the user for an explicit scheduling decision and record it; otherwise halt. Never copy numbers from the neutral assets or another source.

`acquire(configuration, *, fixture, live)` returns `pulse.sources.AdapterAcquisition`. It must read the fixture without network access. With neither a fixture nor `live=True`, it must fail safely. Provider-specific access, decoding, scope checks, and assertions stay in the package; shared runtime receives only the neutral result.

For API/non-file providers, use `format: parquet`, declare provider-native required fields, and return faithful rows. `compatible_additions: true` retains additions and makes them visible through the observed-schema hash. Missing or incompatible required fields reject the candidate.

For downloadable-file providers, use `format: original-file`, an empty `required_fields` mapping, and return `rows=None`, exact `original_bytes`, plus a safe `original_filename`. The archive keeps the bytes unchanged under a `raw.<extension>` artifact. Decode only transiently when needed to derive the represented date or assertions; do not substitute reserialized bytes.

Assertions are a tuple of unique `{"check": <non-empty name>, "passed": <boolean>}` objects. They test source plausibility, not analytical meaning. Failed assertions are persisted with the snapshot and surface as source `suspect`; structural or decoding incompatibility raises a sanitized acquisition error and creates no partial snapshot.

Use `source_data_date` for the provider-represented date, never acquisition time. Use only HTTPS provenance URLs. Exact retry content no-ops; the same acquisition identity with different bytes fails; a genuinely new observation uses a new logical-run key even if its bytes match an older observation.
