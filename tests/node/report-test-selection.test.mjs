import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { basename } from "node:path";

import { resolveReportSpec } from "../../scripts/test-report.mjs";

assert.equal(basename(await resolveReportSpec("french-consumer-prices")), "pilot.spec.js");
assert.equal(basename(await resolveReportSpec("french-unemployment")), "unemployment.spec.js");
assert.equal(basename(await resolveReportSpec("world-demography")), "demography.spec.js");
for (const entry of await readdir("site/reports", { withFileTypes: true })) {
  if (entry.isDirectory()) await resolveReportSpec(entry.name);
}
await assert.rejects(resolveReportSpec("not-a-report"), /unknown report/);
await assert.rejects(resolveReportSpec("../invalid"), /lowercase kebab-case/);

console.log("Every report resolves to one focused browser specification.");
