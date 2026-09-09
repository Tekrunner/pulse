import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { copyCatalogedParquet } from "./public-data-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const observable = process.platform === "win32" ? "observable.cmd" : "observable";
const catalog = resolve(root, "site/data/browser-data.json");
const reportCatalog = resolve(root, "site/data/reports.json");
const statusCatalog = resolve(root, "site/data/status.json");
const catalogBuild = spawnSync("uv", ["run", "pulse", "catalog", "build", "--output", catalog, "--reports-output", reportCatalog, "--status-output", statusCatalog, "--parquet-prefix", "datasets"], {
  cwd: root,
  stdio: "inherit",
});
if (catalogBuild.error) throw catalogBuild.error;
if (catalogBuild.status !== 0) process.exit(catalogBuild.status ?? 1);
const build = spawnSync(observable, ["build"], {
  cwd: root,
  env: { ...process.env, OBSERVABLE_TELEMETRY_DISABLE: "1" },
  stdio: "inherit",
  // Node refuses to spawn a .cmd shim directly on Windows (EINVAL), so the
  // platform that needs the .cmd name is also the one that needs a shell.
  shell: process.platform === "win32",
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const dataOutput = resolve(root, "dist/_import/data");
await mkdir(dataOutput, { recursive: true });
await Promise.all([
  cp(resolve(root, "site/assets"), resolve(root, "dist/assets"), { recursive: true }),
  cp(resolve(root, "node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js"), resolve(dataOutput, "duckdb-browser-eh.worker.js")),
  cp(resolve(root, "node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm"), resolve(dataOutput, "duckdb-eh.wasm")),
  cp(resolve(root, "site/data/parquet.duckdb_extension.wasm"), resolve(dataOutput, "parquet.duckdb_extension.wasm")),
  cp(catalog, resolve(dataOutput, "browser-data.json")),
  cp(reportCatalog, resolve(dataOutput, "reports.json")),
  cp(statusCatalog, resolve(dataOutput, "status.json")),
  copyCatalogedParquet({ catalogPath: catalog, publishDataRoot: resolve(root, "publish/public/data"), dataOutput }),
]);
await rm(catalog, { force: true });
await rm(reportCatalog, { force: true });
await rm(statusCatalog, { force: true });
console.log("Pulse site artifact includes local EH worker, WASM, Parquet extension, browser and status catalogs, and published INSEE Parquet.");
