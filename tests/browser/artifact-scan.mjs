import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { scanArtifactSafety, verifyArtifactInventory } from "../../scripts/public-data-assets.mjs";

const rootArgument = process.argv.indexOf("--root");
const root = resolve(rootArgument === -1 ? "dist" : process.argv[rootArgument + 1]);
const required = ["index.html", "reports/index.html", "_import/data/duckdb-browser-eh.worker.js", "_import/data/duckdb-eh.wasm", "_import/data/parquet.duckdb_extension.wasm", "_import/data/browser-data.json", "_import/data/reports.json", "_import/data/status.json", "artifact-inventory.json", ".nojekyll"];
for (const file of required) assert((await stat(join(root, file))).isFile(), `missing public artifact: ${file}`);
const inventory = await verifyArtifactInventory(root);
assert.equal(inventory.base, "/pulse/", "public artifact inventory must preserve the Pages base route");
// Staleness is a reader-side derivation; a baked state string would make a
// frozen artifact claim freshness it cannot know.
const publishedStatus = JSON.parse(await readFile(join(root, "_import/data/status.json"), "utf8"));
assert.equal(publishedStatus.schemaId, "pulse.status");
const site = publishedStatus.pipelines["system:site"];
assert(site, "status must include the system:site pipeline");
const reportCatalog = JSON.parse(await readFile(join(root, "_import/data/reports.json"), "utf8"));
for (const report of Object.values(reportCatalog.reports)) {
  assert.equal(report.resolvedVisibility, "public", `non-public report leaked into the artifact: ${report.id}`);
  assert((await stat(join(root, `${report.route}.html`))).isFile(), `report route does not resolve: ${report.route}`);
}
if (process.argv.includes("--public")) {
  const allowedPages = new Set(["reports/index.html", ...Object.values(reportCatalog.reports).map((report) => `${report.route}.html`)]);
  const foundPages = [];
  async function collectHtml(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collectHtml(path);
      else if (entry.name.endsWith(".html")) foundPages.push(relative(root, path).replaceAll("\\", "/"));
    }
  }
  await collectHtml(join(root, "reports"));
  assert.deepEqual(foundPages.sort(), [...allowedPages].sort(), "public artifact contains an undeclared report route");

  const allowedModuleRoots = new Set(Object.values(reportCatalog.reports).map((report) => report.route.replace(/^reports\//, "")));
  const importsRoot = join(root, "_import/reports");
  for (const entry of await readdir(importsRoot, { withFileTypes: true })) {
    assert(entry.isDirectory() && allowedModuleRoots.has(entry.name), `public artifact contains an undeclared report module: ${entry.name}`);
  }
}
for (const [pipelineId, entry] of Object.entries(publishedStatus.pipelines)) {
  assert(!/^stale$/.test(entry.state), `status for ${pipelineId} bakes a staleness state`);
  for (const stage of entry.stages) assert.notEqual(stage.state, "stale", `stage ${stage.stage} of ${pipelineId} bakes a staleness state`);
  const diagnostics = [entry.diagnostic, ...entry.stages.map((stage) => stage.diagnostic)].filter(Boolean);
  for (const diagnostic of diagnostics) {
    assert.doesNotMatch(diagnostic.message, /Traceback|at [A-Za-z]+ \(|(?:\/home\/|\/Users\/)|[A-Z]:\\/, `unsafe diagnostic text for ${pipelineId}`);
  }
}
const totalBytes = await scanArtifactSafety(root);
console.log(`Public artifact scan passed (${totalBytes} bytes).`);
