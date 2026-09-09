/**
 * Deterministic pipeline-status fixtures for the explicit browser state matrix.
 *
 * They exist for the same reason the report's `scenarioClient` does: every
 * degraded state has to be renderable on demand, without waiting for a real
 * pipeline to fail. Every fixture is validated through the production contract,
 * so a fixture that drifts from the contract fails the test that uses it.
 */
import { StatusClientError, validateStatusCatalog } from "./status-client.js";

const SCHEDULE = { period: "monthly", expectedByDayOfFollowingMonth: 15, graceDays: 7 };
const ATTEMPT = "2026-09-09T07:52:02Z";
const ACQUIRED = "2026-09-07T20:24:29Z";
const MONTHLY_HASH = "39e166e9ee601157f50977183bb18c46cb2b7cbe5e1f77925e829453f22680bf";
const CATEGORY_HASH = "a86b88c65c79ca17dd68eb5748e82667e78ce709fbbdc06fd6cd0e4c99849fca";
const SOURCE_ID = "source:insee-cpi";
const MONTHLY_ID = "dataset:insee-cpi-monthly";
const CATEGORY_ID = "dataset:insee-cpi-category-analysis";
const DATASET_STAGES = ["transform", "test", "publish-data"];

const period = (start, end) => ({ start, end });

function diagnostic(stage, code, message, retryable) {
  return {
    schema_id: "pulse.diagnostic",
    schema_version: "1.0.0",
    stage,
    code,
    message,
    retryable,
  };
}

function sourcePipeline({ run = true } = {}) {
  const stages = ["acquire", "snapshot"].map((stage) => ({
    stage,
    state: run ? "succeeded" : "not-run",
    attemptedAt: run ? ACQUIRED : null,
    diagnostic: null,
  }));
  return {
    pipelineId: SOURCE_ID,
    kind: "source",
    name: "INSEE consumer price index, Base 2025",
    stages,
    state: run ? "succeeded" : "not-run",
    lastAttemptAt: run ? ACQUIRED : null,
    representedPeriod: run ? period("2026-08-01", "2026-08-01") : null,
    schedule: SCHEDULE,
    latestUsableOutput: run
      ? {
          artifactKind: "snapshot",
          identity: "acq-cd64f5f9e5bb443c94b6fb004a534b8a-8106c9fd4a1e",
          representedPeriod: period("2026-08-01", "2026-08-01"),
        }
      : null,
    assertions: [],
    diagnostic: null,
  };
}

function datasetPipeline({
  pipelineId,
  name,
  identity,
  start,
  end = "2026-07-01",
  test = "succeeded",
  assertions = [],
  failure = null,
  run = true,
}) {
  let stages;
  if (!run) {
    stages = DATASET_STAGES.map((stage) => ({ stage, state: "not-run", attemptedAt: null, diagnostic: null }));
  } else if (failure) {
    const failed = DATASET_STAGES.indexOf(failure.stage);
    stages = DATASET_STAGES.map((stage, index) => ({
      stage,
      state: index < failed ? "succeeded" : index === failed ? "failed" : "not-run",
      attemptedAt: index <= failed ? ATTEMPT : null,
      diagnostic: index === failed ? failure : null,
    }));
  } else {
    stages = [
      { stage: "transform", state: "succeeded", attemptedAt: ATTEMPT, diagnostic: null },
      { stage: "test", state: test, attemptedAt: ATTEMPT, diagnostic: null },
      { stage: "publish-data", state: "succeeded", attemptedAt: ATTEMPT, diagnostic: null },
    ];
  }
  // The retained publication stays the latest usable output even when the
  // newest attempt failed, so report freshness never follows the failure.
  const retained = run ? period(start, end) : null;
  return {
    pipelineId,
    kind: "dataset",
    name,
    stages,
    state: !run ? "not-run" : failure ? "failed" : test,
    lastAttemptAt: run ? ATTEMPT : null,
    representedPeriod: retained,
    schedule: SCHEDULE,
    latestUsableOutput: retained ? { artifactKind: "dataset", identity, representedPeriod: retained } : null,
    assertions,
    diagnostic: failure,
  };
}

const monthly = (options = {}) =>
  datasetPipeline({
    pipelineId: MONTHLY_ID,
    name: "INSEE CPI monthly headline indicators",
    identity: MONTHLY_HASH,
    start: "1996-01-01",
    ...options,
  });

const category = (options = {}) =>
  datasetPipeline({
    pipelineId: CATEGORY_ID,
    name: "INSEE CPI category analysis",
    identity: CATEGORY_HASH,
    start: "1998-01-01",
    ...options,
  });

function catalog(pipelines) {
  return validateStatusCatalog({
    schemaId: "pulse.status",
    schemaVersion: "1.0.0",
    generatedAt: "2026-09-09T07:53:00Z",
    pipelines: Object.fromEntries(pipelines.map((entry) => [entry.pipelineId, entry])),
  });
}

// Degraded states only, deliberately. These fixtures ship in the public
// artifact and are selectable with `?scenario=`, so a fixture that fabricates
// a healthy pipeline would let a shared link claim the data is trustworthy
// when it is stale, suspect or failed. Healthy state is only ever the real one.
const SCENARIOS = {
  "status-not-run": () =>
    catalog([sourcePipeline({ run: false }), monthly({ run: false }), category({ run: false })]),
  "status-suspect": () =>
    catalog([
      sourcePipeline(),
      monthly(),
      category({
        test: "suspect",
        assertions: [
          {
            check: "provider_annual_change",
            affectedColumns: ["services_official_contribution_pct_points", "services_annual_change_pct"],
          },
        ],
      }),
    ]),
  "status-suspect-unknown": () =>
    catalog([
      sourcePipeline(),
      monthly(),
      category({ test: "suspect", assertions: [{ check: "plausibility", affectedColumns: [] }] }),
    ]),
  // An old represented period with no other change: the reader's clock, not the
  // artifact, is what makes this stale.
  "status-stale": () => catalog([sourcePipeline(), monthly(), category({ end: "2024-01-01" })]),
  "status-failed": () =>
    catalog([
      sourcePipeline(),
      monthly(),
      category({
        failure: diagnostic(
          "transform",
          "candidate_rejected",
          "dataset 'insee-cpi-category-analysis' build failed; retained any prior usable publication",
          false,
        ),
      }),
    ]),
};

export const STATUS_SCENARIOS = Object.keys(SCENARIOS).concat("status-unavailable");

export function statusScenarioCatalog(scenario) {
  const build = SCENARIOS[scenario];
  return build ? build() : null;
}

/**
 * Wrap a real status client so one scenario replaces status alone. The report
 * catalog still comes from the published artifact, because the mapping from
 * assertion columns to figures is exactly what these scenarios must exercise.
 */
export function scenarioStatusClient(client, scenario) {
  if (scenario === "status-unavailable") {
    return {
      status: async () => {
        throw new StatusClientError("unavailable", "The pipeline status could not be loaded.");
      },
      reports: () => client.reports(),
    };
  }
  const fixture = statusScenarioCatalog(scenario);
  if (!fixture) return client;
  return { status: async () => fixture, reports: () => client.reports() };
}
