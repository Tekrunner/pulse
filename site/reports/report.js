import { DataClientError } from "../data/client.js";
import { getPageDataClient } from "../data/browser-shell.js";
import { renderLineVisual } from "../visuals/line.js";
import { LINE_VISUAL_CONTRACT, validateLineConsumerRows } from "../visuals/line.contract.js";

export const REPORT_DATASET_ID = "insee-cpi/monthly";
// The report selects the complete represented CPI history. The lower bound remains
// parameter-bound and comes from the compiled dataset contract, never from SQL text.
export const REPORT_SQL = "SELECT CAST(period AS VARCHAR) AS period, CAST(cpi_index AS DOUBLE) AS value FROM insee_cpi_monthly WHERE period >= CAST(? AS DATE) ORDER BY period";
export const reportParams = (dataset) => Object.freeze([dataset.representedPeriod.start]);

export function reportLink(path = "./report") {
  const link = document.createElement("a");
  link.href = path;
  link.textContent = "Open the French macroeconomic pilot";
  return link;
}

function messageState(slot, state, text, retry) {
  slot.className = `visual-slot state-${state}`;
  slot.dataset.state = state;
  slot.setAttribute("role", state === "loading" ? "status" : "alert");
  slot.setAttribute("aria-live", "polite");
  const message = document.createElement("p");
  message.textContent = text;
  const children = [message];
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Try again";
    button.addEventListener("click", retry);
    children.push(button);
  }
  slot.replaceChildren(...children);
}

function validateRows(rows) {
  try { return validateLineConsumerRows(rows); }
  catch (error) { throw new DataClientError("schema", "The report data has incompatible period or value fields.", error); }
}

function scenarioClient(client, scenario) {
  if (!scenario) return client;
  const dataset = { representedPeriod: { start: "1996-01-01", end: "2026-07-01" }, semanticMetadata: { indicators: [{ attribution: "Source: INSEE, Indice des prix à la consommation (IPC), Base 2025." }] } };
  if (scenario === "loading") return { query: () => new Promise(() => {}), getDataset: async () => dataset };
  if (scenario === "empty") return { query: async () => [], getDataset: async () => dataset };
  if (scenario === "startup") return { query: async () => { throw new DataClientError("wasm-startup", "Browser data access could not start."); }, getDataset: async () => dataset };
  if (scenario === "query") return { query: async () => { throw new DataClientError("query", "The report data could not be queried."); }, getDataset: async () => dataset };
  if (scenario === "schema") return { query: async () => [{ period: null, value: "invalid" }], getDataset: async () => dataset };
  return client;
}

export function renderReport({ client = getPageDataClient(), scenario } = {}) {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement("header");
  const eyebrow = document.createElement("p"); eyebrow.className = "eyebrow"; eyebrow.textContent = "Portable report pilot";
  const title = document.createElement("h1"); title.textContent = "French macroeconomic index";
  const provenance = document.createElement("p"); provenance.className = "provenance"; provenance.textContent = "Loading dataset provenance…";
  heading.append(eyebrow, title, provenance); fragment.append(heading);
  const slot = document.createElement("div"); fragment.append(slot);
  const activeClient = scenarioClient(client, scenario);

  const load = () => {
    messageState(slot, "loading", "Loading observations…");
    Promise.resolve().then(async () => {
      const dataset = await activeClient.getDataset(REPORT_DATASET_ID);
      const result = await activeClient.query(REPORT_DATASET_ID, REPORT_SQL, { params: reportParams(dataset) });
      return [result, dataset];
    }).then(([result, dataset]) => {
      const rows = validateRows(result);
      if (!rows.length) { messageState(slot, "empty", "No observations are available for this report."); return; }
      try {
        if (scenario === "render") throw new Error("render fixture");
        const indicator = dataset.semanticMetadata.indicators.find((item) => item.column === "cpi_index") || {};
        provenance.textContent = `INSEE CPI · ${dataset.representedPeriod.start} to ${dataset.representedPeriod.end} · ${indicator.attribution || "Published public dataset"}`;
        slot.className = "visual-slot state-ready"; slot.dataset.state = "ready"; slot.removeAttribute("role"); slot.removeAttribute("aria-live");
        slot.replaceChildren(renderLineVisual(rows, { label: "Consumer price index", unit: "index points" }));
        performance.mark("pulse:first-readable-visual");
      } catch {
        messageState(slot, "render-error", "The visual could not be rendered.", load);
      }
    }).catch((error) => {
      const state = error?.code === "wasm-startup" ? "startup-error" : error?.code === "schema" ? "schema-error" : "query-error";
      messageState(slot, state, error?.safeMessage || "The report could not load.", load);
    });
  };
  load();
  return fragment;
}

export const LINE_SLOT = Object.freeze({ datasetId: REPORT_DATASET_ID, contractVersion: LINE_VISUAL_CONTRACT.contractVersion, consumerSchema: LINE_VISUAL_CONTRACT.consumerSchema });
