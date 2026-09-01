import assert from "node:assert/strict";
import { createDataClient } from "../../site/data/client.js";

const catalog = {
  schemaId: "pulse.browser-data", schemaVersion: "1.0.0",
  extensions: { parquet: "parquet.duckdb_extension.wasm" },
  datasets: {
    "insee-cpi/monthly": {
      datasetId: "insee-cpi/monthly", logicalTable: "insee_cpi_monthly", datasetContractVersion: "1.0.0",
      schema: [{ name: "period", type: "DATE" }, { name: "cpi_index", type: "DECIMAL(12,2)" }],
      contentSha256: "a".repeat(64), representedPeriod: { start: "1996-01-01", end: "2026-07-01" },
      semanticMetadata: {}, visibility: "public", parquet: "datasets/insee-cpi/monthly/dataset.parquet",
    },
  },
};

let cancelled = 0;
let rejectFirst;
let queryStarted;
const firstQueryStarted = new Promise((resolve) => { queryStarted = resolve; });
let statementCount = 0;
const connection = {
  async query() {},
  async prepare() {
    statementCount += 1;
    if (statementCount === 1) {
      return { query: () => new Promise((_, reject) => { rejectFirst = reject; queryStarted(); }), async close() {} };
    }
    return { query: async () => ({ toArray: () => [{ period: "2026-07-01", value: 100 }] }), async close() {} };
  },
  async close() {},
  async cancelSent() { cancelled += 1; rejectFirst(new DOMException("Query cancelled", "AbortError")); },
};
let terminated = 0;
class WorkerStub { terminate() { terminated += 1; } }
const DuckDB = {
  ConsoleLogger: class {}, DuckDBDataProtocol: { HTTP: 4 },
  AsyncDuckDB: class { async instantiate() {} async connect() { return connection; } async registerFileURL() {} },
};
const client = createDataClient({
  bundle: { mainWorker: "worker.js", mainModule: "duckdb.wasm" }, manifestUrl: "https://example.test/data/browser-data.json",
  Worker: WorkerStub, DuckDB, fetch: async () => ({ ok: true, json: async () => catalog }),
});
const controller = new AbortController();
const aborted = client.query("insee-cpi/monthly", "SELECT * FROM insee_cpi_monthly", { signal: controller.signal });
await firstQueryStarted;
controller.abort();
await assert.rejects(aborted, (error) => error?.name === "AbortError");
assert.equal(cancelled, 1);
assert.equal(terminated, 0, "request cancellation must not terminate the shared worker");
assert.equal(client.resources.connection, connection, "request cancellation must retain the shared connection");
assert.deepEqual(await client.query("insee-cpi/monthly", "SELECT * FROM insee_cpi_monthly"), [{ period: "2026-07-01", value: 100 }]);
assert.equal(terminated, 0);
console.log("Client contract passed: cancellation is request-scoped and shared resources remain usable.");
