/**
 * GDP split into adjusted labour income, adjusted capital income and net
 * taxes, each a share of GDP at current prices, as four small multiples.
 *
 * Each panel has its own vertical scale, so shares that move by a few tenths
 * of a point stay visible; levels are compared by the number in the panel
 * title, not by height. Compensation of employees alone, unadjusted, is
 * dashed in the labour panel so the adjustment reads as the gap between the
 * two lines.
 */
import {
  FRAME, circle, dataTable, drawFrame, grouped, line, linearTicks, niceLinear, node,
  panelGrid, plotBox, polyline, provenanceLine, valueStrip, warning, yearHits, yearScale, yearTicks,
} from "./report-shared.js";
import { validateIncomeSharePanelsRows } from "./income-share-panels.contract.js";

const LAYERS = Object.freeze([
  Object.freeze({ key: "labour_share_pct", label: "Labour income, adjusted", color: "#73d6c2" }),
  Object.freeze({ key: "capital_share_pct", label: "Capital income, adjusted", color: "#d09a6a" }),
  Object.freeze({ key: "taxes_on_production_share_pct", label: "Net taxes on production", color: "#8c93a8" }),
  Object.freeze({ key: "taxes_on_products_share_pct", label: "Net taxes on products", color: "#9aa6c0" }),
]);
const COMPENSATION = Object.freeze({ key: "compensation_share_pct", label: "Compensation of employees alone" });
const PLOT = Object.freeze({ height: 180, top: 20, bottom: 150 });
const X0 = 48, PAD_RIGHT = 8, FONT = 10.5, COLUMNS = 2;
// `.gdp-report .panels` gap and `.gdp-report .panel` padding in style.css.
const GRID = Object.freeze({ gap: 10, padding: 10, readable: 320 });

const yearOf = (period) => Number(period.slice(0, 4));

export function renderIncomeSharePanels(rows, display = {}, provenance = "") {
  const observations = validateIncomeSharePanelsRows(rows);
  const { width = 1188, selectedYear, notes = [] } = display;
  const years = observations.map((row) => yearOf(row.period));
  const first = Math.min(...years), last = Math.max(...years);
  const from = Math.max(display.from ?? first, first);
  const to = Math.min(display.to ?? last, last);
  const year = selectedYear ?? to;
  const inWindow = observations.filter((row) => yearOf(row.period) >= from && yearOf(row.period) <= to)
    .sort((a, b) => a.period.localeCompare(b.period));
  const selected = inWindow.find((row) => yearOf(row.period) === year) ?? null;

  const { columns, width: panelWidth } = panelGrid(width, COLUMNS, GRID);
  const X1 = panelWidth - PAD_RIGHT;
  const xs = yearScale(from, to, X0, X1);
  const xTicks = yearTicks(xs, 8);
  const selectedX = xs.x(Math.min(Math.max(year, from), to) + 0.5);

  const figure = node("figure");

  figure.append(valueStrip(String(year), selected
    ? LAYERS.map((layer) => ({ color: layer.color, label: layer.label, value: `${grouped(selected[layer.key], 1)} %` }))
      .concat([{ color: FRAME.mark, label: COMPENSATION.label, value: `${grouped(selected[COMPENSATION.key], 1)} %` }])
    : [{ color: FRAME.unit, label: "No annual accounts for this year", value: "" }]));

  const grid = node("div");
  grid.className = "panels";
  grid.style.setProperty("--panel-columns", String(columns));
  LAYERS.forEach((layer, index) => {
    const labour = index === 0;
    const values = inWindow.map((row) => row[layer.key]).concat(labour ? inWindow.map((row) => row[COMPENSATION.key]) : []);
    const domain = niceLinear(Math.min(...values) - 0.5, Math.max(...values) + 0.5, false);
    const y = (value) => PLOT.bottom - ((value - domain.lo) / (domain.hi - domain.lo)) * (PLOT.bottom - PLOT.top);
    const points = (key) => inWindow.map((row) => `${xs.x(yearOf(row.period) + 0.5).toFixed(1)},${y(row[key]).toFixed(1)}`).join(" ");

    const panel = node("figure");
    panel.className = "panel";
    const title = node("div");
    title.className = "t";
    const name = node("span");
    const swatch = node("i");
    Object.assign(swatch.style, { display: "inline-block", width: "10px", height: "10px", marginRight: "6px", borderRadius: "2px", background: layer.color });
    name.append(swatch, document.createTextNode(layer.label));
    const value = node("span", selected ? `${grouped(selected[layer.key], 1)} %` : "—");
    value.className = "num";
    title.append(name, value);
    panel.append(title);

    const plot = plotBox(panelWidth, PLOT.height,
      `${layer.label} as a share of GDP, ${from} to ${to}${labour ? ", with compensation of employees alone dashed" : ""}; selected year ${year}${selected ? "" : ", not published"}`);
    drawFrame(plot.svg, plot.overlay, {
      x0: X0, x1: X1, top: PLOT.top, bottom: PLOT.bottom, size: FONT, unit: "% of GDP", xTicks,
      // The artboard's panel frame draws every gridline alike, zero included.
      zeroStroke: FRAME.grid,
      yTicks: linearTicks(domain, y, (tick) => grouped(tick, domain.step < 1 ? 1 : 0)),
    });
    if (labour) polyline(plot.svg, points(COMPENSATION.key), FRAME.mark, 1.5, "6 4");
    polyline(plot.svg, points(layer.key), layer.color, 2.4);
    line(plot.svg, { x1: selectedX, x2: selectedX, y1: PLOT.top, y2: PLOT.bottom, stroke: FRAME.mark, "stroke-dasharray": "3 3" });
    if (selected) circle(plot.svg, selectedX, y(selected[layer.key]), 4, FRAME.ground, FRAME.mark, 1.8);
    yearHits(plot.svg, xs, PLOT.top, PLOT.bottom);
    panel.append(plot.box);

    if (labour) {
      const legend = node("span");
      legend.className = "muted";
      legend.style.fontSize = "11.5px";
      const dash = node("i");
      Object.assign(dash.style, { display: "inline-block", width: "16px", borderTop: `1.5px dashed ${FRAME.mark}`, marginRight: "6px", verticalAlign: "middle" });
      legend.append(dash, document.createTextNode("Compensation of employees alone, unadjusted"));
      panel.append(legend);
    }
    grid.append(panel);
  });
  figure.append(grid);

  for (const note of notes) figure.append(warning(note.label, note.text));
  if (provenance) figure.append(provenanceLine(provenance));

  const table = inWindow.slice().reverse().map((row) => [String(yearOf(row.period)),
    ...LAYERS.map((layer) => grouped(row[layer.key], 1)), grouped(row[COMPENSATION.key], 1)]);
  figure.append(dataTable("Shares of GDP at current prices in the represented period, %",
    ["Year", ...LAYERS.map((layer) => layer.label), `${COMPENSATION.label}, unadjusted`], table,
    { summary: "Data table — shares of GDP in the window", numeric: true }));
  return figure;
}

export { INCOME_SHARE_PANELS_VISUAL_CONTRACT } from "./income-share-panels.contract.js";
