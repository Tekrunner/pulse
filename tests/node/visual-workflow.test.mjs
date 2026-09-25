import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { verifyNumericBoundary } from "../../.agents/skills/pulse-add-visual/assets/numeric-boundary-harness.mjs";

const root = resolve(import.meta.dirname, "../..");
const skillRoot = resolve(root, ".agents/skills/pulse-add-visual");
const read = (path) => readFile(resolve(root, path), "utf8");
const pythonExecutable = resolve(
  root,
  process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python3",
);
const python = (args) => {
  const result = spawnSync(pythonExecutable, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || String(result.error));
  return result.stdout;
};
const pythonResult = (args) =>
  spawnSync(pythonExecutable, args, { cwd: root, encoding: "utf8" });
const venvPython = python;
const gate = resolve(skillRoot, "scripts/handoff_gate.py");
const fidelityGate = resolve(skillRoot, "scripts/fidelity_gate.py");

const skill = await read(".agents/skills/pulse-add-visual/SKILL.md");
const workflow = await read(".agents/skills/pulse-add-visual/references/workflow.md");
const registration = await read(".agents/skills/pulse-add-visual/references/registration.md");
const verification = await read(".agents/skills/pulse-add-visual/references/verification.md");
const prompt = await read(".agents/skills/pulse-add-visual/assets/claude-design-prompt.md");
const brief = await read(".agents/skills/pulse-add-visual/assets/implementation-brief.md");
const checklist = await read(".agents/skills/pulse-add-visual/assets/fidelity-checklist.md");

assert.match(skill, /route that prerequisite to `pulse-add-dataset`/);
assert.match(skill, /Pause for explicit human approval/);
assert.match(workflow, /the design stage ends when the canvas is published/);
assert.match(skill, /intent: "design"/);
assert.match(workflow, /organization-default design system does not apply/);
for (const required of [
  "__STORY_PATH__", "__DATASET_CONTRACT_PATHS_AND_SHA256__", "__PARQUET_PATHS_AND_SHA256__",
  "docs/visual-contract-v1.md", "site/design/tokens.css", "site/design/visual-language.md",
  "at least three purpose-built visuals", "parameterized query", "accessible data equivalent",
  "shared-engine-failure", "400% zoom/reflow", "WCAG 2.2 AA",
]) assert.ok(prompt.includes(required), `design prompt misses ${required}`);
assert.match(brief, /full prototype, decisions, contracts, fixtures, rationale, and assets are binding/);
assert.match(brief, /First implement only/);
assert.match(brief, /Locked approval decision digest/);
assert.match(registration, /report declaration/);
assert.match(registration, /lineage/);
assert.match(registration, /no chart library, SQL, DuckDB, Parquet\/storage URL, route/);
assert.match(verification, /left, middle, and right/);
assert.match(verification, /viewport, keyboard focus, partial input/);
assert.match(workflow, /^uv run --no-sync python .*handoff_gate\.py inspect/m);
assert.match(workflow, /^uv run --no-sync python .*handoff_gate\.py approve/m);
assert.match(verification, /^uv run --no-sync python .*fidelity_gate\.py/m);
assert.doesNotMatch(workflow + verification, /\/home\/yfontana|quick_validate\.py/);
assert.match(checklist, /Approved capture \| Implementation capture/);
assert.match(checklist, /400% zoom\/reflow/);
const checklistPath = join(await mkdtemp(join(tmpdir(), "pulse-fidelity-")), "checklist.md");
await writeFile(
  checklistPath,
  checklist
    .replace(/__[A-Z0-9_% -]+__/g, "recorded-evidence")
    .replaceAll("Pending", "Pass")
    .replaceAll("- [ ]", "- [x]")
    .replace(/Verdict: OPEN.*$/m, "Verdict: COMPLETE"),
);
assert.match(python([fidelityGate, checklistPath]), /Fidelity checklist complete/);
assert.notEqual(spawnSync(pythonExecutable, [fidelityGate, resolve(skillRoot, "assets/fidelity-checklist.md")]).status, 0,
  "the blank fidelity template must keep completion open");

const evidence = {
  schema_version: "1.0.0",
  dataset_revision: "sha256:fixture",
  conversion_paths: ["headline", "component"],
  cases: [
    { id: "scaled", path: "headline", concerns: ["decimal-scale", "precision"], stored: "102.67", query: 102.67, displayed: "102.67", expected_query: 102.67, expected_display: "102.67" },
    { id: "negative", path: "component", concerns: ["negative"], stored: "-0.2", query: -0.2, displayed: "−0.2", expected_query: -0.2, expected_display: "−0.2" },
    { id: "null", path: "component", concerns: ["null"], stored: null, query: null, displayed: "—", expected_query: null, expected_display: "—" },
  ],
};
assert.deepEqual(verifyNumericBoundary(evidence), { paths: 2, cases: 3 });
assert.throws(
  () => verifyNumericBoundary({ ...evidence, cases: evidence.cases.map((item, index) => index ? item : { ...item, query: 10267 }) }),
  /browser-query value differs/,
);

const temporary = await mkdtemp(join(tmpdir(), "pulse-visual-workflow-"));
const handoff = join(temporary, "handoff");
await mkdir(handoff);
for (const file of ["prototype.html", "decisions.md", "one.contract.js", "two.contract.js", "three.contract.js", "fixture.json", "README.md"])
  await writeFile(join(handoff, file), `${file}\n`);
const manifest = {
  schema_version: "1.0.0", report_id: "example-report", visual_ids: ["one", "two", "three"],
  prototype: ["prototype.html"], decisions: ["decisions.md"],
  contracts: ["one.contract.js", "two.contract.js", "three.contract.js"], fixtures: ["fixture.json"],
  rationale: ["README.md"], assets: [], design_only_support: [], remote_assets: [],
  states: ["ready", "loading", "empty", "suspect", "stale", "query-error", "schema-incompatibility", "render-error", "shared-engine-failure"],
  views: ["desktop", "narrow-smartphone-landscape", "400%-zoom-reflow"],
};
const manifestPath = join(temporary, "manifest.json");
const approvalPath = join(temporary, "approval.json");
await writeFile(manifestPath, JSON.stringify(manifest));
assert.match(python([gate, "inspect", "--root", handoff, "--manifest", manifestPath]), /complete-unapproved/);
const incompleteManifestPath = join(temporary, "incomplete-manifest.json");
await writeFile(incompleteManifestPath, JSON.stringify({ ...manifest, prototype: ["missing-prototype.html"] }));
const incomplete = pythonResult([gate, "inspect", "--root", handoff, "--manifest", incompleteManifestPath]);
assert.notEqual(incomplete.status, 0);
assert.match(incomplete.stdout, /handoff file is missing/);
assert.equal(existsSync(approvalPath), false,
  "failed design intake must remain at the design stage without approval state");
await writeFile(join(handoff, "unrelated.contract.js"), "unrelated contract\n");
const unrelatedContractManifestPath = join(temporary, "unrelated-contract-manifest.json");
await writeFile(unrelatedContractManifestPath, JSON.stringify({
  ...manifest,
  contracts: ["one.contract.js", "two.contract.js", "unrelated.contract.js"],
}));
const unrelatedContract = pythonResult([gate, "inspect", "--root", handoff, "--manifest", unrelatedContractManifestPath]);
assert.notEqual(unrelatedContract.status, 0);
assert.match(unrelatedContract.stdout, /each visual_id must have exactly one matching/);
const beforeApproval = pythonResult([gate, "verify", "--root", handoff, "--manifest", manifestPath, "--approval", approvalPath]);
assert.notEqual(beforeApproval.status, 0);
assert.match(beforeApproval.stdout, /human approval is absent|cannot read JSON/);
assert.equal(existsSync(approvalPath), false,
  "implementation cannot begin before explicit approval");
for (const invalidPermit of ["", "__UNRESOLVED_CHANGE__"]) {
  const rejectedPermit = pythonResult([gate, "approve", "--root", handoff, "--manifest", manifestPath, "--approval", approvalPath, "--approved-by", "Human reviewer", "--permit", invalidPermit]);
  assert.notEqual(rejectedPermit.status, 0);
  assert.match(rejectedPermit.stdout, /permitted changes must be concrete non-empty entries/);
  assert.equal(existsSync(approvalPath), false);
}
python([gate, "approve", "--root", handoff, "--manifest", manifestPath, "--approval", approvalPath, "--approved-by", "Human reviewer", "--permit", "Remove named representative rows"]);
assert.match(python([gate, "verify", "--root", handoff, "--manifest", manifestPath, "--approval", approvalPath]), /approved-locked/);
const lockedApproval = JSON.parse(await readFile(approvalPath, "utf8"));
await writeFile(approvalPath, JSON.stringify({
  ...lockedApproval,
  permitted_changes: [...lockedApproval.permitted_changes, "Unapproved redesign"],
}));
const changedDecision = pythonResult([gate, "verify", "--root", handoff, "--manifest", manifestPath, "--approval", approvalPath]);
assert.notEqual(changedDecision.status, 0);
assert.match(changedDecision.stdout, /human approval decision changed/);
await writeFile(approvalPath, JSON.stringify(lockedApproval));
assert.match(python([gate, "verify", "--root", handoff, "--manifest", manifestPath, "--approval", approvalPath]), /approved-locked/);
assert.notEqual(spawnSync(pythonExecutable, [gate, "approve", "--root", handoff, "--manifest", manifestPath, "--approval", approvalPath, "--approved-by", "Another reviewer"]).status, 0,
  "an approval record must never be overwritten");
await writeFile(join(handoff, "prototype.html"), "changed after approval\n");
assert.notEqual(spawnSync(pythonExecutable, [gate, "verify", "--root", handoff, "--manifest", manifestPath, "--approval", approvalPath]).status, 0,
  "a changed approved handoff must relock implementation");

const inseeManifest = {
  schema_version: "1.0.0", report_id: "french-consumer-prices",
  visual_ids: ["headline-trend", "contribution-stack", "divergence-multiples", "index-level-paths"],
  prototype: ["design/Pulse CPI Report.dc.html"], decisions: ["design/Story 1.6 Design Decisions.dc.html"],
  contracts: ["contracts/headline-trend.contract.js", "contracts/contribution-stack.contract.js", "contracts/divergence-multiples.contract.js", "contracts/index-level-paths.contract.js"],
  fixtures: ["fixtures/insee_cpi_monthly.json", "fixtures/insee_cpi_category_analysis.json"], rationale: ["README.md"],
  assets: ["design-system/styles.css", "design-system/nocturne-readme.md"], design_only_support: ["design/support.js"],
  remote_assets: ["prototype Google Fonts import"],
  states: manifest.states, views: manifest.views,
};
const inseeManifestPath = join(temporary, "insee-manifest.json");
const inseeApprovalPath = join(temporary, "insee-approval.json");
await writeFile(inseeManifestPath, JSON.stringify(inseeManifest));
assert.match(python([gate, "inspect", "--root", resolve(root, "claude-design-output/french-consumer-prices"), "--manifest", inseeManifestPath]), /complete-unapproved/);
python([gate, "approve", "--root", resolve(root, "claude-design-output/french-consumer-prices"), "--manifest", inseeManifestPath, "--approval", inseeApprovalPath, "--approved-by", "Story 1.6 human design approval", "--permit", "Replace representative services and manufactured data without layout changes"]);
assert.match(python([gate, "verify", "--root", resolve(root, "claude-design-output/french-consumer-prices"), "--manifest", inseeManifestPath, "--approval", inseeApprovalPath]), /approved-locked/);

const inseeNumeric = JSON.parse(await read("tests/fixtures/visual-workflow/insee-numeric-boundary-evidence.json"));
assert.deepEqual(verifyNumericBoundary(inseeNumeric), { paths: 2, cases: 3 });
const parquetValues = JSON.parse(venvPython([
  "-c",
  [
    "import json, duckdb",
    "m=duckdb.sql(\"select cpi_index from read_parquet(?) where period='2026-07-01'\", params=['publish/public/data/insee-cpi-monthly/dataset.parquet']).fetchone()[0]",
    "c=duckdb.sql(\"select manufactured_products_annual_change_pct from read_parquet(?) where period='2026-07-01'\", params=['publish/public/data/insee-cpi-category-analysis/dataset.parquet']).fetchone()[0]",
    "print(json.dumps({'headline':str(m),'manufactured':str(c)}))",
  ].join(";"),
]));
assert.equal(parquetValues.headline, inseeNumeric.cases[0].stored);
assert.equal(parquetValues.manufactured, inseeNumeric.cases[1].stored);

const inseeChecklist = resolve(root, "tests/fixtures/visual-workflow/insee-fidelity-checklist.md");
assert.match(python([fidelityGate, inseeChecklist]), /Fidelity checklist complete/);

const declaration = await read("site/reports/french-consumer-prices/report.yml");
for (const visualId of inseeManifest.visual_ids) {
  assert.match(declaration, new RegExp(`- id: ${visualId}`));
  const visual = await read(`site/visuals/${visualId}.js`);
  assert.doesNotMatch(visual, /duckdb|parquet|select\s|route|observable/i);
}
const browserEvidence = await read("tests/browser/pilot.spec.js");
for (const phrase of ["published decimals and signs of its latest month", "left, middle and right clicks", "preserve the viewport and keyboard focus", "schema contract failure", "render failure", "screenshot"])
  assert.ok(browserEvidence.includes(phrase), `INSEE case misses evidence: ${phrase}`);
// The numeric evidence above is pinned to the revision it was approved at. The
// browser spec re-proves the same concerns — precision and a negative sign —
// against whatever revision the artifact serves, so it must read its
// expectations from that Parquet rather than repeat the pinned displays, which
// the next scheduled refresh would falsify.
for (const marker of ["publishedRows(", "negative"])
  assert.ok(browserEvidence.includes(marker), `INSEE browser evidence misses ${marker}`);
const renderedEvidence = await read("tests/browser/visual-workflow.spec.js");
for (const capture of ["insee-desktop-ready.png", "insee-narrow-landscape-ready.png", "insee-400-percent-reflow.png", '"schema"', '"render"', "`insee-${scenario}.png`"])
  assert.ok(renderedEvidence.includes(capture), `INSEE rendered evidence misses ${capture}`);
const foundationEvidence = await read("tests/browser/design-foundation.spec.js");
assert.ok(foundationEvidence.includes('"engine-error"'),
  "current neutral conformance must cover shared-engine failure independently of the historical INSEE design");

console.log("Visual workflow gates design intake, approval locking, numeric paths, registration, and fidelity evidence.");
