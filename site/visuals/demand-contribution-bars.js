/**
 * Contributions of five demand components to real GDP growth, one diverging
 * stacked bar per year: positive contributions stack upward from zero and
 * negative ones downward, so each bar's net equals the growth drawn as a dot.
 */
import {
  FRAME, circle, dataTable, drawFrame, legendRow, line, linearTicks, niceLinear, node,
  plotBox, plotCaption, provenanceLine, rect, signedGrouped, valueStrip, warning, yearHits,
  yearScale, yearTicks,
} from "./report-shared.js";
import { validateDemandContributionBarsRows } from "./demand-contribution-bars.contract.js";

const KEYS = Object.freeze([
  ["households_pt", "Households' consumption", "#8fb0d1"],
  ["government_pt", "Government consumption", "#b5abfc"],
  ["investment_pt", "Fixed investment", "#d09a6a"],
  ["inventories_pt", "Inventories", "#8c93a8"],
  ["net_trade_pt", "Net trade", "#9dc0ae"],
]);
const PLOT = Object.freeze({ height: 320, top: 24, bottom: 288 });
const X0 = 64, PAD_RIGHT = 12;

const yearOf = (period) => Number(period.slice(0, 4));

export function renderDemandContributionBars(rows, display = {}, provenance = "") {
  const observations = validateDemandContributionBarsRows(rows);
  const { width = 1188, notes = [] } = display;
  const years = observations.map((row) => yearOf(row.period));
  const first = years.length ? Math.min(...years) : display.from, last = years.length ? Math.max(...years) : display.to;
  // The window intersected with the published span.
  const from = Math.max(display.from ?? first, first);
  const to = Math.min(display.to ?? last, last);
  const year = display.selectedYear ?? to;
  const X1 = width - PAD_RIGHT;
  const { top, bottom } = PLOT;
  const xs = yearScale(from, to, X0, X1);
  const inWindow = observations.filter((row) => yearOf(row.period) >= from && yearOf(row.period) <= to);

  // The domain holds every bar's positive and negative stack and every growth dot.
  let lo = 0, hi = 0;
  for (const row of inWindow) {
    let positive = 0, negative = 0;
    for (const [key] of KEYS) {
      const value = row[key];
      if (value > 0) positive += value; else if (value !== null) negative += value;
    }
    hi = Math.max(hi, positive, row.gdp_growth_pct);
    lo = Math.min(lo, negative, row.gdp_growth_pct);
  }
  const domain = niceLinear(lo, hi, true);
  const y = (value) => bottom - ((value - domain.lo) / (domain.hi - domain.lo)) * (bottom - top);

  const figure = node("figure");
  figure.append(plotCaption("Contributions to annual real GDP growth"));

  const selected = observations.find((row) => yearOf(row.period) === year) ?? null;
  const strip = selected
    ? KEYS.map(([key, label, color]) => ({ color, label, value: signedGrouped(selected[key], 2, " pt") }))
      .concat([{ color: FRAME.mark, label: "Real GDP growth", value: signedGrouped(selected.gdp_growth_pct, 2, " %") }])
    : [{ color: FRAME.unit, label: "No contributions published for this year", value: "" }];
  figure.append(valueStrip(String(year), strip));

  const plot = plotBox(width, PLOT.height,
    `Contributions of households' consumption, government consumption, fixed investment, inventories and net trade to real GDP growth, stacked above and below zero, with real GDP growth as a dot, from ${from} to ${to}; selected year ${year}`);
  drawFrame(plot.svg, plot.overlay, {
    x0: X0, x1: X1, top, bottom,
    yTicks: linearTicks(domain, y, (value) => signedGrouped(value, 0, "")), xTicks: yearTicks(xs),
    unit: "percentage points of GDP growth",
  });
  const dots = [];
  for (const row of inWindow) {
    const rowYear = yearOf(row.period);
    const x = xs.x(rowYear) + xs.step * 0.14, barWidth = Math.max(1, xs.step * 0.72);
    let positive = 0, negative = 0;
    for (const [key, , color] of KEYS) {
      const value = row[key];
      if (!value) continue;
      const start = value > 0 ? positive : negative, end = start + value;
      if (value > 0) positive = end; else negative = end;
      rect(plot.svg, x, Math.min(y(start), y(end)), barWidth, Math.max(0.5, Math.abs(y(end) - y(start))), color);
    }
    dots.push({ x: x + barWidth / 2, y: y(row.gdp_growth_pct), r: rowYear === year ? 5 : Math.min(4, Math.max(2.4, xs.step * 0.3)) });
  }
  for (const dot of dots) circle(plot.svg, dot.x, dot.y, dot.r, FRAME.mark, FRAME.ground, 1.2);
  if (year >= from && year <= to) {
    const selectedX = xs.x(year + 0.5);
    line(plot.svg, { x1: selectedX, x2: selectedX, y1: top, y2: bottom, stroke: FRAME.mark, "stroke-dasharray": "3 3" });
  }
  yearHits(plot.svg, xs, top, bottom);
  figure.append(plot.box);

  figure.append(legendRow(KEYS.map(([, label, color]) => ({ shape: "box", color, label }))
    .concat([{ shape: "dot", color: FRAME.mark, label: "Real GDP growth" }])));

  for (const note of notes) figure.append(warning(note.label, note.text));
  if (provenance) figure.append(provenanceLine(provenance));

  const table = inWindow.slice().sort((a, b) => b.period.localeCompare(a.period))
    .map((row) => [String(yearOf(row.period)), ...KEYS.map(([key]) => signedGrouped(row[key], 2)), signedGrouped(row.gdp_growth_pct, 2)]);
  figure.append(dataTable("Contributions to annual real GDP growth in the represented period",
    ["Year", ...KEYS.map(([, label]) => label), "Real GDP growth"], table,
    { summary: "Data table — contributions in the window", numeric: true }));
  return figure;
}

export { DEMAND_CONTRIBUTION_BARS_VISUAL_CONTRACT } from "./demand-contribution-bars.contract.js";
