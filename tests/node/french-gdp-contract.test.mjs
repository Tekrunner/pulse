import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
// Normalised on read: a contract assertion must not depend on whether the
// working tree was checked out with LF or CRLF.
const read = async (file) => (await readFile(resolve(root, file), "utf8")).replaceAll("\r\n", "\n");

const declaration = await read("site/reports/french-gdp/report.yml");
const report = await read("site/reports/french-gdp/report.js");
const page = await read("site/reports/french-gdp.md");

// The declaration is the contract and the module its implementation: a query
// that drifts between the two ships a lineage claim that is no longer true.
const declaredSql = [...declaration.matchAll(/^ {4}sql: (.+)$/gm)].map((match) => match[1].trim());
assert.equal(declaredSql.length, 11, "report.yml must declare eleven queries");
for (const sql of declaredSql) {
  assert(report.includes(sql), `report.js is missing the declared query: ${sql.slice(0, 80)}…`);
}

// A query may select only from its own dataset's table, and never storage.
const tables = new Set([
  "french_national_accounts_annual", "french_gdp_quarterly", "french_branch_value_added",
  "french_gdp_dollar_decomposition", "oecd_productivity_comparison", "world_demography_age_structure",
  "french_departement_gdp", "french_departement_geometry",
]);
for (const sql of declaredSql) {
  const referenced = [...sql.matchAll(/\bFROM\s+([a-z_]+)/gi)].map(([, name]) => name);
  assert.equal(referenced.length, 1, `a query reads more than one table: ${sql.slice(0, 60)}…`);
  assert(tables.has(referenced[0]), `a query reads an undeclared table: ${referenced[0]}`);
}
for (const token of ["read_parquet", "attach ", "install ", "http://", "https://"]) {
  assert(!report.toLowerCase().includes(token), `report.js crosses the data-client boundary with '${token}'`);
}
assert.match(report, /expectedColumns/);
assert.match(report, /ResizeObserver/);
assert.match(page, /renderFrenchGdpReport/);
assert.match(declaration, /default_period: all/);
assert.match(declaration, /failure_scope: slot-local/);
assert.match(declaration, /retry: safe/);

const { QUERIES, DEFAULT_COMPARATORS, FRANCE, TAIL_YEARS, INNER_RING, simplifyBoundaries } =
  await import("../../site/reports/french-gdp/report.js");
assert.equal(Object.keys(QUERIES).length, 11);
for (const [id, sql] of Object.entries(QUERIES)) {
  const placeholders = (sql.match(/\?/g) ?? []).length;
  const declared = declaration.match(new RegExp(`- id: ${id}\\n[\\s\\S]*?parameters: \\[([^\\]]*)\\]`));
  assert(declared, `report.yml declares no parameters for '${id}'`);
  const names = declared[1].split(",").map((piece) => piece.trim()).filter(Boolean);
  assert.equal(placeholders, names.length, `'${id}' binds ${placeholders} placeholders against ${names.length} declared parameters`);
  assert(declaredSql.includes(sql), `'${id}' in report.js is not the declared SQL`);
}

// Settled with the requester: France always, Germany, the United Kingdom and
// the United States by default; quarters for the seven years before the
// latest quarter's year.
assert.equal(FRANCE.code, "FRA");
assert.deepEqual([...DEFAULT_COMPARATORS], ["DEU", "GBR", "USA"]);
assert.equal(TAIL_YEARS, 7);
assert.deepEqual([...INNER_RING], ["75", "92", "93", "94"]);

// Every visual the declaration registers has a renderer and a contract whose
// fixture rows pass its own validator.
const visualIds = [...declaration.matchAll(/^ {2}- id: ([a-z-]+)\n {4}contract:/gm)].map(([, id]) => id);
assert.deepEqual(visualIds, [
  "output-growth-tail", "demand-contribution-bars", "branch-share-panels", "income-share-panels",
  "dollar-decomposition", "oecd-standing", "per-capita-drivers", "index-choropleth",
]);
for (const id of visualIds) {
  const renderer = await import(`../../site/visuals/${id}.js`);
  const contract = await import(`../../site/visuals/${id}.contract.js`);
  const renderers = Object.entries(renderer).filter(([name, value]) => name.startsWith("render") && typeof value === "function");
  assert.equal(renderers.length, 1, `${id}.js must export one renderer`);
  const declared = Object.values(contract).find((value) => value?.contractVersion);
  assert.equal(declared.visualId, id, `${id}.contract.js declares a different visual`);
  assert(declared.contractVersion.startsWith("1."), `${id} must declare a v1 contract`);
  assert.deepEqual([...declared.inputs], ["rows", "display", "provenance"]);
  assert(declared.fixtureRows.length > 0, `${id} must carry real fixture rows`);
  const validate = Object.entries(contract).find(([name]) => name.startsWith("validate"))?.[1];
  assert.equal(typeof validate, "function", `${id}.contract.js must export a validator`);
  assert.equal(validate(declared.fixtureRows).length, declared.fixtureRows.length, `${id} rejects its own fixture rows`);
  assert.throws(() => validate([{}]), TypeError, `${id} accepts an empty row`);
  assert(report.includes(`from "../../visuals/${id}.js"`), `report.js does not mount ${id}`);

  // A visual owns no storage, no SQL, no route and no chart library.
  const source = await read(`site/visuals/${id}.js`);
  for (const token of ["read_parquet", "duckdb", "parquet", "fetch(", "window.location", "observable", "from \"d3", "innerhtml"]) {
    assert(!source.toLowerCase().includes(token), `${id}.js reaches past the visual boundary with '${token}'`);
  }
  assert.doesNotMatch(source, /\bSELECT\b[\s\S]{0,300}\bFROM\b/, `${id}.js must not own SQL`);
  assert.doesNotMatch(source, /french-gdp|report\.js/, `${id}.js must not name its consumer`);
}

// Map classes at and either side of every break; a null index is the
// not-published case and never the lowest class.
const { binOf } = await import("../../site/visuals/index-choropleth.js");
for (const [index, expected] of [
  [59.9, 0], [60, 1], [69.9, 1], [70, 2], [80, 3], [89.9, 3], [90, 4], [109.9, 4], [110, 5], [149.9, 5], [150, 6], [199.9, 6], [200, 7], [314, 7],
]) {
  assert.equal(binOf(index), expected, `index ${index} lands in the wrong class`);
}
assert.equal(binOf(null), null);
assert.equal(binOf(undefined), null);

// Boundary simplification keeps every departement, drops nothing to empty on
// the mainland and removes vertices.
const square = (lon, lat, size, steps = 40) => {
  const ring = [];
  for (let i = 0; i <= steps; i += 1) ring.push([lon + (size * i) / steps, lat]);
  ring.push([lon + size, lat + size], [lon, lat + size], [lon, lat]);
  return ring;
};
const rows = [["01", 4, 45], ["29", -4.5, 48], ["67", 7.5, 48.5], ["2A", 8.8, 41.5], ["75", 2.3, 48.85], ["971", -61.5, 16]].map(([code, lon, lat]) => ({
  departement_code: code, departement_name: code, region_code: "00",
  geometry_geojson: JSON.stringify({ type: "Polygon", coordinates: [square(lon, lat, 0.6)] }),
  bbox_west: lon, bbox_south: lat, bbox_east: lon + 0.6, bbox_north: lat + 0.6,
}));
const simplified = simplifyBoundaries(rows);
assert.equal(simplified.length, rows.length);
for (const row of simplified) {
  assert.equal(row.geometry.type, "MultiPolygon");
  assert(row.geometry.coordinates.length === 1, `${row.departement_code} lost its only ring`);
  assert(row.geometry.coordinates[0][0].length < 44, `${row.departement_code} kept every collinear vertex`);
}

console.log("French GDP report contract checks passed; behavior is covered by browser tests.");
