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

function pipelineItem(entry, now) {
  const resolved = derivePipelineState(entry, now);
  const item = el("li");
  item.dataset.pipeline = entry.pipelineId;
  item.dataset.state = resolved.state;
  const heading = el("h3", entry.name);
  const kind = el("span", KIND_LABELS[entry.kind]);
  kind.className = "pipeline-kind";
  // The state is carried by text, so nothing here depends on colour alone.
  const state = el("p", STATE_LABELS[resolved.state]);
  state.className = "pipeline-state";
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
  item.append(heading, state, details);
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
    for (const entry of Object.values(catalog.pipelines).sort((first, second) =>
      first.pipelineId.localeCompare(second.pipelineId),
    )) {
      list.append(pipelineItem(entry, now()));
    }
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
