import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = (file) => readFile(resolve(root, file), "utf8");
const client = await read("site/data/client.js");
const visual = await read("site/visuals/line.js");
const report = await read("site/reports/report.js");
const shell = await read("site/data/browser-shell.js");
const css = await read("site/style.css");

assert.match(shell, /duckdb-browser-eh/);
assert.doesNotMatch(client, /jsdelivr|unpkg|https?:\/\//i);
assert.match(client, /new Worker/);
assert.match(shell, /pagehide/);
assert.match(shell, /\.warm\(\)/);
assert.match(client, /manifestUrl/);
assert.match(client, /pulse\.browser-data/);
assert.match(client, /catalog\.extensions\?\.parquet/);
assert.match(report, /REPORT_SQL/);
assert.match(report, /insee-cpi\/monthly/);
assert.match(visual, /createElementNS/);
assert.match(visual, /accessible-data/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(visual, /duckdb|parquet|sql|observable|router/i);
assert.doesNotMatch(report, /\.close\(|\.terminate\(/);
assert.doesNotMatch(await read("site/index.md"), /https?:\/\//);
console.log("Pilot contract passed: portable visual boundary, shared lifecycle, safe artifact inputs.");
