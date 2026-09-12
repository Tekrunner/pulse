import assert from "node:assert/strict";
import { createDataClient } from "../../site/data/client.js";

const catalog = {
  schemaId: "pulse.browser-data", schemaVersion: "1.0.0",
  extensions: { parquet: "parquet.duckdb_extension.wasm" },
  datasets: {
    "insee-cpi-monthly": {
      datasetId: "insee-cpi-monthly", logicalTable: "insee_cpi_monthly", datasetContractVersion: "1.0.0",
      schema: [{ name: "period", type: "DATE" }, { name: "cpi_index", type: "DECIMAL(12,2)" }],
      contentSha256: "a".repeat(64), representedPeriod: { start: "1996-01-01", end: "2026-07-01" },
      semanticMetadata: {}, visibility: "public", parquet: "datasets/insee-cpi-monthly/dataset.parquet",
      adapters: [{
        version: "1.0.0", owner: "Report owner", removal_condition: "All old queries migrated",
        logical_table: "insee_cpi_monthly_v1", column_mapping: { period: "period", old_value: "cpi_index" },
      }],
    },
    "insee-cpi-category-analysis": {
      datasetId: "insee-cpi-category-analysis", logicalTable: "insee_cpi_category_analysis", datasetContractVersion: "1.0.0",
      schema: [{ name: "period", type: "DATE" }, { name: "food_index", type: "DECIMAL(12,2)" }],
      contentSha256: "b".repeat(64), representedPeriod: { start: "1998-01-01", end: "2026-07-01" },
      semanticMetadata: {}, visibility: "public", parquet: "datasets/insee-cpi-category-analysis/dataset.parquet",
    },
  },
};

let cancelled = 0;
let rejectFirst;
let queryStarted;
const firstQueryStarted = new Promise((resolve) => { queryStarted = resolve; });
let statementCount = 0;
let queryRows = [{ period: "2026-07-01", value: 100 }];
const viewQueries = [];
const connection = {
  async query(sql) { viewQueries.push(sql); },
  async prepare() {
    statementCount += 1;
    if (statementCount === 1) {
      return { query: () => new Promise((_, reject) => { rejectFirst = reject; queryStarted(); }), async close() {} };
    }
    return { query: async () => ({ toArray: () => queryRows }), async close() {} };
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
assert.equal(
  (await client.getDataset("insee-cpi-category-analysis")).logicalTable,
  "insee_cpi_category_analysis",
);
const aborted = client.query("insee-cpi-monthly", "SELECT * FROM insee_cpi_monthly", { signal: controller.signal });
await firstQueryStarted;
controller.abort();
await assert.rejects(aborted, (error) => error?.name === "AbortError");
assert.equal(cancelled, 1);
assert.equal(terminated, 0, "request cancellation must not terminate the shared worker");
assert.equal(client.resources.connection, connection, "request cancellation must retain the shared connection");
assert.deepEqual(await client.query("insee-cpi-monthly", "SELECT * FROM insee_cpi_monthly"), [{ period: "2026-07-01", value: 100 }]);
assert.ok(viewQueries.some((sql) => sql.includes('VIEW "insee_cpi_monthly_v1"') && sql.includes('"cpi_index" AS "old_value"')));
assert.deepEqual(
  await client.query("insee-cpi-monthly", "SELECT * FROM insee_cpi_monthly", {
    expectedColumns: ["period", "value"], requireRows: true, mapRow: (row) => ({ ...row, mapped: true }),
  }),
  [{ period: "2026-07-01", value: 100, mapped: true }],
);
await assert.rejects(
  client.query("insee-cpi-monthly", "SELECT * FROM insee_cpi_monthly", { expectedColumns: ["missing"] }),
  (error) => error?.code === "compatibility",
);
await assert.rejects(
  client.query("insee-cpi-monthly", "SELECT * FROM insee_cpi_monthly", {
    expectedColumns: ["period", "value"], mapRow: () => ({}),
  }),
  (error) => error?.code === "compatibility" && error.safeMessage.includes("mapped report data"),
);
queryRows = [];
await assert.rejects(
  client.query("insee-cpi-monthly", "SELECT * FROM insee_cpi_monthly", { requireRows: true }),
  (error) => error?.code === "empty",
);
assert.equal(terminated, 0);
console.log("Client contract passed: cancellation is request-scoped and shared resources remain usable.");
