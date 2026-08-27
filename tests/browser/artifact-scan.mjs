import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";

const required = ["dist/index.html", "dist/reports/report.html", "dist/_import/data/duckdb-browser-eh.worker.js", "dist/_import/data/duckdb-eh.wasm", "dist/_import/data/parquet.duckdb_extension.wasm", "dist/_import/data/manifest.json", "dist/_import/fixtures/macro.parquet"];
for (const file of required) assert((await stat(file)).isFile(), `missing public artifact: ${file}`);
const textExtensions = new Set([".html", ".js", ".css", ".json", ".txt", ".xml"]);
const privatePath = /(?:\/home\/|\/Users\/)[a-z0-9._-]+(?:\/|\\)|[A-Z]:\\Users\\[a-z0-9._-]+\\/i;
const credential = /(?:password|secret|api[_-]?key|authorization)\s*[:=]\s*["'][^"']+/i;
let totalBytes = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else {
      const info = await stat(path); totalBytes += info.size;
      assert(!path.endsWith(".map"), `public source map is not allowed: ${path}`);
      if (textExtensions.has(extname(path))) {
        const content = await readFile(path, "utf8");
        assert(!privatePath.test(content), `private filesystem path in ${path}`);
        const vendored = path.includes("dist/_node/") || path.includes("dist/_observablehq/") || path.endsWith("duckdb-browser-eh.worker.js");
        if (!vendored) assert(!credential.test(content), `credential-shaped value in ${path}`);
        if (extname(path) === ".html" || extname(path) === ".css") assert(!/https?:\/\//i.test(content), `remote browser dependency in ${path}`);
      }
    }
  }
}
await scan("dist");
assert(totalBytes < 1_000_000_000, "public artifact exceeds the 1 GB Pages limit");
console.log(`Public artifact scan passed (${totalBytes} bytes).`);
