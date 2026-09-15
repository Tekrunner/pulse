import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { classOf, classLabels } from "../../site/visuals/departement-choropleth.js";

const root = resolve(import.meta.dirname, "../..");
const read = (file) => readFile(resolve(root, file), "utf8");

const report = await read("site/reports/french-unemployment/report.js");
const declaration = await read("site/reports/french-unemployment/report.yml");
const page = await read("site/reports/french-unemployment.md");

// The declaration is the contract; the module is the implementation of it. A
// query that drifts between the two would ship a report whose lineage claim is
// no longer true, and nothing else in the repository compares the two texts.
const declaredSql = [...declaration.matchAll(/^ {4}sql: (.+)$/gm)].map((match) => match[1].trim());
assert.equal(declaredSql.length, 8, "report.yml must declare eight queries");
for (const sql of declaredSql) {
  assert(report.includes(sql), `report.js is missing the declared query: ${sql.slice(0, 80)}…`);
}
const declaredIds = [...declaration.matchAll(/^ {2}- id: ([a-z0-9-]+)$/gm)].map((m) => m[1]);
assert.deepEqual(
  // A query and the visual it feeds may share a name, so dedupe before comparing.
  [...new Set(declaredIds.filter((id) => declaration.includes(`  - id: ${id}\n    contract:`)))].sort(),
  [
    "age-band-lines", "departement-choropleth", "headline-trend-pair",
    "international-lines", "international-participation",
    "participation-gap-band", "slack-multiples",
  ],
  "every figure the report renders must stay declared",
);

// Report-owned boundaries.
assert.match(report, /BETWEEN CAST\(\? AS DATE\) AND CAST\(\? AS DATE\)/);
assert.match(report, /expectedColumns/);
assert.match(report, /ResizeObserver/);
assert.match(report, /Provenance, query and data table/);
assert.match(report, /selectionPinned/);
assert.doesNotMatch(report, /https?:\/\//i);
assert.match(page, /renderFrenchUnemploymentReport/);
assert.match(declaration, /default_period: ten-years/);
assert.match(declaration, /failure_scope: slot-local/);

// Visuals stay renderers: no storage, no SQL, no routing.
for (const name of [
  "headline-trend-pair", "slack-multiples", "age-band-lines",
  "participation-gap-band", "departement-choropleth", "international-lines",
]) {
  const visual = await read(`site/visuals/${name}.js`);
  assert.doesNotMatch(visual, /duckdb|parquet|observable/i, `${name} crosses the visual boundary`);
  assert.doesNotMatch(visual, /\bSELECT\b[\s\S]{0,300}\bFROM\b/, `${name} must not own SQL`);
  assert.match(visual, /contractVersion/, `${name} must declare its contract`);
  assert.match(visual, /createElementNS|\.\/report-shared/, `${name} must build DOM directly`);
  const contract = await read(`site/visuals/${name}.contract.js`);
  assert.match(contract, new RegExp(`from "\\./${name}\\.js"`));
}

// Numeric boundaries of the map's five classes, at and either side of a break.
for (const [rate, expected] of [
  [5.9, 0], [6, 1], [6.9, 1], [7, 2], [7.9, 2], [8, 3], [9.9, 3], [10, 4], [19.3, 4],
]) {
  assert.equal(classOf(rate, [6, 7, 8, 10]), expected, `rate ${rate} lands in the wrong class`);
}
// A null rate is the published not-published case and must never be class 0.
assert.equal(classOf(null, [6, 7, 8, 10]), null);
assert.equal(classOf(undefined, [6, 7, 8, 10]), null);
assert.deepEqual(classLabels([6, 7, 8, 10]), [
  "under 6%", "6 – 7%", "7 – 8%", "8 – 10%", "10% and over",
]);

console.log("French unemployment report contract checks passed; behavior is covered by browser tests.");
