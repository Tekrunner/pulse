import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

const declaration = await read("site/reports/world-demography/report.yml");
const report = await read("site/reports/world-demography/report.js");

// Every query the declaration binds must be the query the report runs. A
// report that drifted from its declaration would pass its own tests while
// reading columns the lineage no longer claims.
const declaredSql = [...declaration.matchAll(/sql: >-\n((?:\s{6}.*\n)+)/g)].map(([, block]) =>
  block.split("\n").map((piece) => piece.trim()).filter(Boolean).join(" "));
assert.equal(declaredSql.length, 12, "report.yml must declare twelve queries");
for (const sql of declaredSql) {
  assert(report.includes(sql), `report.js is missing the declared query: ${sql.slice(0, 90)}…`);
}

// A query may select only from its own dataset's table.
const tables = {
  "world_demography_indicators": "world-demography-indicators",
  "world_demography_scenarios": "world-demography-scenarios",
  "world_demography_age_structure": "world-demography-age-structure",
  "european_immigration_flows": "european-immigration-flows",
  "european_emigration_flows": "european-emigration-flows",
  "healthy_life_expectancy": "healthy-life-expectancy",
};
for (const sql of declaredSql) {
  const referenced = [...sql.matchAll(/\bFROM\s+([a-z_]+)/gi)].map(([, name]) => name);
  assert.equal(referenced.length, 1, `a query reads more than one table: ${sql.slice(0, 60)}…`);
  assert(referenced[0] in tables, `a query reads an undeclared table: ${referenced[0]}`);
}

// The report never reaches for storage, a route or a network address.
for (const token of ["read_parquet", "attach ", "install ", "http://", "https://"]) {
  assert(!report.toLowerCase().includes(token), `report.js crosses the data-client boundary with '${token}'`);
}

// Six country slots, because a parameterised query has a fixed arity.
const { MAX_COUNTRIES, DEFAULT_COUNTRIES, UNIVERSE_FLOOR, QUERIES } =
  await import("../../site/reports/world-demography/report.js");
assert.equal(MAX_COUNTRIES, 6);
assert.deepEqual([...DEFAULT_COUNTRIES], [250, 276, 826], "France, Germany and the United Kingdom are the defaults");
assert.equal(UNIVERSE_FLOOR, 300, "the selectable universe floor is 300 thousand people");
assert.equal(Object.keys(QUERIES).length, 12);
for (const [id, sql] of Object.entries(QUERIES)) {
  const placeholders = (sql.match(/\?/g) ?? []).length;
  const declared = declaration.match(new RegExp(`- id: ${id}\\n[\\s\\S]*?parameters: \\[([^\\]]*)\\]`));
  assert(declared, `report.yml declares no parameters for '${id}'`);
  const names = declared[1].split(",").map((piece) => piece.trim()).filter(Boolean);
  assert.equal(placeholders, names.length, `'${id}' binds ${placeholders} placeholders against ${names.length} declared parameters`);
}

// Every visual the declaration registers has a renderer and a contract.
const visualIds = [...declaration.matchAll(/^  - id: ([a-z-]+)\n    contract:/gm)].map(([, id]) => id);
assert.equal(visualIds.length, 6, "report.yml must register six visuals");
for (const id of visualIds) {
  const renderer = await import(`../../site/visuals/${id}.js`);
  const contract = await import(`../../site/visuals/${id}.contract.js`);
  const exported = Object.keys(renderer);
  assert.equal(exported.length, 1, `${id}.js must export one renderer`);
  assert(exported[0].startsWith("render"), `${id}.js must export a render function`);
  const declared = Object.values(contract).find((value) => value?.contractVersion);
  assert.equal(declared.visualId, id, `${id}.contract.js declares a different visual`);
  assert(declared.contractVersion.startsWith("1."), `${id} must declare a v1 contract`);
  assert(declared.fixtureRows.length > 0, `${id} must carry real fixture rows`);
  assert(report.includes(`from "../../visuals/${id}.js"`), `report.js does not mount ${id}`);
}

// A visual owns no storage, no route and no chart library.
for (const id of visualIds) {
  const source = await read(`site/visuals/${id}.js`);
  for (const token of ["read_parquet", "duckdb", "fetch(", "window.location", "import(\"d3", "from \"d3"]) {
    assert(!source.toLowerCase().includes(token.toLowerCase()), `${id}.js reaches past the visual boundary with '${token}'`);
  }
  assert(!/<text[^>]*>\s*\$\{/.test(source), `${id}.js puts a computed value inside SVG text`);
}

// The state topology keeps failure slot-local and retry safe.
assert(/failure_scope: slot-local/.test(declaration));
assert(/retry: safe/.test(declaration));

console.log("world-demography contract checks passed");
