import { DataClientError } from "../data/client.js";
import { getPageDataClient } from "../data/browser-shell.js";
import { renderLineVisual } from "../visuals/line.js";

export const REPORT_SQL = "SELECT period, value FROM fixture_macro ORDER BY period";

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
  if (!Array.isArray(rows)) throw new DataClientError("schema", "The report data has an incompatible shape.");
  return rows.map((row) => {
    const value = Number(row.value);
    if (typeof row.period !== "string" || !Number.isFinite(value)) {
      throw new DataClientError("schema", "The report data has incompatible period or value fields.");
    }
    return { period: row.period, value };
  });
}

function scenarioClient(client, scenario) {
  if (!scenario) return client;
  if (scenario === "loading") return { query: () => new Promise(() => {}) };
  if (scenario === "empty") return { query: async () => [] };
  if (scenario === "startup") return { query: async () => { throw new DataClientError("wasm-startup", "Browser data access could not start."); } };
  if (scenario === "query") return { query: async () => { throw new DataClientError("query", "The report data could not be queried."); } };
  if (scenario === "schema") return { query: async () => [{ period: null, value: "invalid" }] };
  return client;
}

export function renderReport({ client = getPageDataClient(), scenario } = {}) {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement("header");
  const eyebrow = document.createElement("p"); eyebrow.className = "eyebrow"; eyebrow.textContent = "Portable report pilot";
  const title = document.createElement("h1"); title.textContent = "French macroeconomic index";
  const provenance = document.createElement("p"); provenance.className = "provenance"; provenance.textContent = "Representative fixture · 2024-Q4 · same-origin data";
  heading.append(eyebrow, title, provenance); fragment.append(heading);
  const slot = document.createElement("div"); fragment.append(slot);
  const activeClient = scenarioClient(client, scenario);

  const load = () => {
    messageState(slot, "loading", "Loading observations…");
    Promise.resolve().then(() => activeClient.query("fixture/macro", REPORT_SQL)).then((result) => {
      const rows = validateRows(result);
      if (!rows.length) { messageState(slot, "empty", "No observations are available for this report."); return; }
      try {
        if (scenario === "render") throw new Error("render fixture");
        slot.className = "visual-slot state-ready"; slot.dataset.state = "ready"; slot.removeAttribute("role"); slot.removeAttribute("aria-live");
        slot.replaceChildren(renderLineVisual(rows, { label: "Household activity index", unit: "index points" }));
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
