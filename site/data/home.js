/**
 * Data-driven navigation shell: the reports that exist, and the health of the
 * pipelines behind them.
 *
 * The two catalogs are read independently on purpose. Reports must stay
 * reachable when status cannot be read, and a fault while rendering health
 * must not take navigation with it.
 */
import {
  STATE_LABELS,
  derivePipelineState,
  getPageStatusClient,
  publicationDeadline,
} from "./status-client.js";
import { scenarioStatusClient } from "./status-scenarios.js";

const el = (name, text) => {
  const node = document.createElement(name);
  if (text !== undefined) node.textContent = text;
  return node;
};

const KIND_LABELS = { source: "Source pipeline", dataset: "Dataset pipeline" };
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
const KIND_ORDER = { source: 0, dataset: 1 };
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
  const through = `Data through ${monthLabel(period.end)}`;
  const deadline = publicationDeadline(period.end, entry.schedule);
  if (!deadline) return through;
  return resolved.overdue
    ? `${through} · the next observation was due ${dayLabel(deadline)}`
    : `${through} · next observation due ${dayLabel(deadline)}`;
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
  return `${output.artifactKind === "snapshot" ? "Snapshot" : "Dataset"} ${identity}${through}`;
}

function suspectWarning(entry) {
  if (!entry.assertions.length) return "";
  return `Suspect data — ${assertionSummary(entry)}`;
}

function pipelineItem(entry, resolved) {
  const item = el("li");
  item.dataset.pipeline = entry.pipelineId;
  item.dataset.state = resolved.state;
  // Compact by default: name, status and execution date, with the evidence
  // behind a disclosure. `details` is the pattern the report already uses, so
  // keyboard operation and the expand affordance come from the platform.
  const disclosure = el("details");
  const summary = el("summary");
  const compact = el("div");
  compact.className = "pipeline-summary";
  const marker = el("span", STATE_MARKERS[resolved.state]);
  marker.className = "pipeline-marker";
  marker.setAttribute("aria-hidden", "true");
  // The state is carried by text, so nothing here depends on colour alone.
  const state = el("span", STATE_LABELS[resolved.state]);
  state.className = "pipeline-state";
  const heading = el("h3", entry.name);
  heading.className = "pipeline-name";
  const kind = el("span", KIND_LABELS[entry.kind]);
  kind.className = "pipeline-kind";
  const when = el("span", entry.lastAttemptAt ? instantLabel(entry.lastAttemptAt) : "Never run");
  when.className = "pipeline-when";
  const details = el("dl");
  details.append(
    row("Freshness", freshness(entry, resolved)),
    row("Stages", stageSummary(entry)),
    row("Assertions", assertionSummary(entry)),
    row("Last attempt", entry.lastAttemptAt ? instantLabel(entry.lastAttemptAt) : "Not recorded"),
    row("Latest usable output", usableOutput(entry)),
  );
  if (entry.diagnostic) {
    // Already sanitized upstream: a code, a stage and a safe message.
    details.append(
      row(
        "Diagnostic",
        `${entry.diagnostic.code} at ${entry.diagnostic.stage} — ${entry.diagnostic.message}` +
          ` (${entry.diagnostic.retryable ? "retryable" : "not retryable"})`,
      ),
    );
  }
  if (resolved.state !== "succeeded" && resolved.state !== "not-run") item.classList.add("pipeline-degraded");
  heading.append(" ", kind);
  compact.append(marker, state, heading, when);
  // Suspect data is never hidden behind the disclosure: the compact status has
  // to say the numbers are qualified even when nobody expands the row.
  const warning = suspectWarning(entry);
  if (warning) {
    const note = el("span", warning);
    note.className = "pipeline-warning";
    compact.append(note);
  }
  summary.append(compact);
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

async function fillReports(container, client) {
  try {
    const catalog = await client.reports();
    const published = Object.values(catalog.reports)
      .filter((report) => report.resolvedVisibility === "public")
      .sort((first, second) => first.title.localeCompare(second.title));
    if (!published.length) {
      container.replaceChildren(message("No public report is published yet.", "status"));
      return;
    }
    const list = el("ul");
    list.className = "report-index";
    for (const report of published) {
      const line = el("li");
      const link = el("a", report.title);
      link.href = `./${report.route}`;
      line.append(link);
      list.append(line);
    }
    container.dataset.state = "ready";
    container.replaceChildren(list);
  } catch (error) {
    container.dataset.state = "unavailable";
    container.replaceChildren(
      message(
        `${error.safeMessage || "The report catalog could not be loaded."} The links below remain available.`,
        "error",
      ),
    );
  }
}

async function fillHealth(container, client, now) {
  try {
    const catalog = await client.status();
    const list = el("ul");
    list.className = "pipeline-list";
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
    for (const { entry, resolved } of rows) list.append(pipelineItem(entry, resolved));
    container.dataset.state = "ready";
    container.replaceChildren(list);
  } catch (error) {
    container.dataset.state = "unavailable";
    container.replaceChildren(
      message(
        `${error.safeMessage || "Pipeline health could not be loaded."} Reports and their data are unaffected.`,
        "error",
      ),
    );
  }
}

export function renderHome({ client = getPageStatusClient(), scenario, now = () => new Date() } = {}) {
  const active = scenarioStatusClient(client, scenario);
  const wrapper = el("div");
  wrapper.className = "site-index";

  const reports = el("section");
  const reportsHeading = el("h2", "Reports");
  reportsHeading.id = "report-index-heading";
  reports.setAttribute("aria-labelledby", reportsHeading.id);
  const reportsBody = el("div");
  reportsBody.dataset.reportIndex = "";
  reportsBody.dataset.state = "loading";
  reportsBody.append(message("Loading the report catalog…", "status"));
  reports.append(reportsHeading, reportsBody);

  const health = el("section");
  const healthHeading = el("h2", "Pipeline health");
  healthHeading.id = "pipeline-health-heading";
  health.setAttribute("aria-labelledby", healthHeading.id);
  const healthIntro = el(
    "p",
    "Every declared source and dataset pipeline, with the freshness of what it published. Overdue data is decided here, in the browser, against your clock.",
  );
  const healthBody = el("div");
  healthBody.dataset.pipelineHealth = "";
  healthBody.dataset.state = "loading";
  healthBody.append(message("Loading pipeline health…", "status"));
  health.append(healthHeading, healthIntro, healthBody);

  wrapper.append(reports, health);
  void fillReports(reportsBody, active);
  void fillHealth(healthBody, active, now);
  return wrapper;
}
