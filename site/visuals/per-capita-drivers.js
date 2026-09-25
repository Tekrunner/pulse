/**
 * What drives GDP per inhabitant: its four multiplicative factors, which add
 * up in logs.
 *
 * Over time, France's cumulative log-point change since the base year in GDP
 * per inhabitant (constant 2020 PPP) and in output per hour, hours per worker,
 * the employment rate of people aged 15 to 64 and their share of the
 * population; years whose working-age share is a UN projection are dotted.
 * Across economies, in the selected year at current PPP, one diverging stacked
 * bar per economy: its log-point gap to France split into the four factors,
 * with a white tick for the total. An economy without a working-age share
 * shows employment per inhabitant unsplit; one whose labour inputs are
 * screened out or not published is named beneath instead of drawn.
 */
import {
  FRAME, anchoredLabel, dataTable, drawFrame, grouped, legendRow, line, linearTicks, niceLinear,
  node, plotBox, plotCaption, polyline, provenanceLine, rect, signedGrouped, valueStrip,
  warning, yearHits, yearScale, yearTicks,
} from "./report-shared.js";
import { validatePerCapitaDriversRows } from "./per-capita-drivers.contract.js";

const TOTAL = "#f0f3f8", UNSPLIT = "#6c7a93", ZERO = "rgba(115,214,194,.7)";
const OVER_TIME = Object.freeze({ height: 300, top: 24, bottom: 270 });
const X0 = 64, PAD_RIGHT = 12, GAP_RIGHT = 18, FIRST_YEAR = 1970;

const yearOf = (period) => Number(period.slice(0, 4));
const logPoints = (value, reference) => 100 * Math.log(value / reference);
const kUsd = (value) => (value === null || value === undefined ? "—" : `${grouped(value / 1000, 1)} k$`);
const employmentRate = (row) => (row.working_age_share ? row.employment_per_capita / row.working_age_share : null);

// Each factor: its label, its colour, its constant-price value and its current-price value.
const FACTORS = Object.freeze([
  ["Output per hour", "#73d6c2", (row) => row.gdp_per_hour_ppp_constant_2020_usd, (row) => row.gdp_per_hour_ppp_current_usd],
  ["Hours per worker", "#f2b872", (row) => row.hours_per_worker, (row) => row.hours_per_worker],
  ["Employment rate, 15–64", "#8fb0d1", employmentRate, employmentRate],
  ["Working-age share", "#b5abfc", (row) => row.working_age_share, (row) => row.working_age_share],
]);

export function renderPerCapitaDrivers(rows, display = {}, provenance = "") {
  const observations = validatePerCapitaDriversRows(rows);
  const { width = 1188, selectedYear, notes = [], france = { code: "FRA", colour: "#73d6c2" }, comparators = [], aggregate = null } = display;
  const windowFrom = Math.max(display.from ?? FIRST_YEAR, FIRST_YEAR), windowTo = display.to ?? Infinity;
  const shown = observations.filter((row) => yearOf(row.period) >= windowFrom && yearOf(row.period) <= windowTo);
  const byArea = new Map();
  for (const row of shown) {
    if (!byArea.has(row.reference_area_code)) byArea.set(row.reference_area_code, new Map());
    byArea.get(row.reference_area_code).set(yearOf(row.period), row);
  }
  const franceRows = byArea.get(france.code) ?? new Map();
  const franceYears = [...franceRows.keys()];

  // The window intersected with France's own published span.
  const from = franceYears.length ? Math.max(windowFrom, Math.min(...franceYears)) : windowFrom;
  const to = franceYears.length ? Math.min(windowTo, Math.max(...franceYears)) : Math.min(windowTo, from);
  const year = selectedYear ?? to;
  const base = display.baseYear ?? from;
  const baseRow = franceRows.get(base) ?? null;
  const { top, bottom } = OVER_TIME;
  const X1 = width - PAD_RIGHT;
  const xs = yearScale(from, to, X0, X1);

  // Cumulative log-point changes since the base year; each point carries its projection flag.
  const values = [0];
  const pathOf = (valueOf) => {
    const points = [];
    for (let y = from; y <= to; y += 1) {
      const row = franceRows.get(y);
      if (!row || !baseRow) continue;
      const value = logPoints(valueOf(row), valueOf(baseRow));
      if (!Number.isFinite(value)) continue;
      points.push([y, value, row.working_age_share_is_projection === true]);
      values.push(value);
    }
    return points;
  };
  const factorPaths = FACTORS.map((factor) => pathOf(factor[2]));
  const totalPath = pathOf((row) => row.gdp_per_capita_ppp_constant_2020_usd);
  const domain = niceLinear(Math.min(...values), Math.max(...values), true);
  const yv = (value) => top + (bottom - top) - ((value - domain.lo) / (domain.hi - domain.lo)) * (bottom - top);
  // Solid through estimated years; dotted over projected ones, starting from the last estimate.
  const toPoints = (list, projected) => list
    .filter((point, index) => (projected ? point[2] || (list[index + 1] && list[index + 1][2]) : !point[2]))
    .map((point) => `${xs.x(point[0] + 0.5).toFixed(1)},${yv(point[1]).toFixed(1)}`).join(" ");

  const selectedRow = franceRows.get(year) ?? null;
  const strip = selectedRow && baseRow
    ? [{ color: TOTAL, label: "GDP per inhabitant", value: signedGrouped(logPoints(selectedRow.gdp_per_capita_ppp_constant_2020_usd, baseRow.gdp_per_capita_ppp_constant_2020_usd), 1, " lp") }]
      .concat(FACTORS.map((factor) => ({ color: factor[1], label: factor[0], value: signedGrouped(logPoints(factor[2](selectedRow), factor[2](baseRow)), 1, " lp") })))
    : [{ color: FRAME.unit, label: "Not published for this year", value: "" }];

  const root = node("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "12px";

  // France over time.
  const overTime = node("figure");
  overTime.append(plotCaption(`France: cumulative change since ${base}`));
  overTime.append(valueStrip(String(year), strip));
  const plot = plotBox(width, OVER_TIME.height,
    `France: cumulative change in GDP per inhabitant and its four factors, in log points since ${base}, from ${from} to ${to}; working-age share projections dotted; selected year ${year}`);
  drawFrame(plot.svg, plot.overlay, {
    x0: X0, x1: X1, top, bottom,
    yTicks: linearTicks(domain, yv, (value) => signedGrouped(value, 0, "")), xTicks: yearTicks(xs),
    unit: `log points since ${base} (+10 ≈ +10.5 %)`,
  });
  const drawPath = (list, color, strokeWidth) => {
    for (const projected of [false, true]) {
      const points = toPoints(list, projected);
      if (!points) continue;
      polyline(plot.svg, points, color, strokeWidth, projected ? "2 3" : "").setAttribute("stroke-linecap", "butt");
    }
  };
  factorPaths.forEach((path, index) => drawPath(path, FACTORS[index][1], 2));
  drawPath(totalPath, TOTAL, 2.6);
  const selectedX = xs.x(Math.min(Math.max(year, from), to) + 0.5);
  line(plot.svg, { x1: selectedX, x2: selectedX, y1: top, y2: bottom, stroke: FRAME.mark, "stroke-dasharray": "3 3" });
  yearHits(plot.svg, xs, top, bottom);
  overTime.append(plot.box);
  overTime.append(legendRow([{ color: TOTAL, label: "GDP per inhabitant", shape: "line" }]
    .concat(FACTORS.map((factor) => ({ color: factor[1], label: factor[0], shape: "line" })))));
  root.append(overTime);

  // Gap to France in the selected year, split into the four factors.
  const nameOf = (code) => observations.find((row) => row.reference_area_code === code)?.reference_area_name ?? code;
  const economies = comparators.map((item) => ({ code: item.code, colour: item.colour, name: nameOf(item.code) }));
  if (aggregate) economies.push({ code: aggregate.code, colour: aggregate.colour, name: aggregate.name });
  const franceNow = franceRows.get(year) ?? null;
  const gaps = [], missing = [], table = [];
  const addTable = (name, row) => {
    if (!row) { table.push([name, "—", "—", "—", "—", "—"]); return; }
    table.push([
      name, kUsd(row.gdp_per_capita_ppp_current_usd),
      row.gdp_per_hour_ppp_current_usd === null ? "—" : `${grouped(row.gdp_per_hour_ppp_current_usd, 1)} $`,
      row.hours_per_worker === null ? "—" : grouped(row.hours_per_worker, 0),
      row.working_age_share && row.employment_per_capita !== null ? `${grouped(100 * row.employment_per_capita / row.working_age_share, 1)} %` : "—",
      row.working_age_share ? `${grouped(100 * row.working_age_share, 1)} %` : "—",
    ]);
  };
  addTable(franceNow?.reference_area_name ?? "France", franceNow);
  for (const economy of economies) {
    const row = byArea.get(economy.code)?.get(year) ?? null;
    addTable(economy.name, row);
    if (!row || !franceNow || row.gdp_per_capita_ppp_current_usd === null || franceNow.gdp_per_capita_ppp_current_usd === null) {
      missing.push({ name: economy.name, text: `no GDP per inhabitant for ${year}.` });
      continue;
    }
    if (row.labour_input_is_plausible !== true) {
      missing.push({ name: economy.name, text: row.labour_input_is_plausible === false
        ? "published hours fail the plausibility screen; the gap is not split."
        : `hours, employment or population not published for ${year}; the gap is not split.` });
      continue;
    }
    const parts = [
      [FACTORS[0], logPoints(row.gdp_per_hour_ppp_current_usd, franceNow.gdp_per_hour_ppp_current_usd)],
      [FACTORS[1], logPoints(row.hours_per_worker, franceNow.hours_per_worker)],
    ];
    if (row.working_age_share) {
      parts.push([FACTORS[2], logPoints(employmentRate(row), employmentRate(franceNow))]);
      parts.push([FACTORS[3], logPoints(row.working_age_share, franceNow.working_age_share)]);
    } else {
      parts.push([["Employment per inhabitant (not split)", UNSPLIT], logPoints(row.employment_per_capita, franceNow.employment_per_capita)]);
    }
    const total = logPoints(row.gdp_per_capita_ppp_current_usd, franceNow.gdp_per_capita_ppp_current_usd);
    if (!Number.isFinite(total) || parts.some((part) => !Number.isFinite(part[1]))) {
      missing.push({ name: economy.name, text: `France's labour inputs are not published for ${year}; the gap is not split.` });
      continue;
    }
    gaps.push({ economy, total, parts });
  }
  let extent = 10;
  for (const gap of gaps) {
    let up = 0, down = 0;
    for (const part of gap.parts) { if (part[1] > 0) up += part[1]; else down += part[1]; }
    extent = Math.max(extent, up, -down, Math.abs(gap.total));
  }
  const gapDomain = niceLinear(-extent, extent, true);
  // The label column narrows on small widths so the bars keep their room.
  const L = width >= 700 ? 200 : 130, R = width - GAP_RIGHT;
  const gx = (value) => L + ((value - gapDomain.lo) / (gapDomain.hi - gapDomain.lo)) * (R - L);
  const gapBottom = 30 + Math.max(1, gaps.length) * 46;

  const across = node("figure");
  across.style.paddingTop = "8px";
  across.append(plotCaption(`Gap to France in GDP per inhabitant, ${year}, current PPP`));
  const explainer = node("p", "Each bar is how much higher (right) or lower (left) an economy's GDP per inhabitant is than France's, split into the four factors. A country with longer working hours than France has a hours segment to the right; one with lower output per hour has a productivity segment to the left. The white tick is the total gap.");
  explainer.className = "lede";
  explainer.style.fontSize = "13px";
  across.append(explainer);
  const gapPlot = plotBox(width, gapBottom + 26, gaps.length
    ? `Gap to France in GDP per inhabitant in ${year}, current PPP, in log points, split into four factors, with the total as a tick: ${gaps.map((gap) => `${gap.economy.name} ${signedGrouped(gap.total, 1, " lp")}`).join(", ")}`
    : `Gap to France in GDP per inhabitant in ${year}: no economy can be drawn`);
  for (const tick of linearTicks(gapDomain, gx, (value) => signedGrouped(value, 0, ""))) {
    line(gapPlot.svg, { x1: tick.y, x2: tick.y, y1: 18, y2: gapBottom, stroke: tick.zero ? ZERO : FRAME.grid });
    line(gapPlot.svg, { x1: tick.y, x2: tick.y, y1: gapBottom, y2: gapBottom + 5, stroke: FRAME.axis });
    anchoredLabel(gapPlot.overlay, tick.t, tick.y, gapBottom + 8, "middle", { top: true });
  }
  line(gapPlot.svg, { x1: L, x2: R, y1: gapBottom, y2: gapBottom, stroke: FRAME.axis });
  anchoredLabel(gapPlot.overlay, "log points relative to France (+10 ≈ 10.5 % higher)", Math.min(L, Math.max(0, R - 300)), 3, "start",
    { color: FRAME.unit, top: true, width: 520 });
  gaps.forEach((gap, index) => {
    const y = 30 + index * 46;
    let up = 0, down = 0;
    anchoredLabel(gapPlot.overlay, gap.economy.name, L - 10, y + 10, "end", { color: gap.economy.colour, size: 12.5 });
    anchoredLabel(gapPlot.overlay, `gap ${signedGrouped(gap.total, 1, " lp")}`, L - 10, y + 27, "end", { color: FRAME.unit, size: 10.5 });
    for (const [factor, value] of gap.parts) {
      const start = value > 0 ? up : down, end = start + value;
      if (value > 0) up = end; else down = end;
      rect(gapPlot.svg, Math.min(gx(start), gx(end)), y, Math.max(0.5, Math.abs(gx(end) - gx(start))), 20, factor[1]);
    }
  });
  gaps.forEach((gap, index) => rect(gapPlot.svg, gx(gap.total) - 1.5, 30 + index * 46 - 4, 3, 28, TOTAL));
  across.append(gapPlot.box);
  across.append(legendRow(FACTORS.map((factor) => ({ color: factor[1], label: factor[0], shape: "box" }))
    .concat([{ color: UNSPLIT, label: "Employment per inhabitant (aggregates, not split)", shape: "box" }, { color: TOTAL, label: "Total gap", shape: "tick" }])));
  for (const item of missing) across.append(warning(item.name, item.text));
  across.append(dataTable(`The four factors of GDP per inhabitant by economy, ${year}`,
    ["Economy", "GDP per inhabitant, current PPP", "Output per hour, current PPP", "Hours per worker", "Employment rate, 15–64", "Working-age share"], table,
    { summary: "Data table — the four factors, selected year", numeric: true }));
  root.append(across);

  for (const note of notes) root.append(warning(note.label, note.text));
  if (provenance) root.append(provenanceLine(provenance));
  return root;
}

export { PER_CAPITA_DRIVERS_VISUAL_CONTRACT } from "./per-capita-drivers.contract.js";
