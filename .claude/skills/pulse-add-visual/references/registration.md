# Registration and runtime boundary

Use a lowercase kebab-case visual ID. Reject a collision with any existing renderer, contract, report visual declaration, or generated/public artifact before creating files.

For each visual:

- add `site/visuals/<visual-id>.contract.js` with Visual Contract `1.x`, consumer and display schemas, inputs exactly `rows`, `display`, and `provenance`, real declared-schema fixture rows, validation, and focused cleanup ownership;
- add `site/visuals/<visual-id>.js` as local DOM/SVG drawing code with no chart library, SQL, DuckDB, Parquet/storage URL, route, framework global, data fetch, or shared-client shutdown;
- adapt report-owned query rows explicitly, including decimal conversion and null handling, before calling the visual;
- register the ID, contract version, dataset ID, and exact columns in the owning report declaration, and update report lineage for every queried column;
- expose the visual's accessible data equivalent, provenance, parameterized query, and named state behavior on the actual report route;
- preserve sibling visuals when schema/render failures are local, and keep shared-engine failure distinct.

Use the application-owned Visual Contract v1 compatibility boundary. A major change needs human approval and either atomic migration of every consumer or an application-owned compatibility adapter. Do not introduce a visual-owned adapter or shared role. Shared runtime/design changes require evidence from an independent second consumer and must not restyle or break unrelated reports.
