# Visual Contract v1

Visual Contract v1 is Pulse's application-owned boundary between a report and a
purpose-built DOM/SVG visual. A visual declares a supported `1.x` contract,
fixture rows and their consumer schema, then receives only validated plain rows,
display input, provenance input, and an optional focused cleanup registration.

Reports own dataset IDs, parameter-bound SQL, routing, and the shared data client.
Visuals must not use SQL, DuckDB, Parquet URLs, routes, Observable APIs, or shell
lifecycle objects. Cleanup may release only resources created outside the returned
DOM subtree; it never closes shared browser resources.

`site/visuals/line.contract.js` is the v1 conformance example. Its renderer is
authored against fixtures and receives real CPI rows through the report adapter
without a renderer change. A breaking major requires an atomic consumer migration
or an application-owned compatibility adapter; individual visuals cannot introduce
one.
