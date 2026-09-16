/**
 * Data-driven navigation shell: the reports that exist, and the health of the
 * pipelines behind them.
 *
 * The two catalogs are read independently on purpose. Reports must stay
 * reachable when status cannot be read, and a fault while rendering health
 * must not take navigation with it. Qualifying a report against its upstream
 * pipelines is a third pass over both catalogs: it can only run when both
 * loaded, and its absence costs a reader the caveat, never the link.
 */
import {
  STATE_LABELS,
  derivePipelineState,
  getPageStatusClient,
  publicationDeadline,
  qualificationLine,
  qualifyReport,
} from "./status-client.js";
import { scenarioStatusClient } from "./status-scenarios.js";

const el = (name, text) => {
  const node = document.createElement(name);
  if (text !== undefined) node.textContent = text;
  return node;
};

// A label a reader needs but a scanner does not: the column head above it
// already says this, so it is carried per row for assistive technology and
// hidden from sighted layout.
function labelled(label, value, className) {
  const cell = el("span");
  if (className) cell.className = className;
  const name = el("span", `${label} `);
  name.className = "visually-hidden";
  cell.append(name, el("span", value));
  return cell;
}

const KIND_WORDS = { source: "Source", dataset: "Dataset", system: "System" };
// A glance has to answer one question: did everything run without issue. The
// marker is deliberately coarse so a healthy set reads as one repeated shape
// and anything else breaks the column; the adjacent word carries the precise
// state, and screen readers get the word rather than the glyph.
const STATE_MARKERS = { succeeded: "✓", "not-run": "–", suspect: "!", stale: "!", failed: "✕" };
// Rows sort by attention first, then along the data flow. `not-run` sits above
// healthy because the first question is whether a pipeline executed at all,
// but below the degraded states, which have actual evidence to act on.
const STATE_ORDER = { failed: 0, suspect: 1, stale: 2, "not-run": 3, succeeded: 4 };
// Sources before the datasets derived from them: when a source breaks, its
// datasets break as a consequence, and the cause should not render below them.
const KIND_ORDER = { source: 0, dataset: 1, system: 2 };
// One filter is applied at a time, so this is a radio group rather than a set
// of toggles, and it reuses the segmented control the reports already use.
const FILTERS = [
  { key: "all", label: "All", covers: () => true },
  {
    key: "attention",
    label: "Needs attention",
    covers: (row) => row.resolved.state !== "succeeded" && row.resolved.state !== "not-run",
  },
  { key: "source", label: "Sources", covers: (row) => row.entry.kind === "source" },
  { key: "dataset", label: "Datasets", covers: (row) => row.entry.kind === "dataset" },
  { key: "system", label: "System", covers: (row) => row.entry.kind === "system" },
];

const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

const monthLabel = (day) => monthFormat.format(new Date(`${day}T00:00:00Z`));
const dayLabel = (date) => dayFormat.format(date);
const instantLabel = (value) => `${timeFormat.format(new Date(value))} UTC`;

function row(term, description) {
  const item = el("div");
  item.append(el("dt", term), el("dd", description));
  return item;
}

function freshness(entry, resolved) {
  const period = entry.representedPeriod;
  if (!period) return "No observation published yet";
  if (entry.kind === "system" && entry.schedule === null) {
    const deadline = new Date(`${period.end}T00:00:00Z`);
    return resolved.overdue
      ? `Deployment validity expired ${dayLabel(deadline)}`
      : `Deployment valid until ${dayLabel(deadline)}`;
  }
  const through = `Data through ${monthLabel(period.end)}`;
  const deadline = publicationDeadline(period.end, entry.schedule);
  if (!deadline) return through;
  return resolved.overdue
    ? `${through} · the next observation was due ${dayLabel(deadline)}`
    : `${through} · next observation due ${dayLabel(deadline)}`;
}

// The two columns the board shows beside the state. Both restate part of the
// freshness sentence, so they are derived from the same fields rather than
// parsed back out of it.
const throughColumn = (entry) =>
  entry.representedPeriod && !(entry.kind === "system" && entry.schedule === null)
    ? monthLabel(entry.representedPeriod.end)
    : "Not dated";

function dueColumn(entry) {
  const period = entry.representedPeriod;
  if (!period) return "Unknown";
  if (entry.kind === "system" && entry.schedule === null) return dayLabel(new Date(`${period.end}T00:00:00Z`));
  const deadline = publicationDeadline(period.end, entry.schedule);
  return deadline ? dayLabel(deadline) : "No declared schedule";
}

function stageSummary(entry) {
  const states = new Set(entry.stages.map((stage) => stage.state));
  if (states.size === 1) {
    const [only] = states;
    return only === "succeeded" ? "All stages succeeded" : `All stages ${only.replace("-", " ")}`;
  }
  return entry.stages
    .map((stage) => `${stage.stage} ${stage.state.replace("-", " ")}`)
    .join(" · ");
}

function assertionSummary(entry) {
  if (!entry.assertions.length) return "None failing";
  return entry.assertions
    .map((item) =>
      item.affectedColumns?.length
        ? `${item.check} — affects ${item.affectedColumns.join(", ")}`
        : `${item.check} — affected columns unknown`,
    )
    .join(" · ");
}

function usableOutput(entry) {
  const output = entry.latestUsableOutput;
  if (!output) return "None yet";
  const identity = output.identity.length > 20 ? `${output.identity.slice(0, 12)}…` : output.identity;
  const through = output.representedPeriod ? `, through ${monthLabel(output.representedPeriod.end)}` : "";
  const label = { snapshot: "Snapshot", dataset: "Dataset", site: "Site" }[output.artifactKind] ?? "Artifact";
  return `${label} ${identity}${through}`;
}

function suspectWarning(entry) {
  if (!entry.assertions.length) return "";
  return `Suspect data — ${assertionSummary(entry)}`;
}

function pipelineItem(entry, resolved) {
  const item = el("li");
  item.dataset.pipeline = entry.pipelineId;
  item.dataset.state = resolved.state;
  // Compact by default: the columns a reader scans, with the evidence behind a
  // disclosure. `details` is the pattern the reports already use, so keyboard
  // operation, the expand affordance and the heading inside the summary all
  // come from the platform rather than from bespoke ARIA.
  const disclosure = el("details");
  // The summary is the row: one grid whose template the header above it
  // repeats, so the columns line up without either knowing about the other.
  const summary = el("summary");
  const status = el("span");
  status.className = "pipeline-status";
  const marker = el("span", STATE_MARKERS[resolved.state]);
  marker.className = "pipeline-marker";
  marker.setAttribute("aria-hidden", "true");
  // The state is carried by text, so nothing here depends on colour alone.
  const state = el("span", STATE_LABELS[resolved.state]);
  state.className = "pipeline-state";
  const heading = el("h3", entry.name);
  heading.className = "pipeline-name";
  const kind = labelled("Kind", KIND_WORDS[entry.kind], "pipeline-kind");
  const details = el("dl");
  details.append(
    row("Freshness", freshness(entry, resolved)),
    row("Stages", stageSummary(entry)),
    row("Assertions", assertionSummary(entry)),
    row("Last attempt", entry.lastAttemptAt ? instantLabel(entry.lastAttemptAt) : "Not recorded"),
    row("Latest usable output", usableOutput(entry)),
  );
  if (entry.diagnostic) {
    // Already sanitized upstream: a code, a stage and a safe message. The page
    // renders it verbatim; nothing here can explain a failure the runtime did
    // not explain itself.
    details.append(
      row(
        "Diagnostic",
        `${entry.diagnostic.code} at ${entry.diagnostic.stage} — ${entry.diagnostic.message}` +
          ` (${entry.diagnostic.retryable ? "retryable" : "not retryable"})`,
      ),
    );
  }
  if (resolved.state !== "succeeded" && resolved.state !== "not-run") item.classList.add("pipeline-degraded");
  status.append(marker, state);
  summary.append(
    status,
    heading,
    kind,
    labelled("Data through", throughColumn(entry), "pipeline-through"),
    labelled("Next due", dueColumn(entry), "pipeline-due"),
    labelled(
      "Last run",
      entry.lastAttemptAt ? instantLabel(entry.lastAttemptAt) : "Never run",
      "pipeline-when",
    ),
  );
  // Suspect data is never hidden behind the disclosure: the compact status has
  // to say the numbers are qualified even when nobody expands the row.
  const warning = suspectWarning(entry);
  if (warning) {
    // A span, not a paragraph: summary takes phrasing content, and this one
    // is a grid item spanning the row rather than a block in its own right.
    const note = el("span", warning);
    note.className = "pipeline-warning";
    summary.append(note);
  }
  disclosure.append(summary, details);
  item.append(disclosure);
  return item;
}

function message(text, kind) {
  const node = el("p", text);
  node.className = "pipeline-message";
  node.setAttribute("role", kind === "error" ? "alert" : "status");
  return node;
}

function reportCard(report) {
  const card = el("li");
  card.className = "report-card";
  card.dataset.report = report.id;
  const heading = el("h3");
  heading.className = "report-title";
  const link = el("a", report.title);
  link.href = `./${report.route}`;
  heading.append(link);
  // Composed from the catalog alone, so a card says something true about the
  // report even when no pipeline status can be read.
  const counts = el("p", `${report.visuals.length} figures · ${report.datasets.length} datasets`);
  counts.className = "report-counts";
  card.append(heading, counts);
  return card;
}

/**
 * Add what only the join of both catalogs can say: how far the data behind a
 * report reaches, and whether anything qualifies it.
 */
function qualifyCard(card, { status, reports, reportId, now }) {
  const report = reports.reports[reportId];
  const ends = report.datasets
    .map((datasetId) => status.pipelines[`dataset:${datasetId}`]?.representedPeriod?.end)
    .filter(Boolean)
    .sort();
  if (ends.length) {
    const coverage = el("p", `Data through ${monthLabel(ends[0])}`);
    coverage.className = "report-coverage";
    card.insertBefore(coverage, card.querySelector(".report-counts"));
  }
  const qualification = qualifyReport({ status, reports, reportId, now });
  const line = qualificationLine(qualification);
  const state = el("p");
  state.className = "report-state";
  state.dataset.qualification = qualification ? qualification.state : "succeeded";
  const marker = el("span", STATE_MARKERS[qualification ? qualification.state : "succeeded"]);
  marker.className = "pipeline-marker";
  marker.setAttribute("aria-hidden", "true");
  state.append(marker, el("span", line ?? "All upstream data up to date"));
  if (qualification) card.classList.add("report-qualified");
  card.append(state);
}

async function fillReports(container, client) {
  try {
    const catalog = await client.reports();
    const published = Object.values(catalog.reports)
      .filter((report) => report.resolvedVisibility === "public")
      .sort((first, second) => first.title.localeCompare(second.title));
    if (!published.length) {
      container.replaceChildren(message("No public report is published yet.", "status"));
      return null;
    }
    const list = el("ul");
    list.className = "report-index";
    for (const report of published) list.append(reportCard(report));
    container.dataset.state = "ready";
    container.replaceChildren(list);
    return catalog;
  } catch (error) {
    container.dataset.state = "unavailable";
    container.replaceChildren(
      message(
        `${error.safeMessage || "The report catalog could not be loaded."} The links below remain available.`,
        "error",
      ),
    );
    return null;
  }
}

function boardHeader() {
  // Decorative: every cell beneath carries its own label for assistive
  // technology, so announcing the header again would double every row.
  const head = el("div");
  head.className = "board-head";
  head.setAttribute("aria-hidden", "true");
  for (const [label, className] of [
    // The caret column each summary opens with, so both grids agree.
    ["", "board-col-caret"],
    ["State", "board-col-state"],
    ["Pipeline", "board-col-name"],
    ["Kind", "board-col-kind"],
    ["Data through", "board-col-through"],
    ["Next due", "board-col-due"],
    ["Last run", "board-col-when"],
  ]) {
    const cell = el("span", label);
    cell.className = className;
    head.append(cell);
  }
  return head;
}

function filterControl(rows, onChange) {
  const field = el("fieldset");
  field.className = "board-filter";
  field.append(el("legend", "Show"));
  const group = el("div");
  group.className = "segments";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Filter pipelines");
  for (const filter of FILTERS) {
    const count = rows.filter(filter.covers).length;
    const item = el("label");
    const input = el("input");
    input.type = "radio";
    input.name = "pipeline-filter";
    input.value = filter.key;
    input.dataset.control = `filter-${filter.key}`;
    input.checked = filter.key === "all";
    input.addEventListener("change", () => onChange(filter));
    item.append(input, el("span", `${filter.label} ${count}`));
    group.append(item);
  }
  field.append(group);
  return field;
}

async function fillHealth(container, client, now) {
  try {
    const catalog = await client.status();
    // One clock for the whole list, so ordering and rendering cannot disagree
    // about which pipelines are overdue.
    const at = now();
    const rows = Object.values(catalog.pipelines).map((entry) => ({
      entry,
      resolved: derivePipelineState(entry, at),
    }));
    rows.sort(
      (first, second) =>
        STATE_ORDER[first.resolved.state] - STATE_ORDER[second.resolved.state] ||
        KIND_ORDER[first.entry.kind] - KIND_ORDER[second.entry.kind] ||
        first.entry.name.localeCompare(second.entry.name) ||
        first.entry.pipelineId.localeCompare(second.entry.pipelineId),
    );
    const board = el("div");
    board.className = "pipeline-board";
    const list = el("ul");
    list.className = "pipeline-list";
    const paint = (filter) => {
      const shown = rows.filter(filter.covers);
      list.replaceChildren(...shown.map(({ entry, resolved }) => pipelineItem(entry, resolved)));
      board.dataset.filter = filter.key;
      // An empty result is a fact about the catalog, not a fault; saying so
      // beats an unexplained blank where a list was.
      if (!shown.length) list.append(message("No pipeline is in that state.", "status"));
    };
    board.append(boardHeader(), list);
    paint(FILTERS[0]);
    container.dataset.state = "ready";
    container.replaceChildren(filterControl(rows, paint), board);
    return catalog;
  } catch (error) {
    container.dataset.state = "unavailable";
    container.replaceChildren(
      message(
        `${error.safeMessage || "Pipeline health could not be loaded."} Reports and their data are unaffected.`,
        "error",
      ),
    );
    return null;
  }
}

export function renderHome({ client = getPageStatusClient(), scenario, now = () => new Date() } = {}) {
  const active = scenarioStatusClient(client, scenario);
  const wrapper = el("div");
  wrapper.className = "site-index";

  const masthead = el("header");
  masthead.className = "site-masthead";
  const title = el("h1", "Pulse");
  const stamp = el("p");
  stamp.className = "site-stamp";
  masthead.append(title, stamp);

  const reports = el("section");
  reports.className = "site-section";
  const reportsHeading = el("h2", "Reports");
  reportsHeading.id = "report-index-heading";
  reports.setAttribute("aria-labelledby", reportsHeading.id);
  const reportsBody = el("div");
  reportsBody.dataset.reportIndex = "";
  reportsBody.dataset.state = "loading";
  reportsBody.append(message("Loading the report catalog…", "status"));
  reports.append(reportsHeading, reportsBody);

  const health = el("section");
  health.className = "site-section";
  const healthHeading = el("h2", "Pipeline health");
  healthHeading.id = "pipeline-health-heading";
  health.setAttribute("aria-labelledby", healthHeading.id);
  const healthBody = el("div");
  healthBody.dataset.pipelineHealth = "";
  healthBody.dataset.state = "loading";
  healthBody.append(message("Loading pipeline health…", "status"));
  health.append(healthHeading, healthBody);

  wrapper.append(masthead, reports, health);

  // The two fills stay independent; the qualification pass runs only if both
  // returned a catalog, and a failure in it must not unmake either half.
  const at = now();
  void Promise.all([fillReports(reportsBody, active), fillHealth(healthBody, active, now)]).then(
    ([reportCatalog, statusCatalog]) => {
      if (!statusCatalog) return;
      stamp.textContent = `Pipeline status as of ${instantLabel(statusCatalog.generatedAt)}`;
      if (!reportCatalog) return;
      for (const card of reportsBody.querySelectorAll("[data-report]")) {
        try {
          qualifyCard(card, {
            status: statusCatalog,
            reports: reportCatalog,
            reportId: card.dataset.report,
            now: at,
          });
        } catch {
          // A report whose lineage cannot be qualified keeps its link and its
          // counts; the caveat is the only thing lost.
        }
      }
    },
  );
  return wrapper;
}
