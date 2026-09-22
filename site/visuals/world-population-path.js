/**
 * The world's population, its rate of change, and the range its projection
 * spans. Two plots on one x-axis, never one plot on two y-axes: a stock in
 * people and a rate in per cent are different quantities.
 *
 * The visual draws the rows and display inputs it is handed. It owns no SQL,
 * no storage and no routing, and it reaches for no other visual.
 */
import {
  axisGutter, chart, circle, dataTable, enablePicking, line, niceSpan,
  overlayLabel, people, periodYear, polyline, provenanceLine, signedPercent,
  valueStrip,
} from "./report-shared.js";
import { validateWorldPopulationPathRows } from "./world-population-path.contract.js";

const TOP = 12, HEIGHT = 236, GROWTH_TOP = 274, GROWTH_HEIGHT = 62, MAX_PAD_LEFT = 52, PAD_RIGHT = 10, SVG_HEIGHT = 372;
const MEDIUM = "#b5abfc", GROWTH = "#9dc0ae", BOUND = "#8c93a8";

export function renderWorldPopulationPath(rows, display = {}, provenance = "") {
  const observations = validateWorldPopulationPathRows(rows);
  const {
    width = 1188,
    selectedIndex = observations.length - 1,
    scenarioMode = "interval95",
    bandRows = [],
  } = display;
  const index = Math.max(0, Math.min(observations.length - 1, Number(selectedIndex) || 0));
  const fragment = document.createDocumentFragment();

  const byScenario = new Map();
  for (const row of bandRows) {
    if (!byScenario.has(row.scenario)) byScenario.set(row.scenario, new Map());
    byScenario.get(row.scenario).set(row.period, row.population_thousands);
  }
  const showBand = scenarioMode === "interval95" || scenarioMode === "bounds";
  const showNamed = scenarioMode === "highlow" || scenarioMode === "bounds";
  const lower = byScenario.get("Lower 95 PI") ?? new Map();
  const upper = byScenario.get("Upper 95 PI") ?? new Map();

  const selected = observations[index];
  const strip = [
    { color: MEDIUM, label: "Population", value: people(selected.population_thousands) },
    { color: GROWTH, label: "Rate of change", value: `${signedPercent(selected.population_growth_rate_pct)} a year` },
  ];
  if (showBand && lower.has(selected.period)) {
    strip.push({
      color: MEDIUM,
      label: "95% interval",
      value: `${people(lower.get(selected.period))}–${people(upper.get(selected.period))}`,
    });
  }
  fragment.append(valueStrip(periodYear(selected.period), strip));

  const values = observations.map((row) => row.population_thousands);
  if (showBand) for (const period of lower.keys()) { values.push(lower.get(period), upper.get(period)); }
  if (showNamed) {
    for (const name of ["High", "Low"]) {
      const series = byScenario.get(name);
      if (series) for (const value of series.values()) if (value !== null) values.push(value);
    }
  }
  const domain = niceSpan(Math.min(...values), Math.max(...values));
  const growthValues = observations.map((row) => row.population_growth_rate_pct);
  const growthDomain = niceSpan(Math.min(...growthValues, 0), Math.max(...growthValues, 0));

  // Both plots share one gutter, and it holds the labels these domains will
  // actually produce rather than the widest a population and a rate could
  // ever need.
  const populationLabel = (value) => `${(value / 1000000).toFixed(value >= 1000000 ? 1 : 2)}bn`;
  const gutterLabels = [signedPercent(growthDomain.hi, 1), signedPercent(growthDomain.lo, 1)];
  for (let value = domain.lo; value <= domain.hi + 1e-9; value += domain.step) gutterLabels.push(populationLabel(value));
  const padLeft = axisGutter(gutterLabels, { max: MAX_PAD_LEFT });

  const inner = Math.max(120, width - padLeft - PAD_RIGHT);
  const xOf = (position) => padLeft + (observations.length === 1 ? inner / 2 : (position * inner) / (observations.length - 1));
  const yOf = (value, dom, top, height) => top + height - ((value - dom.lo) / (dom.hi - dom.lo)) * height;
  const byPeriod = new Map(observations.map((row, position) => [row.period, position]));

  const label = `World population from ${periodYear(observations[0].period)} to ${periodYear(observations.at(-1).period)}, with its rate of change`;
  const { root, svg, overlay } = chart(width, SVG_HEIGHT, label);

  for (let value = domain.lo; value <= domain.hi + 1e-9; value += domain.step) {
    const y = yOf(value, domain, TOP, HEIGHT);
    line(svg, { x1: padLeft, x2: width - PAD_RIGHT, y1: y, y2: y, stroke: "rgba(233,233,237,.10)", "stroke-width": 1 });
    overlayLabel(overlay, populationLabel(value), 0, y - 8, { width: padLeft - 6, align: "right" });
  }

  if (showBand && lower.size) {
    const top = [], bottom = [];
    for (const row of observations) {
      if (!lower.has(row.period)) continue;
      const x = xOf(byPeriod.get(row.period));
      top.push(`${x},${yOf(upper.get(row.period), domain, TOP, HEIGHT)}`);
      bottom.unshift(`${x},${yOf(lower.get(row.period), domain, TOP, HEIGHT)}`);
    }
    if (top.length) polyline(svg, top.concat(bottom).join(" "), MEDIUM, 0, "", MEDIUM, 0.16);
  }
  if (showNamed) {
    for (const name of ["High", "Low"]) {
      const series = byScenario.get(name);
      if (!series) continue;
      const points = [];
      let last = null;
      for (const row of observations) {
        const value = series.get(row.period);
        if (value === undefined || value === null) continue;
        last = { x: xOf(byPeriod.get(row.period)), y: yOf(value, domain, TOP, HEIGHT) };
        points.push(`${last.x},${last.y}`);
      }
      if (!points.length) continue;
      polyline(svg, points.join(" "), BOUND, 1.5, "5 4");
      overlayLabel(overlay, `${name} fertility`, last.x - 106, last.y - 17, { width: 100, align: "right", color: BOUND });
    }
  }

  const estimate = [], projection = [];
  observations.forEach((row, position) => {
    const point = `${xOf(position)},${yOf(row.population_thousands, domain, TOP, HEIGHT)}`;
    if (row.series_kind === "estimate") estimate.push(point);
    if (row.series_kind === "projection" || (estimate.length && projection.length === 0 && row.series_kind === "projection")) projection.push(point);
  });
  const boundaryPosition = observations.findIndex((row) => row.series_kind === "projection");
  if (boundaryPosition > 0) projection.unshift(estimate.at(-1));
  if (estimate.length) polyline(svg, estimate.join(" "), MEDIUM, 2.5);
  if (projection.length) polyline(svg, projection.join(" "), MEDIUM, 2.5, "7 5");
  if (boundaryPosition > 0) {
    const x = xOf(boundaryPosition - 1);
    line(svg, { x1: x, x2: x, y1: 8, y2: TOP + HEIGHT + 10, stroke: "#75798c", "stroke-width": 1 });
    overlayLabel(overlay, "estimates", x - 76, 10, { width: 70, align: "right" });
    overlayLabel(overlay, "projection", x + 6, 10, { width: 70, align: "left" });
  }

  let peak = observations[0];
  for (const row of observations) if (row.population_thousands > peak.population_thousands) peak = row;
  if (peak.series_kind === "projection") {
    const x = xOf(byPeriod.get(peak.period)), y = yOf(peak.population_thousands, domain, TOP, HEIGHT);
    circle(svg, x, y, 4.5, "none", "#e9e9ed", 1.5);
    const right = x > width * 0.7;
    overlayLabel(overlay, `peak · ${periodYear(peak.period)} · ${people(peak.population_thousands)}`,
      right ? x - 186 : x + 10, y - 22, { width: 176, align: right ? "right" : "left", color: "#cfd3e5" });
  }

  const zeroY = yOf(0, growthDomain, GROWTH_TOP, GROWTH_HEIGHT);
  line(svg, { x1: padLeft, x2: width - PAD_RIGHT, y1: zeroY, y2: zeroY, stroke: "#75798c", "stroke-width": 1 });
  for (const kind of ["estimate", "projection"]) {
    const points = observations
      .map((row, position) => ({ row, position }))
      .filter(({ row }, offset, all) => row.series_kind === kind
        || (kind === "projection" && offset > 0 && all[offset - 1].row.series_kind === "estimate" && row.series_kind === "projection"))
      .map(({ row, position }) => `${xOf(position)},${yOf(row.population_growth_rate_pct, growthDomain, GROWTH_TOP, GROWTH_HEIGHT)}`);
    if (points.length) polyline(svg, points.join(" "), GROWTH, 2, kind === "projection" ? "7 5" : "");
  }
  overlayLabel(overlay, signedPercent(growthDomain.hi, 1), 0, yOf(growthDomain.hi, growthDomain, GROWTH_TOP, GROWTH_HEIGHT) - 8, { width: padLeft - 6, align: "right" });
  overlayLabel(overlay, signedPercent(growthDomain.lo, 1), 0, yOf(growthDomain.lo, growthDomain, GROWTH_TOP, GROWTH_HEIGHT) - 8, { width: padLeft - 6, align: "right" });
  overlayLabel(overlay, "Rate of change, % a year", padLeft + 6, GROWTH_TOP - 18, { width: 190, align: "left", color: GROWTH });

  const selectionX = xOf(index);
  line(svg, { x1: selectionX, x2: selectionX, y1: 8, y2: 350, stroke: "#e9e9ed", "stroke-width": 1, "stroke-dasharray": "3 3" });
  circle(svg, selectionX, yOf(selected.population_thousands, domain, TOP, HEIGHT), 3.5, MEDIUM);
  circle(svg, selectionX, yOf(selected.population_growth_rate_pct, growthDomain, GROWTH_TOP, GROWTH_HEIGHT), 3.5, GROWTH);

  const ticks = Math.max(2, Math.min(7, Math.floor(inner / 170)));
  for (let step = 0; step < ticks; step += 1) {
    const position = Math.round((step * (observations.length - 1)) / (ticks - 1));
    overlayLabel(overlay, periodYear(observations[position].period), Math.max(0, Math.min(width - 56, xOf(position) - 28)), 354, { width: 56 });
  }

  enablePicking(svg, observations.length, padLeft, inner);
  fragment.append(root);
  if (provenance) fragment.append(provenanceLine(provenance));
  fragment.append(dataTable(
    "World population and rate of change, by year",
    ["Year", "Kind", "Population", "Rate of change", "95% interval"],
    observations.map((row) => [
      periodYear(row.period), row.series_kind, people(row.population_thousands),
      `${signedPercent(row.population_growth_rate_pct)} a year`,
      lower.has(row.period) ? `${people(lower.get(row.period))} to ${people(upper.get(row.period))}` : "—",
    ]),
  ));
  return fragment;
}
