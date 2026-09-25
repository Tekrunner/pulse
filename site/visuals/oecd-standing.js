/**
 * France among OECD economies: GDP per inhabitant at current PPP ranked for
 * the selected year, at constant 2020 PPP over time, and annual real growth.
 *
 * France is drawn first, then the comparators in the order given, then the
 * aggregate, dashed. The aggregate is a reference bar beneath the ranking,
 * never ranked itself. Growth is clipped at the axis limits, which never
 * extend beyond −12 and +14 %, so one outlier year does not flatten the rest.
 */
import {
  FRAME, anchoredLabel, dataTable, drawFrame, grouped, line, linearTicks, niceLinear,
  node, plotBox, plotCaption, polyline, provenanceLine, rect, signedGrouped, valueStrip,
  warning, yearHits, yearScale, yearTicks,
} from "./report-shared.js";
import { validateOecdStandingRows } from "./oecd-standing.contract.js";

const BARS = Object.freeze({ width: 420, labelX: 124, x0: 130, right: 10, span: 230 });
const LINES = Object.freeze({ height: 270, top: 24, bottom: 240, x0: 52, padRight: 44, first: 1970 });
const GROWTH = Object.freeze({ height: 240, top: 24, bottom: 210, x0: 64, padRight: 12, first: 1971, floor: -12, ceiling: 14 });
const GAP = 24, STACK_BELOW = 900;

const yearOf = (period) => Number(period.slice(0, 4));
const kUsd = (value) => (value === null || value === undefined ? "—" : `${grouped(value / 1000, 1)} k$`);

/** A value strip whose one entry carries no swatch. */
function plainStrip(title, label, value) {
  const strip = node("div");
  strip.className = "values";
  const heading = node("span", title);
  heading.className = "yr";
  const item = node("span");
  item.className = "v";
  item.append(document.createTextNode(label), node("b", value));
  strip.append(heading, item);
  return strip;
}

/** The artboard's lines carry no round caps: dashes keep their drawn length. */
function seriesLine(svg, points, series) {
  const item = polyline(svg, points, series.colour, series.width, series.dash);
  item.removeAttribute("stroke-linecap");
  return item;
}

export function renderOecdStanding(rows, display = {}, provenance = "") {
  const observations = validateOecdStandingRows(rows);
  const { width = 1188, selectedYear, notes = [], france = { code: "FRA", colour: "#73d6c2" }, comparators = [], aggregate = null } = display;

  // Every row, by area then year; the visual reads only the series it is given.
  const areas = new Map();
  for (const row of observations) {
    if (!areas.has(row.reference_area_code)) areas.set(row.reference_area_code, { name: row.reference_area_name, years: new Map() });
    areas.get(row.reference_area_code).years.set(yearOf(row.period), row);
  }
  const years = observations.map((row) => yearOf(row.period));
  const firstYear = years.length ? Math.min(...years) : display.from, lastYear = years.length ? Math.max(...years) : display.to;
  const from = display.from ?? firstYear, to = display.to ?? lastYear;
  const year = selectedYear ?? Math.min(to, lastYear);
  const span = (first) => {
    const start = Math.max(from, first), end = Math.min(to, lastYear);
    return { from: Math.min(start, end), to: end };
  };

  const series = [
    { code: france.code, colour: france.colour, width: 2.8, dash: "" },
    ...comparators.map((item) => ({ code: item.code, colour: item.colour, width: 1.8, dash: "" })),
    ...(aggregate ? [{ code: aggregate.code, colour: aggregate.colour, width: 1.6, dash: "5 4", aggregate: true }] : []),
  ].map((item) => {
    const area = areas.get(item.code) ?? null;
    return { ...item, area, name: item.aggregate ? aggregate.name : area ? area.name : item.code, label: item.aggregate ? "OECD" : item.code };
  });
  const value = (item, y, field) => item.area?.years.get(y)?.[field] ?? null;
  const joinNames = (list) => list.length < 2 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
  const economies = series.filter((item) => !item.aggregate);
  const reference = series.find((item) => item.aggregate) ?? null;
  const drawnNames = joinNames(series.map((item) => item.aggregate ? `the ${item.name} (dashed)` : item.name));

  // ---------- ranked bars at current PPP ----------
  const barWidth = Math.min(BARS.width, width);
  const barSpan = BARS.span - (BARS.width - barWidth), barRight = barWidth - BARS.right;
  const levels = economies.map((item) => ({ item, v: value(item, year, "gdp_per_capita_ppp_current_usd") }));
  const referenceLevel = reference ? value(reference, year, "gdp_per_capita_ppp_current_usd") : null;
  const maxLevel = Math.max(...levels.map((level) => level.v || 0), referenceLevel || 0, 1000);
  const barDomain = niceLinear(0, maxLevel / 1000, true);
  const bx = (v) => BARS.x0 + (v / 1000) / barDomain.hi * barSpan;
  const bars = levels.filter((level) => level.v !== null).sort((a, b) => b.v - a.v).map((level, index) => ({
    name: level.item.name, v: kUsd(level.v), y: 8 + index * 28, w: Math.max(1, bx(level.v) - BARS.x0), vx: bx(level.v) + 6,
    fill: level.item.colour, stroke: "none", dash: "", textColor: level.item.code === france.code ? france.colour : FRAME.mark,
  }));
  if (referenceLevel !== null) {
    const index = bars.length;
    bars.push({ name: reference.name, v: kUsd(referenceLevel), y: 14 + index * 28, w: bx(referenceLevel) - BARS.x0, vx: bx(referenceLevel) + 6,
      fill: "transparent", stroke: reference.colour, dash: "4 3", textColor: reference.colour });
  }
  const barBottom = 16 + bars.length * 28 + (referenceLevel !== null ? 6 : 0);
  const barTicks = [];
  for (let t = 0; t <= barDomain.hi + 1e-9; t += barDomain.step) barTicks.push({ x: BARS.x0 + t / barDomain.hi * barSpan, t: grouped(t, 0) });
  const missing = levels.filter((level) => level.v === null).map((level) => {
    const published = level.item.area ? [...level.item.area.years.entries()].filter(([, row]) => row.gdp_per_capita_ppp_current_usd !== null).map(([y]) => y) : [];
    return { name: level.item.name, text: published.length ? `published ${Math.min(...published)}–${Math.max(...published)}; nothing for ${year}.` : "not published." };
  });
  const franceLevel = value(series[0], year, "gdp_per_capita_ppp_current_usd");

  const ranked = bars.filter((bar) => bar.stroke === "none").map((bar) => `${bar.name} ${bar.v}`);
  const barAria = `GDP per inhabitant at current PPP in ${year}, ranked: ${ranked.length ? ranked.join(", ") : "no economy published"}`
    + `${referenceLevel !== null ? `; ${reference.name} ${kUsd(referenceLevel)} as a dashed reference bar` : ""}`;

  const barFigure = node("figure");
  barFigure.append(plotCaption(`GDP per inhabitant in ${year}, current PPP`));
  barFigure.append(plainStrip(String(year), "France", franceLevel === null ? "not published" : kUsd(franceLevel)));
  const barPlot = plotBox(barWidth, barBottom + 40, barAria);
  for (const tick of barTicks) {
    line(barPlot.svg, { x1: tick.x, x2: tick.x, y1: 4, y2: barBottom, stroke: FRAME.grid });
    line(barPlot.svg, { x1: tick.x, x2: tick.x, y1: barBottom, y2: barBottom + 5, stroke: FRAME.axis });
  }
  line(barPlot.svg, { x1: BARS.x0, x2: BARS.x0, y1: 4, y2: barBottom, stroke: FRAME.axis });
  line(barPlot.svg, { x1: BARS.x0, x2: barRight, y1: barBottom, y2: barBottom, stroke: FRAME.axis });
  for (const bar of bars) {
    const mark = rect(barPlot.svg, BARS.x0, bar.y, bar.w, 18, bar.fill);
    mark.setAttribute("stroke", bar.stroke);
    if (bar.dash) mark.setAttribute("stroke-dasharray", bar.dash);
    mark.setAttribute("rx", "2");
  }
  for (const bar of bars) {
    anchoredLabel(barPlot.overlay, bar.name, BARS.labelX, bar.y + 9, "end", { color: bar.textColor, size: 12 });
    anchoredLabel(barPlot.overlay, bar.v, bar.vx, bar.y + 9, "start", { color: FRAME.mark, size: 11.5 });
  }
  for (const tick of barTicks) anchoredLabel(barPlot.overlay, tick.t, tick.x, barBottom + 8, "middle", { top: true, size: 10.5 });
  anchoredLabel(barPlot.overlay, "k$ per inhabitant, current PPP", barRight, barBottom + 26, "end", { top: true, color: FRAME.unit, size: 10.5 });
  barFigure.append(barPlot.box);
  for (const item of missing) barFigure.append(warning(item.name, item.text));

  // ---------- lines at constant 2020 PPP ----------
  const stacked = width < STACK_BELOW;
  const lineWidth = stacked ? width : width - BARS.width - GAP;
  const lw = span(LINES.first), X1 = lineWidth - LINES.padRight;
  const xs = yearScale(lw.from, lw.to, LINES.x0, X1);
  const constants = [];
  for (const item of series) {
    for (let y = lw.from; y <= lw.to; y += 1) {
      const v = value(item, y, "gdp_per_capita_ppp_constant_2020_usd");
      if (v !== null) constants.push(v / 1000);
    }
  }
  const lineDomain = constants.length ? niceLinear(Math.min(...constants) * 0.95, Math.max(...constants), false) : niceLinear(0, 1, false);
  const ly = (v) => LINES.bottom - (v - lineDomain.lo) / (lineDomain.hi - lineDomain.lo) * (LINES.bottom - LINES.top);

  const lineFigure = node("figure");
  lineFigure.append(plotCaption("GDP per inhabitant, constant 2020 PPP"));
  lineFigure.append(valueStrip(String(year), series.map((item) => ({
    color: item.colour, label: item.name, value: kUsd(value(item, year, "gdp_per_capita_ppp_constant_2020_usd")),
  }))));
  const linePlot = plotBox(lineWidth, LINES.height,
    `GDP per inhabitant at constant 2020 PPP from ${lw.from} to ${lw.to} for ${drawnNames}; selected year ${year}`);
  drawFrame(linePlot.svg, linePlot.overlay, {
    x0: LINES.x0, x1: X1, top: LINES.top, bottom: LINES.bottom,
    yTicks: linearTicks(lineDomain, ly, (v) => grouped(v, 0)), xTicks: yearTicks(xs, 9),
    unit: "k$ per inhabitant, constant 2020 PPP",
  });
  const ends = [];
  for (const item of series) {
    const points = [];
    let last = null;
    for (let y = lw.from; y <= lw.to; y += 1) {
      const v = value(item, y, "gdp_per_capita_ppp_constant_2020_usd");
      if (v === null) continue;
      last = [xs.x(y + 0.5), ly(v / 1000)];
      points.push(`${last[0].toFixed(1)},${last[1].toFixed(1)}`);
    }
    seriesLine(linePlot.svg, points.join(" "), item);
    if (last) ends.push({ x: last[0] + 5, y: last[1], colour: item.colour, t: item.label });
  }
  // End labels in vertical order, each at least 13 px below the one above.
  ends.sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k += 1) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 13);
  for (const end of ends) anchoredLabel(linePlot.overlay, end.t, end.x, end.y, "start", { color: end.colour });
  const lineSelX = xs.x(Math.min(Math.max(year, lw.from), lw.to) + 0.5);
  line(linePlot.svg, { x1: lineSelX, x2: lineSelX, y1: LINES.top, y2: LINES.bottom, stroke: FRAME.mark, "stroke-dasharray": "3 3" });
  yearHits(linePlot.svg, xs, LINES.top, LINES.bottom);
  lineFigure.append(linePlot.box);

  const levelsBlock = node("div");
  levelsBlock.style.display = "grid";
  levelsBlock.style.gridTemplateColumns = stacked ? "minmax(0, 1fr)" : `${BARS.width}px minmax(0, 1fr)`;
  levelsBlock.style.gap = `${GAP}px`;
  levelsBlock.style.alignItems = "start";
  levelsBlock.append(barFigure, lineFigure);

  // ---------- growth ----------
  const gw = span(GROWTH.first), GX1 = width - GROWTH.padRight;
  const gx = yearScale(gw.from, gw.to, GROWTH.x0, GX1);
  const growthValues = [0];
  for (const item of series) {
    for (let y = gw.from; y <= gw.to; y += 1) {
      const v = value(item, y, "gdp_volume_growth_pct");
      if (v !== null) growthValues.push(v);
    }
  }
  const growthDomain = niceLinear(Math.max(GROWTH.floor, Math.min(...growthValues)), Math.min(GROWTH.ceiling, Math.max(...growthValues)), true);
  const gy = (v) => GROWTH.bottom - (Math.max(growthDomain.lo, Math.min(growthDomain.hi, v)) - growthDomain.lo) / (growthDomain.hi - growthDomain.lo) * (GROWTH.bottom - GROWTH.top);

  const growthCaption = plotCaption("Annual real GDP growth");
  const growthStrip = valueStrip(String(year), series.map((item) => {
    const v = value(item, year, "gdp_volume_growth_pct");
    return { color: item.colour, label: item.name, value: v === null ? "—" : signedGrouped(v, 1, " %") };
  }));
  const growthPlot = plotBox(width, GROWTH.height,
    `Annual real GDP growth from ${gw.from} to ${gw.to} for ${drawnNames}, on an axis from ${signedGrouped(growthDomain.lo, 0, "")} to ${signedGrouped(growthDomain.hi, 0, " %")} with values beyond it clipped; selected year ${year}`);
  drawFrame(growthPlot.svg, growthPlot.overlay, {
    x0: GROWTH.x0, x1: GX1, top: GROWTH.top, bottom: GROWTH.bottom,
    yTicks: linearTicks(growthDomain, gy, (v) => signedGrouped(v, 0, "")), xTicks: yearTicks(gx),
    unit: "% (clipped at the axis limits)",
  });
  for (const item of series) {
    const points = [];
    for (let y = gw.from; y <= gw.to; y += 1) {
      const v = value(item, y, "gdp_volume_growth_pct");
      if (v !== null) points.push(`${gx.x(y + 0.5).toFixed(1)},${gy(v).toFixed(1)}`);
    }
    seriesLine(growthPlot.svg, points.join(" "), item);
  }
  const growthSelX = gx.x(Math.min(Math.max(year, gw.from), gw.to) + 0.5);
  line(growthPlot.svg, { x1: growthSelX, x2: growthSelX, y1: GROWTH.top, y2: GROWTH.bottom, stroke: FRAME.mark, "stroke-dasharray": "3 3" });
  yearHits(growthPlot.svg, gx, GROWTH.top, GROWTH.bottom);

  const root = node("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "12px";
  root.style.minWidth = "0";
  root.append(levelsBlock, growthCaption, growthStrip, growthPlot.box);
  for (const note of notes) root.append(warning(note.label, note.text));
  if (provenance) root.append(provenanceLine(provenance));

  const table = series.map((item) => {
    const current = value(item, year, "gdp_per_capita_ppp_current_usd");
    const constant = value(item, year, "gdp_per_capita_ppp_constant_2020_usd");
    return [item.name, current === null ? "—" : grouped(current / 1000, 1), constant === null ? "—" : grouped(constant / 1000, 1),
      signedGrouped(value(item, year, "gdp_volume_growth_pct"), 1, " %")];
  });
  root.append(dataTable(`GDP per inhabitant at purchasing power parity and real GDP growth in ${year}`,
    ["Economy", "GDP per inhabitant, current PPP, k$", "GDP per inhabitant, constant 2020 PPP, k$", "Real GDP growth"], table,
    { summary: "Data table — GDP per inhabitant and growth, selected year", numeric: true }));
  return root;
}

export { OECD_STANDING_VISUAL_CONTRACT } from "./oecd-standing.contract.js";
