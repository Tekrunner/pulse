import { createDataClient } from "../../../site/data/client.js";
import { renderLineVisual } from "../../../site/visuals/line.js";

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
  fetch: async () => ({ ok: true, json: async () => ({ extensions: { parquet: "parquet.duckdb_extension.wasm" }, datasets: { "fixture/macro": { table: "fixture_macro", parquet: "macro.parquet" } } }) }),
});
const result = await client.query("fixture/macro", "SELECT period, value FROM fixture_macro ORDER BY period");
const visual = renderLineVisual(result, { label: "Portable fixture", unit: "index points" });
visual.querySelector("output").dataset.portableReady = "";
document.querySelector("#app").append(visual);
