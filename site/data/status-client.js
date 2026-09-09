/**
 * Same-origin pipeline-health substrate for the navigation shell and reports.
 *
 * Status lives in its own JSON rather than inside browser-data.json, so a
 * failed status read can never break dataset loading. Nothing here computes a
 * state at build time: `stale` is derived from the declared publication
 * schedule against the reader's clock, which is why a frozen artifact opened
 * long after its build still reports overdue data.
 */

const STATUS_SCHEMA_ID = "pulse.status";
const REPORT_CATALOG_SCHEMA_ID = "pulse.reports";

export const SOURCE_STAGES = ["acquire", "snapshot"];
export const DATASET_STAGES = ["transform", "test", "publish-data"];
export const PIPELINE_STAGES = { source: SOURCE_STAGES, dataset: DATASET_STAGES };
/** States a published artifact may carry. `stale` is deliberately absent. */
export const PUBLISHED_STATES = ["not-run", "succeeded", "suspect", "failed"];
export const STATE_PRECEDENCE = ["failed", "suspect", "stale", "succeeded"];
export const STATE_LABELS = {
  "not-run": "Not run yet",
  succeeded: "Up to date",
  suspect: "Suspect",
  stale: "Stale",
  failed: "Failed",
};
export const QUALIFICATION_LABELS = {
  suspect: "Suspect data",
  stale: "Stale data",
  failed: "Failed refresh",
};

export class StatusClientError extends Error {
  constructor(code, safeMessage, cause) {
    super(safeMessage, { cause });
    this.name = "StatusClientError";
    this.code = code;
    this.safeMessage = safeMessage;
  }
}

const compatibility = (message) => new StatusClientError("compatibility", message);
const malformed = (message) => new StatusClientError("contract", message);

function isPeriod(value) {
  return (
    value === null ||
    (Boolean(value) &&
      typeof value === "object" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.start ?? "") &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.end ?? ""))
  );
}

function validateSchedule(schedule) {
  if (schedule === null) return null;
  if (
    !schedule ||
    typeof schedule !== "object" ||
    schedule.period !== "monthly" ||
    !Number.isInteger(schedule.expectedByDayOfFollowingMonth) ||
    schedule.expectedByDayOfFollowingMonth < 1 ||
    schedule.expectedByDayOfFollowingMonth > 28 ||
    !Number.isInteger(schedule.graceDays) ||
    schedule.graceDays < 0
  ) {
    throw malformed("A pipeline declares an unreadable publication schedule.");
  }
  return schedule;
}

function validateEntry(pipelineId, entry) {
  if (!entry || typeof entry !== "object" || entry.pipelineId !== pipelineId) {
    throw malformed(`Pipeline '${pipelineId}' is not reported consistently.`);
  }
  const stages = PIPELINE_STAGES[entry.kind];
  if (!stages || !pipelineId.startsWith(`${entry.kind}:`) || typeof entry.name !== "string" || !entry.name) {
    throw malformed(`Pipeline '${pipelineId}' does not declare a known kind and name.`);
  }
  if (
    !Array.isArray(entry.stages) ||
    entry.stages.length !== stages.length ||
    entry.stages.some((stage, index) => !stage || stage.stage !== stages[index])
  ) {
    throw malformed(`Pipeline '${pipelineId}' does not report its canonical stages in order.`);
  }
  for (const stage of entry.stages) {
    if (!PUBLISHED_STATES.includes(stage.state)) {
      throw stage.state === "stale"
        ? compatibility("Pipeline status must not carry a precomputed staleness state.")
        : malformed(`Pipeline '${pipelineId}' reports an unknown stage state.`);
    }
  }
  if (!PUBLISHED_STATES.includes(entry.state)) {
    throw entry.state === "stale"
      ? compatibility("Pipeline status must not carry a precomputed staleness state.")
      : malformed(`Pipeline '${pipelineId}' reports an unknown state.`);
  }
  if (!isPeriod(entry.representedPeriod ?? null) || !Array.isArray(entry.assertions)) {
    throw malformed(`Pipeline '${pipelineId}' reports an unreadable period or assertion list.`);
  }
  validateSchedule(entry.schedule ?? null);
  return entry;
}

export function validateStatusCatalog(catalog) {
  if (!catalog || catalog.schemaId !== STATUS_SCHEMA_ID || !String(catalog.schemaVersion).startsWith("1.")) {
    throw compatibility("The pipeline status catalog uses an unsupported contract version.");
  }
  if (!catalog.pipelines || typeof catalog.pipelines !== "object" || !Object.keys(catalog.pipelines).length) {
    throw malformed("The pipeline status catalog reports no pipelines.");
  }
  for (const [pipelineId, entry] of Object.entries(catalog.pipelines)) validateEntry(pipelineId, entry);
  return catalog;
}

export function validateReportCatalog(catalog) {
  if (!catalog || catalog.schemaId !== REPORT_CATALOG_SCHEMA_ID || !String(catalog.schemaVersion).startsWith("1.")) {
    throw compatibility("The report catalog uses an unsupported contract version.");
  }
  if (!catalog.reports || typeof catalog.reports !== "object" || !Object.keys(catalog.reports).length) {
    throw malformed("The report catalog declares no reports.");
  }
  for (const [reportId, report] of Object.entries(catalog.reports)) {
    if (
      !report ||
      report.id !== reportId ||
      typeof report.title !== "string" ||
      typeof report.route !== "string" ||
      report.route.startsWith("/") ||
      report.route.includes("..") ||
      !Array.isArray(report.datasets) ||
      !Array.isArray(report.visuals)
    ) {
      throw malformed(`Report '${reportId}' is not declared usably.`);
    }
  }
  return catalog;
}

/**
 * The instant after which the next, still-missing period counts as overdue.
 *
 * The deadline derives from the represented period, never from fetch time:
 * data through July is only late once the August observation has missed its
 * own declared publication day plus the declared grace.
 */
export function publicationDeadline(representedPeriodEnd, schedule) {
  if (typeof representedPeriodEnd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(representedPeriodEnd)) return null;
  const validated = validateSchedule(schedule ?? null);
  if (!validated) return null;
  const [year, month] = representedPeriodEnd.split("-").map(Number);
  const due = new Date(Date.UTC(year, month + 1, validated.expectedByDayOfFollowingMonth));
  due.setUTCDate(due.getUTCDate() + validated.graceDays);
  return due;
}

/** Resolve the state a reader sees, deriving `stale` from the given clock. */
export function derivePipelineState(entry, now = new Date()) {
  const deadline = publicationDeadline(entry.representedPeriod?.end, entry.schedule);
  const overdue = Boolean(deadline) && now.getTime() > deadline.getTime();
  // Display precedence: failed > suspect > stale > succeeded, and `not-run`
  // describes a pipeline before any attempt rather than a degradation.
  const state = entry.state === "succeeded" && overdue ? "stale" : entry.state;
  return { state, deadline, overdue };
}

/**
 * Qualify one report from its datasets' pipeline status.
 *
 * Column lineage is reused, not reinvented: assertion columns are matched
 * against the visual-slot columns the report catalog already compiles, so an
 * affected slot resolves to the figure number a reader sees.
 */
export function qualifyReport({ status, reports, reportId, now = new Date() }) {
  const report = reports?.reports?.[reportId];
  if (!report) return null;
  const findings = [];
  for (const datasetId of report.datasets) {
    const entry = status?.pipelines?.[`dataset:${datasetId}`];
    if (!entry) continue;
    const { state } = derivePipelineState(entry, now);
    if (state === "succeeded" || state === "not-run") continue;
    const slots = report.visuals.flatMap((visual, index) =>
      visual.dataset === datasetId ? [{ figure: index + 1, columns: visual.columns ?? [] }] : [],
    );
    const columns = new Set(entry.assertions.flatMap((item) => item.affectedColumns ?? []));
    let figures;
    if (!entry.assertions.length) {
      // Nothing narrowed the impact, so the whole dataset is implicated.
      figures = slots.map((slot) => slot.figure);
    } else if (!columns.size) {
      // An assertion fired without column precision: impact is unknown.
      figures = [];
    } else {
      figures = slots
        .filter((slot) => slot.columns.some((column) => columns.has(column)))
        .map((slot) => slot.figure);
    }
    findings.push({
      datasetId,
      state,
      figures,
      retainedThrough: entry.latestUsableOutput?.representedPeriod?.end ?? null,
    });
  }
  if (!findings.length) return null;
  const state = STATE_PRECEDENCE.find((candidate) => findings.some((item) => item.state === candidate));
  const selected = findings.filter((item) => item.state === state);
  const figures = [...new Set(selected.flatMap((item) => item.figures))].sort((a, b) => a - b);
  return {
    state,
    figures,
    retainedThrough: selected.map((item) => item.retainedThrough).find(Boolean) ?? null,
  };
}

// Joined here rather than through Intl.ListFormat: the wording is part of the
// contract these tests pin, and must not move with the runtime's locale data.
const joinLabels = (labels) =>
  labels.length <= 1 ? labels.join("") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;

/** One provenance line: never per figure, and never a second lineage format. */
export function qualificationLine(qualification) {
  if (!qualification) return null;
  const label = QUALIFICATION_LABELS[qualification.state] ?? "Qualified data";
  const impact = qualification.figures.length
    ? `affects ${joinLabels(qualification.figures.map((figure) => `Figure ${figure}`))}`
    : "affected visuals unknown";
  const retained =
    qualification.state === "failed" && qualification.retainedThrough
      ? `; the retained dataset through ${qualification.retainedThrough.slice(0, 7)} is still shown`
      : "";
  return `${label} — ${impact}${retained}`;
}

export function createStatusClient({ statusUrl, reportsUrl, fetch = globalThis.fetch } = {}) {
  if (!statusUrl || !reportsUrl) throw new TypeError("statusUrl and reportsUrl are required");
  let status;
  let reports;
  async function read(url, validate, subject) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${subject} returned ${response.status}`);
      return validate(await response.json());
    } catch (error) {
      if (error instanceof StatusClientError) throw error;
      throw new StatusClientError("unavailable", `The ${subject} could not be loaded.`, error);
    }
  }
  return {
    // Failures are not cached: a transient read must not disable health for the
    // rest of the page session.
    async status() {
      return (status ??= await read(statusUrl, validateStatusCatalog, "pipeline status"));
    },
    async reports() {
      return (reports ??= await read(reportsUrl, validateReportCatalog, "report catalog"));
    },
  };
}

const statusUrl = new URL("./status.json", import.meta.url);
const reportsUrl = new URL("./reports.json", import.meta.url);
let pageClient;

/** One page-scoped client over the two same-origin, manifest-relative catalogs. */
export function getPageStatusClient() {
  return (pageClient ??= createStatusClient({ statusUrl, reportsUrl }));
}
