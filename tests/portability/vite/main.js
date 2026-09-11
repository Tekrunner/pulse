import { createDataClient } from "../../../site/data/client.js";
import { renderLineVisual } from "../../../site/visuals/line.js";
import { FIXTURE_ROWS } from "../../../workflows/add-visual/template/fixture.js";
import { renderVisualTemplate } from "../../../workflows/add-visual/template/visual.js";
import "../../../site/design/tokens.css";
import "../../../workflows/add-visual/template/styles.css";

if (new URLSearchParams(location.search).has("design-foundation")) {
  window.renderDesignFoundationVisual = renderVisualTemplate;
  document.querySelector("#app").append(renderVisualTemplate({
    rows: FIXTURE_ROWS,
    display: { title: "Foundation indicator" },
    provenance: { label: "Synthetic source", updatedAt: "2026-09-11" },
  }));
} else {

const rows = [{ period: "2024-Q1", value: 101.2 }, { period: "2024-Q4", value: 104.4 }];
class WorkerStub { terminate() {} }
const connection = {
  async query() {},
  async prepare() { return { async query() { return { toArray: () => rows }; }, async close() {} }; },
  async close() {}, async cancelSent() {},
};
const DuckDB = {
  ConsoleLogger: class {}, DuckDBDataProtocol: { HTTP: 4 },
  AsyncDuckDB: class { async instantiate() {} async connect() { return connection; } async registerFileURL() {} },
};
const client = createDataClient({
  bundle: { mainWorker: "worker.js", mainModule: "duckdb.wasm" }, manifestUrl: new URL("manifest.json", location.href), Worker: WorkerStub, DuckDB,
  fetch: async () => ({ ok: true, json: async () => ({ schemaId: "pulse.browser-data", schemaVersion: "1.0.0", extensions: { parquet: "parquet.duckdb_extension.wasm" }, datasets: { "fixture/macro": { datasetId: "fixture/macro", logicalTable: "fixture_macro", datasetContractVersion: "1.0.0", schema: [{ name: "period", type: "VARCHAR" }, { name: "value", type: "DOUBLE" }], contentSha256: "a".repeat(64), representedPeriod: { start: "2024-Q1", end: "2024-Q4" }, semanticMetadata: {}, visibility: "public", parquet: "macro.parquet" } } }) }),
});
const result = await client.query("fixture/macro", "SELECT period, value FROM fixture_macro ORDER BY period");
const visual = renderLineVisual(result, { label: "Portable fixture", unit: "index points" });
visual.querySelector("output").dataset.portableReady = "";
document.querySelector("#app").append(visual);
}
