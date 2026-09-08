# Pulse publication storage policy

The versioned inter-package APIs are public source snapshots and public dataset
publications. Parquet payloads are tracked by Git LFS; their JSON manifests are
tracked by normal Git. Site builds copy catalogued Parquet and compile browser
and report catalogs into the artifact. Those site copies and catalogs are
disposable and are regenerated from the canonical publications.

Reports own stable identity, nested routes, dataset and column lineage, local
parameterized queries, exploration state, provenance, measurement, accessible
tables, and slot error boundaries. Visual Contract v1 modules accept validated
rows plus display and provenance inputs and return DOM/SVG; they do not fetch,
query, route, or derive dataset URLs.
