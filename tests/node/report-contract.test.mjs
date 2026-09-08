import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"../.."),read=file=>readFile(resolve(root,file),"utf8");
const report=await read("site/reports/french-consumer-prices/report.js");
const declaration=await read("site/reports/french-consumer-prices/report.yml");
const stylesheet=await read("site/style.css");
assert.match(report,/BETWEEN CAST\(\? AS DATE\) AND CAST\(\? AS DATE\)/);
assert.match(report,/selP/);
assert.match(report,/ResizeObserver/);
assert.match(report,/setInterval\([^;]*,\s*500\)/);
assert.match(report,/Provenance, query and data table/);
assert.match(declaration,/default_period: five-years/);
assert.equal((declaration.match(/^- id: /gm)||[]).length,0);
for(const name of ["headline-trend","contribution-stack","divergence-multiples","index-level-paths"]){
  const visual=await read(`site/visuals/${name}.js`);
  assert.doesNotMatch(visual,/duckdb|parquet|select\s|route|observable/i);
  assert.match(visual,/contractVersion/);
  assert.match(visual,/createElement|\.\/report-shared/);
}
assert.doesNotMatch(report,/support\.js|https?:\/\//i);
for(const rule of stylesheet.matchAll(/[^{}]+\{[^{}]*overflow-x\s*:\s*auto[^{}]*\}/g)){
  assert.match(rule[0],/overflow-y\s*:\s*hidden/,`horizontal scroller must hide vertical overflow: ${rule[0]}`);
}
console.log("French CPI report source-boundary checks passed; behavior is covered by browser tests.");
