import { CONSUMER_SCHEMA, FIXTURE_ROWS } from "./fixture.js";

export const VISUAL_TEMPLATE_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  fixtureRows: FIXTURE_ROWS,
  consumerSchema: CONSUMER_SCHEMA,
  inputs: Object.freeze(["rows", "display", "provenance"]),
  cleanup: "focused callback only",
});

const STATES = new Set(["ready", "loading", "empty", "suspect", "stale", "query-error", "schema-error", "render-error", "engine-error"]);
const stateText = {
  loading: "Loading data (pending)", empty: "No observations available (empty)",
  suspect: "Data warning: affected observations (suspect)", stale: "Data warning: update is overdue (stale)",
  "query-error": "Data query failed (error)", "schema-error": "Data schema is incompatible (error)",
  "render-error": "Visual could not render (error)", "engine-error": "Shared data engine failed (error)",
};

function element(name, text, svg = false) {
  const item = svg ? document.createElementNS("http://www.w3.org/2000/svg", name) : document.createElement(name);
  if (text !== undefined) item.textContent = String(text);
  return item;
}

export function validateTemplateRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (typeof row?.label !== "string" || !Number.isFinite(Number(row?.value))) {
      throw new TypeError("Visual rows require string label and finite number value fields.");
    }
    return { label: row.label, value: Number(row.value) };
  });
}

/** Returns plain accessible DOM/SVG; it deliberately has no report, route, or data-engine dependency. */
export function renderVisualTemplate({ rows = [], display = {}, provenance = {}, state = "ready", onCleanup } = {}) {
  const root = element("section");
  root.className = "pulse-visual-template";
  root.dataset.state = STATES.has(state) ? state : "render-error";
  root.setAttribute("aria-label", display.title || "Data visual");
  const validRows = (() => { try { return validateTemplateRows(rows); } catch { root.dataset.state = "schema-error"; return []; } })();
  if (root.dataset.state === "ready" && validRows.length === 0) root.dataset.state = "empty";
  const status = root.dataset.state === "ready" ? "" : stateText[root.dataset.state] || stateText["render-error"];
  if (status) { const notice = element("p", `◆ ${status}`); notice.className = "pulse-visual-template__status"; notice.dataset.state = root.dataset.state; notice.setAttribute("role", "status"); root.append(notice); }
  const title = element("h2", display.title || "Indicator"); title.className = "pulse-visual-template__indicator"; root.append(title);
  const source = provenance.label || provenance.source || "Provenance not supplied";
  const updated = provenance.updatedAt ? ` · Updated ${provenance.updatedAt}` : "";
  const provenanceLine = element("p", `Source: ${source}${updated}`); provenanceLine.className = "pulse-visual-template__provenance"; root.append(provenanceLine);
  if (validRows.length && (root.dataset.state === "ready" || root.dataset.state === "suspect" || root.dataset.state === "stale")) renderInteractiveDemo(root, validRows, display);
  root.append(renderTable(validRows));
  let cleaned = false;
  root.cleanup = () => { if (!cleaned) { cleaned = true; onCleanup?.(); } };
  return root;
}

function renderInteractiveDemo(root, rows, display) {
  // A deliberately content-neutral SVG surface demonstrates the contract can
  // return SVG without selecting a chart vocabulary or layout.
  const svg = element("svg", undefined, true); svg.classList.add("pulse-visual-template__surface"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", display.description || "Renderer surface; use the observation controls below."); svg.append(element("title", "Renderer surface", true));
  const readout = element("p", "Selected: none"); readout.setAttribute("aria-live", "polite");
  const controls = element("div"); controls.className = "pulse-visual-template__controls"; controls.setAttribute("aria-label", "Observation selection");
  let selected = 0;
  const select = (index) => { selected = Math.max(0, Math.min(rows.length - 1, index)); [...controls.querySelectorAll("button")].forEach((button, i) => button.setAttribute("aria-pressed", String(i === selected))); readout.textContent = `Selected: ${rows[selected].label}, ${rows[selected].value}`; };
  rows.forEach((row, index) => { const button = element("button", `${row.label}: ${row.value}`); button.type = "button"; button.setAttribute("aria-pressed", String(index === 0)); button.addEventListener("click", () => select(index)); button.addEventListener("keydown", (event) => { const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0; if (direction) { event.preventDefault(); select(index + direction); controls.querySelectorAll("button")[selected].focus(); } }); controls.append(button); });
  root.append(svg, controls, readout); select(0);
}

function renderTable(rows) { const wrap = element("div"); wrap.className = "pulse-visual-template__table-wrap"; const table = element("table"); const caption = element("caption", "Accessible data"); const head = element("thead"); const header = element("tr"); for (const text of ["Label", "Value"]) header.append(element("th", text)); head.append(header); const body = element("tbody"); for (const row of rows) { const tr = element("tr"); tr.append(element("td", row.label), element("td", row.value)); body.append(tr); } table.append(caption, head, body); wrap.append(table); return wrap; }
