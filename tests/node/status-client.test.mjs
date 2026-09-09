import assert from "node:assert/strict";
import {
  StatusClientError,
  createStatusClient,
  derivePipelineState,
  publicationDeadline,
  qualificationLine,
  qualifyReport,
  validateReportCatalog,
  validateStatusCatalog,
} from "../../site/data/status-client.js";
import { STATUS_SCENARIOS, statusScenarioCatalog } from "../../site/data/status-scenarios.js";

const SCHEDULE = { period: "monthly", expectedByDayOfFollowingMonth: 15, graceDays: 7 };
const at = (value) => new Date(value);

function datasetEntry(overrides = {}) {
  return {
    pipelineId: "dataset:insee-cpi-monthly",
    kind: "dataset",
    name: "INSEE CPI monthly headline indicators",
    stages: [
      { stage: "transform", state: "succeeded", attemptedAt: null, diagnostic: null },
      { stage: "test", state: "succeeded", attemptedAt: null, diagnostic: null },
      { stage: "publish-data", state: "succeeded", attemptedAt: null, diagnostic: null },
    ],
    state: "succeeded",
    lastAttemptAt: null,
    representedPeriod: { start: "1996-01-01", end: "2026-07-01" },
    schedule: SCHEDULE,
    latestUsableOutput: null,
    assertions: [],
    diagnostic: null,
    ...overrides,
  };
}

const catalogOf = (entries) => ({
  schemaId: "pulse.status",
  schemaVersion: "1.0.0",
  generatedAt: "2026-09-09T00:00:00Z",
  pipelines: Object.fromEntries(entries.map((entry) => [entry.pipelineId, entry])),
});

const reportCatalog = {
  schemaId: "pulse.reports",
  schemaVersion: "1.0.0",
  reports: {
    "french-consumer-prices": {
      id: "french-consumer-prices",
      title: "French consumer prices",
      route: "reports/french-consumer-prices",
      resolvedVisibility: "public",
      datasets: ["insee-cpi-monthly", "insee-cpi-category-analysis"],
      visuals: [
        { id: "headline-trend", dataset: "insee-cpi-monthly", columns: ["period", "cpi_index", "annual_change_pct"] },
        { id: "contribution-stack", dataset: "insee-cpi-category-analysis", columns: ["period", "services_official_contribution_pct_points"] },
        { id: "divergence-multiples", dataset: "insee-cpi-category-analysis", columns: ["period", "services_annual_change_pct"] },
        { id: "index-level-paths", dataset: "insee-cpi-category-analysis", columns: ["period", "services_index"] },
      ],
    },
  },
};

// The published contract must gate on schema identity and major version.
assert.throws(() => validateStatusCatalog({ schemaId: "pulse.other", schemaVersion: "1.0.0" }), (error) => error.code === "compatibility");
assert.throws(() => validateStatusCatalog({ schemaId: "pulse.status", schemaVersion: "2.0.0" }), (error) => error.code === "compatibility");
assert.throws(() => validateStatusCatalog(catalogOf([])), (error) => error.code === "contract");
assert.throws(() => validateReportCatalog({ schemaId: "pulse.reports", schemaVersion: "2.0.0" }), (error) => error.code === "compatibility");
assert.equal(validateReportCatalog(reportCatalog), reportCatalog);

// A precomputed staleness state would let a frozen artifact claim freshness.
assert.throws(
  () => validateStatusCatalog(catalogOf([datasetEntry({ state: "stale" })])),
  (error) => error.code === "compatibility" && /precomputed staleness/.test(error.safeMessage),
);
assert.throws(
  () =>
    validateStatusCatalog(
      catalogOf([
        datasetEntry({
          stages: [
            { stage: "transform", state: "succeeded", attemptedAt: null, diagnostic: null },
            { stage: "test", state: "stale", attemptedAt: null, diagnostic: null },
            { stage: "publish-data", state: "succeeded", attemptedAt: null, diagnostic: null },
          ],
        }),
      ]),
    ),
  (error) => /precomputed staleness/.test(error.safeMessage),
);
assert.throws(
  () => validateStatusCatalog(catalogOf([datasetEntry({ stages: datasetEntry().stages.slice(0, 2) })])),
  (error) => /canonical stages in order/.test(error.safeMessage),
);

// Deadline vectors mirror the Python contract exactly: July data is only late
// once the August observation misses day 15 of September plus seven grace days.
assert.equal(publicationDeadline("2026-07-01", SCHEDULE).toISOString(), "2026-09-22T00:00:00.000Z");
assert.equal(publicationDeadline("2026-11-01", SCHEDULE).toISOString(), "2027-01-22T00:00:00.000Z");
assert.equal(publicationDeadline("2026-07-01", null), null);
assert.equal(publicationDeadline(undefined, SCHEDULE), null);
for (const [now, expected] of [
  ["2026-09-21T23:59:59Z", "succeeded"],
  ["2026-09-22T00:00:00Z", "succeeded"],
  ["2026-09-22T00:00:01Z", "stale"],
  ["2029-01-01T00:00:00Z", "stale"],
]) {
  assert.equal(derivePipelineState(datasetEntry(), at(now)).state, expected, `state at ${now}`);
}
// Display precedence: failed > suspect > stale > succeeded.
for (const state of ["failed", "suspect", "not-run"]) {
  assert.equal(derivePipelineState(datasetEntry({ state }), at("2029-01-01T00:00:00Z")).state, state);
}

// Column lineage comes from the compiled report catalog, never a second format.
const suspectCategory = {
  ...datasetEntry(),
  pipelineId: "dataset:insee-cpi-category-analysis",
  state: "suspect",
  stages: [
    { stage: "transform", state: "succeeded", attemptedAt: null, diagnostic: null },
    { stage: "test", state: "suspect", attemptedAt: null, diagnostic: null },
    { stage: "publish-data", state: "succeeded", attemptedAt: null, diagnostic: null },
  ],
  assertions: [
    { check: "provider_annual_change", affectedColumns: ["services_official_contribution_pct_points", "services_annual_change_pct"] },
  ],
};
const qualifyAt = (status, now = "2026-09-09T00:00:00Z") =>
  qualifyReport({ status, reports: reportCatalog, reportId: "french-consumer-prices", now: at(now) });

assert.equal(qualifyAt(catalogOf([datasetEntry()])), null, "a healthy report carries no qualification");
assert.equal(
  qualificationLine(qualifyAt(catalogOf([datasetEntry(), suspectCategory]))),
  "Suspect data — affects Figure 2 and Figure 3",
);
assert.equal(
  qualificationLine(
    qualifyAt(catalogOf([datasetEntry(), { ...suspectCategory, assertions: [{ check: "plausibility", affectedColumns: [] }] }])),
  ),
  "Suspect data — affected visuals unknown",
);
// Staleness implicates the whole dataset: no assertion narrowed it.
assert.equal(
  qualificationLine(
    qualifyAt(
      catalogOf([
        datasetEntry(),
        { ...datasetEntry(), pipelineId: "dataset:insee-cpi-category-analysis", representedPeriod: { start: "1998-01-01", end: "2024-01-01" } },
      ]),
    ),
  ),
  "Stale data — affects Figure 2, Figure 3 and Figure 4",
);
const failedCategory = {
  ...datasetEntry(),
  pipelineId: "dataset:insee-cpi-category-analysis",
  state: "failed",
  stages: [
    { stage: "transform", state: "failed", attemptedAt: null, diagnostic: null },
    { stage: "test", state: "not-run", attemptedAt: null, diagnostic: null },
    { stage: "publish-data", state: "not-run", attemptedAt: null, diagnostic: null },
  ],
  latestUsableOutput: { artifactKind: "dataset", identity: "a".repeat(64), representedPeriod: { start: "1998-01-01", end: "2026-07-01" } },
};
assert.equal(
  qualificationLine(qualifyAt(catalogOf([datasetEntry(), failedCategory]))),
  "Failed refresh — affects Figure 2, Figure 3 and Figure 4; the retained dataset through 2026-07 is still shown",
);
// A failure outranks a suspect finding, and one line is produced, not two.
const bothDegraded = qualifyAt(catalogOf([{ ...datasetEntry(), state: "suspect", stages: suspectCategory.stages, assertions: [{ check: "plausibility", affectedColumns: ["cpi_index"] }] }, failedCategory]));
assert.equal(bothDegraded.state, "failed");
assert.deepEqual(bothDegraded.figures, [2, 3, 4]);
assert.equal(qualificationLine(null), null);
assert.equal(qualifyReport({ status: catalogOf([datasetEntry()]), reports: reportCatalog, reportId: "missing" }), null);

// Every shipped browser scenario satisfies the production contract.
for (const scenario of STATUS_SCENARIOS) {
  const fixture = statusScenarioCatalog(scenario);
  if (fixture) assert.equal(validateStatusCatalog(fixture), fixture, `scenario ${scenario}`);
}
assert.equal(statusScenarioCatalog("status-unavailable"), null);
assert.equal(derivePipelineState(statusScenarioCatalog("status-stale").pipelines["dataset:insee-cpi-category-analysis"], at("2026-09-09T00:00:00Z")).state, "stale");

// An absent or unreadable status file degrades to one normalized error, and a
// transient failure is not cached against the rest of the page session.
let attempts = 0;
const flaky = createStatusClient({
  statusUrl: "status.json",
  reportsUrl: "reports.json",
  fetch: async (url) => {
    if (url === "reports.json") return { ok: true, json: async () => reportCatalog };
    attempts += 1;
    return attempts === 1 ? { ok: false, status: 404 } : { ok: true, json: async () => catalogOf([datasetEntry()]) };
  },
});
await assert.rejects(flaky.status(), (error) => error instanceof StatusClientError && error.code === "unavailable" && !/404/.test(error.safeMessage));
assert.equal((await flaky.status()).schemaId, "pulse.status");
assert.equal(attempts, 2, "a failed status read must not be cached");
assert.equal((await flaky.reports()).schemaId, "pulse.reports");

const incompatible = createStatusClient({
  statusUrl: "status.json",
  reportsUrl: "reports.json",
  fetch: async () => ({ ok: true, json: async () => ({ schemaId: "pulse.status", schemaVersion: "2.0.0" }) }),
});
await assert.rejects(incompatible.status(), (error) => error.code === "compatibility");
assert.throws(() => createStatusClient({}), TypeError);

console.log("Status client contract passed: staleness is derived at read time and failures stay normalized.");
