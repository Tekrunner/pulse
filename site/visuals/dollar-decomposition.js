/**
 * French GDP in current US dollars and in constant dollars at the provider's
 * base year, and each year's change split into real growth, the GDP deflator
 * and the euro against the dollar, in log points.
 *
 * The level is linear, both series on one axis: they meet in the base year. Below it each year's three terms are stacked from zero,
 * rises above and falls below, and the net change in dollar GDP is a white
 * tick, so the sum is read without arithmetic. Both plots share one year axis:
 * the represented period intersected with the published span. The first
 * published year has no change and draws no bar.
 */
import {
  FRAME, dataTable, drawFrame, grouped, legendRow, line, linearTicks, niceLinear, node,
  plotBox, plotCaption, polyline, provenanceLine, rect, signedGrouped, valueStrip, warning,
  yearHits, yearScale, yearTicks,
} from "./report-shared.js";
import { validateDollarDecompositionRows } from "./dollar-decomposition.contract.js";

const MUTED = "#abb5c5", RATE = "#b5abfc", CONSTANT = "#73d6c2";
const TERMS = Object.freeze([
  ["real_growth_log_points", "Real growth", "#73d6c2"],
  ["deflator_change_log_points", "Deflator change", "#d09a6a"],
  ["exchange_rate_change_log_points", "Euro against the dollar", RATE],
]);
const LEVEL = Object.freeze({ height: 220, top: 24, bottom: 190 });
const CHANGE = Object.freeze({ height: 280, top: 24, bottom: 250 });
const X0 = 64, PAD_RIGHT = 12;

const yearOf = (period) => Number(period.slice(0, 4));

export function renderDollarDecomposition(rows, display = {}, provenance = "") {
  const observations = validateDollarDecompositionRows(rows);
  const { width = 1188, selectedYear, notes = [] } = display;
  const years = observations.map((row) => yearOf(row.period));
  const from = Math.max(display.from ?? Math.min(...years), Math.min(...years));
  const to = Math.min(display.to ?? Math.max(...years), Math.max(...years));
  const year = selectedYear ?? to;
  const X1 = width - PAD_RIGHT;
  const xs = yearScale(from, to, X0, X1);
  const ticks = yearTicks(xs);
  const shown = observations.filter((row) => yearOf(row.period) >= from && yearOf(row.period) <= to);
  const changed = shown.filter((row) => row.dollar_change_log_points !== null);

  // Level: a linear axis from zero.
  const levelDomain = niceLinear(0, Math.max(...shown.map((row) => Math.max(row.gdp_current_usd_bn, row.gdp_constant_usd_bn))), true);
  const baseYear = observations[0]?.constant_usd_base_year ?? null;
  const constantLabel = `Constant ${baseYear} US$`;
  const ly = (value) => LEVEL.bottom - ((value - levelDomain.lo) / (levelDomain.hi - levelDomain.lo)) * (LEVEL.bottom - LEVEL.top);

  // Change: the domain holds every year's positive stack and negative stack.
  let lo = 0, hi = 0;
  for (const row of changed) {
    let up = 0, down = 0;
    for (const [key] of TERMS) { if (row[key] > 0) up += row[key]; else down += row[key]; }
    hi = Math.max(hi, up);
    lo = Math.min(lo, down);
  }
  const changeDomain = niceLinear(lo, hi, true);
  const dy = (value) => CHANGE.bottom - ((value - changeDomain.lo) / (changeDomain.hi - changeDomain.lo)) * (CHANGE.bottom - CHANGE.top);

  const selected = shown.find((row) => yearOf(row.period) === year) ?? null;
  const selectedX = xs.x(year + 0.5);
  const selectionShown = year >= from && year <= to;

  const figure = node("figure");

  // Level.
  figure.append(plotCaption(`GDP in current and constant ${baseYear} US dollars`));
  figure.append(valueStrip(String(year), selected ? [
    { color: FRAME.mark, label: "Current US$", value: `${grouped(selected.gdp_current_usd_bn, 0)} bn $` },
    { color: CONSTANT, label: constantLabel, value: `${grouped(selected.gdp_constant_usd_bn, 0)} bn $` },
    { color: RATE, label: "Euros per dollar", value: grouped(selected.eur_per_usd, 3) },
    { color: FRAME.mark, label: "Change", value: signedGrouped(selected.dollar_change_pct, 1, " %") },
  ] : [{ color: MUTED, label: "Not published for this year", value: "" }]));

  const level = plotBox(width, LEVEL.height, `French GDP in current US dollars and in constant ${baseYear} US dollars from ${from} to ${to}, linear scale; selected year ${year}`);
  drawFrame(level.svg, level.overlay, {
    x0: X0, x1: X1, top: LEVEL.top, bottom: LEVEL.bottom,
    yTicks: linearTicks(levelDomain, ly, (value) => grouped(value, 0)), xTicks: ticks, unit: "bn $",
  });
  polyline(level.svg, shown.map((row) => `${xs.x(yearOf(row.period) + 0.5).toFixed(1)},${ly(row.gdp_constant_usd_bn).toFixed(1)}`).join(" "), CONSTANT, 2.2);
  polyline(level.svg, shown.map((row) => `${xs.x(yearOf(row.period) + 0.5).toFixed(1)},${ly(row.gdp_current_usd_bn).toFixed(1)}`).join(" "), FRAME.mark, 2.2);
  if (selectionShown) line(level.svg, { x1: selectedX, x2: selectedX, y1: LEVEL.top, y2: LEVEL.bottom, stroke: FRAME.mark, "stroke-dasharray": "3 3" });
  yearHits(level.svg, xs, LEVEL.top, LEVEL.bottom);
  figure.append(level.box);
  figure.append(legendRow([
    { shape: "line", color: FRAME.mark, label: "Current US$" },
    { shape: "line", color: CONSTANT, label: constantLabel },
  ]));

  // Change and its three terms.
  figure.append(plotCaption("Change in dollar GDP and its three terms"));
  figure.append(valueStrip(String(year), selected && selected.dollar_change_log_points !== null
    ? [{ color: FRAME.mark, label: "Dollar GDP", value: signedGrouped(selected.dollar_change_log_points, 1, " lp") }]
      .concat(TERMS.map(([key, label, color]) => ({ color, label, value: signedGrouped(selected[key], 1, " lp") })))
    : [{ color: MUTED, label: "No change for this year", value: "" }]));

  const change = plotBox(width, CHANGE.height,
    `Change in dollar GDP from ${from} to ${to}, in log points: stacked bars of real growth, deflator change and the euro against the dollar, with the net change as a tick; selected year ${year}`);
  drawFrame(change.svg, change.overlay, {
    x0: X0, x1: X1, top: CHANGE.top, bottom: CHANGE.bottom,
    yTicks: linearTicks(changeDomain, dy, (value) => signedGrouped(value, 0, "")), xTicks: ticks, unit: "log points (+10 ≈ +10.5 %)",
  });
  const netTicks = [];
  for (const row of changed) {
    const x = xs.x(yearOf(row.period)) + xs.step * 0.14, barWidth = Math.max(1, xs.step * 0.72);
    let up = 0, down = 0;
    for (const [key, , color] of TERMS) {
      const value = row[key];
      if (!value) continue;
      const start = value > 0 ? up : down, end = start + value;
      if (value > 0) up = end; else down = end;
      rect(change.svg, x, Math.min(dy(start), dy(end)), barWidth, Math.max(0.5, Math.abs(dy(end) - dy(start))), color);
    }
    netTicks.push([x - 1, barWidth + 2, dy(row.dollar_change_log_points) - 1.25]);
  }
  // The net ticks sit above every stack.
  for (const [x, tickWidth, y] of netTicks) rect(change.svg, x, y, tickWidth, 2.5, FRAME.mark);
  if (selectionShown) line(change.svg, { x1: selectedX, x2: selectedX, y1: CHANGE.top, y2: CHANGE.bottom, stroke: FRAME.mark, "stroke-dasharray": "3 3" });
  yearHits(change.svg, xs, CHANGE.top, CHANGE.bottom);
  figure.append(change.box);

  figure.append(legendRow(TERMS.map(([, label, color]) => ({ shape: "box", color, label }))
    .concat([{ shape: "bar", color: FRAME.mark, label: "Change in dollar GDP" }])));

  for (const note of notes) figure.append(warning(note.label, note.text));
  if (provenance) figure.append(provenanceLine(provenance));

  const table = shown.slice().reverse().map((row) => [
    String(yearOf(row.period)), grouped(row.gdp_current_usd_bn, 0), grouped(row.gdp_constant_usd_bn, 0), grouped(row.eur_per_usd, 3),
    signedGrouped(row.dollar_change_log_points, 1, " lp"),
    ...TERMS.map(([key]) => signedGrouped(row[key], 1, " lp")),
  ]);
  figure.append(dataTable("Dollar GDP and its three terms in the represented period, newest first",
    ["Year", "Current US$, bn", `${constantLabel}, bn`, "Euros per dollar", "Change in dollar GDP", "Real growth", "Deflator change", "Euro against the dollar"], table,
    { summary: "Data table — dollar GDP and its terms in the window", numeric: true }));
  return figure;
}

export { DOLLAR_DECOMPOSITION_VISUAL_CONTRACT } from "./dollar-decomposition.contract.js";
