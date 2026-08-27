import { cp, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const observable = process.platform === "win32" ? "observable.cmd" : "observable";
const build = spawnSync(observable, ["build"], {
  cwd: root,
  env: { ...process.env, OBSERVABLE_TELEMETRY_DISABLE: "1" },
  stdio: "inherit",
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const dataOutput = resolve(root, "dist/_import/data");
const fixtureOutput = resolve(root, "dist/_import/fixtures");
await mkdir(dataOutput, { recursive: true });
await mkdir(fixtureOutput, { recursive: true });
await Promise.all([
  cp(resolve(root, "node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js"), resolve(dataOutput, "duckdb-browser-eh.worker.js")),
  cp(resolve(root, "node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm"), resolve(dataOutput, "duckdb-eh.wasm")),
  cp(resolve(root, "site/data/parquet.duckdb_extension.wasm"), resolve(dataOutput, "parquet.duckdb_extension.wasm")),
  cp(resolve(root, "site/data/manifest.json"), resolve(dataOutput, "manifest.json")),
  cp(resolve(root, "site/fixtures/macro.parquet"), resolve(fixtureOutput, "macro.parquet")),
]);
console.log("Pulse site artifact includes local EH worker, WASM, Parquet extension, manifest, and fixture Parquet.");
