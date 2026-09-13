import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  joinAnnotations,
  runReportSlot,
  setAccessibleState,
  stateForError,
  validateAnnotationArtifact,
  validateStateTopology,
} from "../../site/data/report-runtime.js";
import { mountPrimarySlot, PRIMARY_QUERY } from "../../site/workflows/add-report/template/report.js";
import { showReportFailure, showSlotFailure } from "../../site/workflows/add-report/template/state.js";
import {
  exerciseInfrastructure,
  numericBoundaryCases,
} from "../../site/workflows/add-report/template/test.js";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
const annotationArtifact = JSON.parse(await read("site/workflows/add-report/template/annotations.json"));
const joined = joinAnnotations(
  [{ period: "2025-01-01", value: -0.125 }], annotationArtifact,
  { anchorColumn: "period", publicOnly: false },
);
assert.equal(joined[0].annotations[0].id, "synthetic-event");
assert.throws(
  () => joinAnnotations([{ period: "2025-02-01", value: 1 }], annotationArtifact, { anchorColumn: "period", publicOnly: false }),
  /does not resolve to exactly one data row/,
);
const badDependency = structuredClone(annotationArtifact);
badDependency.annotations[0].dependencies = [{ column: "value" }];
assert.throws(() => validateAnnotationArtifact(badDependency), /invalid identity, anchor, provenance, or dependencies/);
const missingDependency = structuredClone(annotationArtifact);
missingDependency.annotations[0].dependencies = [{ dataset: "synthetic-dataset", column: "missing" }];
assert.throws(
  () => joinAnnotations([{ period: "2025-01-01", value: 1 }], missingDependency, { anchorColumn: "period", publicOnly: false }),
  /unresolved dependency/,
);

for (const [code, state] of [
  ["schema", "schema-error"], ["compatibility", "schema-error"],
  ["schema-incompatibility", "schema-error"], ["wasm-startup", "engine-error"],
  ["shared-engine-failure", "engine-error"], ["empty", "empty"],
  ["render", "render-error"], ["query", "query-error"],
]) assert.equal(stateForError({ code }), state);
validateStateTopology({
  report: ["ready", "loading", "empty", "query-error", "engine-error"],
  slot: ["ready", "loading", "empty", "suspect", "stale", "query-error", "schema-error", "render-error", "engine-error"],
  failure_scope: "slot-local", retry: "safe",
});

class FakeElement {
  constructor(name = "div") {
    this.name = name; this.dataset = {}; this.attributes = {}; this.children = []; this.parent = null;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelector(selector) {
    if (selector === ":scope > [data-report-status]")
      return this.children.find((child) => child?.dataset && Object.hasOwn(child.dataset, "reportStatus")) ?? null;
    return null;
  }
  prepend(child) { child.parent = this; this.children.unshift(child); }
  append(...children) { for (const child of children) { if (child instanceof FakeElement) child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(_name, listener) { this.listener = listener; }
  click() { this.listener?.(); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
}
globalThis.document = {
  createElement: (name) => new FakeElement(name),
  createTextNode: (text) => String(text),
};
for (const state of [
  "ready", "loading", "empty", "suspect", "stale", "query-error", "schema-error",
  "render-error", "engine-error",
]) {
  const element = new FakeElement();
  setAccessibleState(element, state, state);
  assert.equal(element.dataset.state, state);
  assert.equal(element.attributes["aria-busy"], state === "loading" ? "true" : "false");
  assert.equal(element.children[0].attributes.role, state.endsWith("error") ? "alert" : "status");
}
const retryElement = new FakeElement();
let retries = 0;
setAccessibleState(retryElement, "query-error", "Unavailable", { retry: () => { retries += 1; } });
const retryButton = retryElement.children[0].children.find((child) => child instanceof FakeElement && child.name === "button");
retryButton.click();
assert.equal(retries, 1);
setAccessibleState(retryElement, "ready", null);
assert.equal(retryElement.children.length, 0, "ready state must not inject Claude-Design-visible copy");
assert.doesNotMatch(await read("site/data/report-runtime.js"), /Visual ready/);

const infrastructure = exerciseInfrastructure(annotationArtifact);
assert.equal(infrastructure.joined[0].annotations[0].id, "synthetic-event");
assert.equal(infrastructure.schemaState, "schema-error");
assert.equal(infrastructure.engineState, "engine-error");
assert.deepEqual(numericBoundaryCases.map((item) => item.expected), [12.34, -0.125, null]);
const reportFailure = new FakeElement();
showReportFailure(reportFailure, { code: "shared-engine-failure", safeMessage: "Engine unavailable" }, () => {});
assert.equal(reportFailure.dataset.state, "engine-error");
const slotFailure = new FakeElement();
showSlotFailure(slotFailure, { code: "schema-incompatibility", safeMessage: "Schema unavailable" }, () => {});
assert.equal(slotFailure.dataset.state, "schema-error");

const mounted = new FakeElement();
let renderedRows;
const publicAnnotations = structuredClone(annotationArtifact);
publicAnnotations.annotations[0].visibility = "public";
const mountedRows = await mountPrimarySlot({
  element: mounted, annotations: publicAnnotations, start: "2025-01-01", end: "2025-01-31",
  client: {
    query: async (dataset, sql, options) => {
      assert.equal(dataset, "synthetic-dataset");
      assert.equal(sql, PRIMARY_QUERY);
      assert.deepEqual(options.params, ["2025-01-01", "2025-01-31"]);
      return [{ period: "2025-01-01", value: 12.34 }];
    },
  },
  render: (rows) => { renderedRows = rows; },
});
assert.equal(mounted.dataset.state, "ready");
assert.equal(mountedRows[0].annotations[0].id, "synthetic-event");
assert.equal(renderedRows[0].value, 12.34);

const failedSlot = new FakeElement();
const sibling = new FakeElement();
sibling.dataset.state = "ready";
await runReportSlot({
  element: failedSlot,
  query: async () => [{ period: "2025-01-01", value: 1 }],
  render: () => { throw new Error("synthetic render failure"); },
});
assert.equal(failedSlot.dataset.state, "render-error");
assert.equal(sibling.dataset.state, "ready", "a local failure must not mutate siblings");

const declaration = await read("site/workflows/add-report/template/report.yml");
for (const term of ["questions:", "queries:", "schemas:", "annotations:", "state_topology:", "change:", "report: [ready", "slot: [ready"])
  assert.ok(declaration.includes(term), `report template misses ${term}`);
assert.doesNotMatch(declaration, /chart|grid-template|font-family|#[a-f0-9]{3,8}/i);

const temporary = await mkdtemp(join(tmpdir(), "pulse-report-workflow-"));
const script = resolve(root, ".agents/skills/pulse-add-report/scripts/workflow.py");
const recordPath = join(temporary, "record.json");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const runStatus = (path = recordPath) => spawnSync("python3", [script, "status", path, "--root", temporary], { encoding: "utf8" });
async function fileArtifact(phase, kind, path, value) {
  await writeFile(join(temporary, path), value);
  return { phase, kind, path, sha256: sha(value) };
}
async function completeRecord({ mismatchedApproval = false, unverifiedDependency = false } = {}) {
  const dependency = unverifiedDependency
    ? [{
        kind: "source", id: "official-source", skill: "pulse-add-source",
        artifact: null,
        verified: false,
      }]
    : [];
  const real = await fileArtifact("real-data", "representative-rows", "real.json", "real rows\n");
  const handoff = await fileArtifact("design-handoff", "claude-design", "handoff.html", "approved design\n");
  const infrastructure = await fileArtifact("infrastructure", "report-contract", "report.yml", "contract\n");
  const implementation = await fileArtifact("visual-implementation", "implementation", "visual.js", "visual\n");
  const numeric = await fileArtifact("visual-implementation", "numeric-evidence", "numeric.json", "numeric\n");
  const fidelity = await fileArtifact("visual-implementation", "fidelity-evidence", "fidelity.md", "fidelity\n");
  const verificationEvidence = await fileArtifact("verification", "test-evidence", "verify.txt", "passed\n");
  const approvalValue = JSON.stringify({
    schemaVersion: "1.0.0", reportId: "example-report",
    handoffSha256: mismatchedApproval ? "f".repeat(64) : handoff.sha256,
    approvedBy: "Human reviewer", approvedAt: "2026-09-13T12:00:00Z",
    permittedChanges: ["Replace fixture rows with verified data"],
  }) + "\n";
  const approval = await fileArtifact("design-approval", "human-approval", "approval.json", approvalValue);
  return {
    schemaVersion: "1.0.0", reportId: "example-report", phase: "verification",
    discovery: {
      standingQuestions: [{ id: "trend", question: "How is the measure changing?" }],
      indicators: ["Monthly measure"], context: "Reader decision context",
      readingBehavior: "Scan headline, then inspect evidence", privacyExpectation: "public",
      explorationNeeded: true,
    },
    sourceDecisions: [{
      need: "Monthly measure", selected: "official-source", rationale: "Best authority and coverage",
      defaultProvider: false,
      candidates: [{
        id: "official-source", authority: "Official producer", coverage: "National monthly",
        granularity: "Monthly", stability: "Versioned release", accessMethod: "Public HTTPS",
        format: "CSV", licence: "Open licence", attribution: "Official producer",
        cadence: "Monthly", publicationSchedule: "Day 15 plus seven-day grace",
        redistributionConstraints: "Attribution required",
      }],
    }],
    dependencies: dependency, artifacts: [real, handoff, infrastructure], approval,
    visuals: [{ id: "trend", handoffSection: "Figure 1", implementation, numericEvidence: numeric, fidelityEvidence: fidelity, verified: true }],
    verification: { commands: [{ command: "uv run --no-sync pulse verify", status: "passed", evidence: verificationEvidence }], complete: true },
    resume: { firstIncomplete: "verification", checkedAt: null },
  };
}

try {
  let result = spawnSync("python3", [script, "init", recordPath, "example-report"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  result = runStatus();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "questions");

  let record = await completeRecord();
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "complete");

  record = await completeRecord({ unverifiedDependency: true });
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "dependencies", "a dependency without an artifact must keep report work paused");

  record.dependencies[0].artifact = await fileArtifact("dependencies", "source-output", "source-output.yaml", "source output\n");
  record.dependencies[0].verified = true;
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "complete", "a verified digest-backed dependency output must advance the workflow");

  await writeFile(join(temporary, "real.json"), "mutated rows\n");
  result = runStatus();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "real-data", "artifact mutation must reopen its gate");

  record = await completeRecord({ mismatchedApproval: true });
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "design-approval", "approval/handoff mismatch must reopen approval");

  record = await completeRecord();
  record.artifacts[0].path = "../escape.json";
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /escapes repository/);

  record = await completeRecord();
  delete record.sourceDecisions[0].candidates[0].attribution;
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source candidate fields are not exact/);

  for (const field of ["context", "readingBehavior"]) {
    record = await completeRecord();
    record.discovery[field] = [];
    await writeFile(recordPath, JSON.stringify(record));
    result = runStatus();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /discovery inputs are invalid/);
  }

  record = await completeRecord();
  record.sourceDecisions[0].rationale = [];
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source decision is invalid/);

  record = await completeRecord({ unverifiedDependency: true });
  record.dependencies[0].verified = true;
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /verified dependency requires an artifact/);

  record = await completeRecord({ unverifiedDependency: true });
  record.dependencies[0].artifact = await fileArtifact("real-data", "source-output", "wrong-dependency-phase.yaml", "output\n");
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /dependency artifact must be dependencies\/source-output/);

  record = await completeRecord({ unverifiedDependency: true });
  record.dependencies[0].artifact = await fileArtifact("dependencies", "dataset-output", "wrong-dependency-kind.yaml", "output\n");
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /dependency artifact must be dependencies\/source-output/);

  record = await completeRecord();
  record.visuals[0].numericEvidence.phase = "verification";
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /numericEvidence must be visual-implementation\/numeric-evidence/);

  record = await completeRecord();
  record.visuals[0].fidelityEvidence = {
    ...record.visuals[0].numericEvidence,
    kind: "fidelity-evidence",
  };
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /distinct paths/);

  record = await completeRecord();
  record.verification.commands[0].evidence.phase = "visual-implementation";
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /verification evidence must be verification\/test-evidence/);

  record = await completeRecord();
  record.approval.kind = "test-evidence";
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /separate human-approval artifact/);

  record = await completeRecord();
  const approvalWithoutTimezone = JSON.stringify({
    schemaVersion: "1.0.0", reportId: "example-report",
    handoffSha256: record.artifacts.find((item) => item.phase === "design-handoff").sha256,
    approvedBy: "Human reviewer", approvedAt: "2026-09-13T12:00:00",
    permittedChanges: ["Replace fixture rows with verified data"],
  }) + "\n";
  await writeFile(join(temporary, "approval.json"), approvalWithoutTimezone);
  record.approval.sha256 = sha(approvalWithoutTimezone);
  await writeFile(recordPath, JSON.stringify(record));
  result = runStatus();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "design-approval", "approval timestamps must include a timezone");
} finally {
  await rm(temporary, { recursive: true, force: true });
}

const skill = await read(".agents/skills/pulse-add-report/SKILL.md");
for (const linkedFile of ["references/workflow.md", "assets/report-workflow.json", "scripts/workflow.py"])
  assert.ok(skill.includes(linkedFile), `report coordinator does not link ${linkedFile}`);

console.log("Report workflow gates discovery, resume, approval, annotation joins, state isolation, and evidence.");
