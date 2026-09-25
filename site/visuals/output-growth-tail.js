/**
 * GDP in volume and its real growth, annual from the first year and then
 * quarter by quarter for the most recent years, on one time axis.
 *
 * Quarterly levels are annualised and quarterly growth is on the same quarter
 * a year earlier, so both sit on the annual scale; the quarters replace the
 * annual points for every year they cover. Per inhabitant the figure is
 * annual only. The level axis is linear by default; on a log scale a wide
 * range takes doubling ticks, which are evenly spaced, and a narrow one takes
 * round steps.
 */
import {
  FRAME, anchoredLabel, circle, dataTable, drawFrame, grouped, line, linearTicks, niceLinear,
  node, plotBox, plotCaption, polyline, provenanceLine, rect, signedGrouped, valueStrip,
  warning, yearHits, yearScale, yearTicks,
} from "./report-shared.js";
import { validateOutputGrowthTailRows } from "./output-growth-tail.contract.js";

const ACCENT = "#73d6c2", QUARTER = "#5fb3a3", FALL = "#e59a7a", QUARTER_FALL = "#c98a70", SEAM = "rgba(115,214,194,.07)";
const LEVEL = Object.freeze({ height: 270, top: 24, bottom: 240 });
const GROWTH = Object.freeze({ height: 190, top: 24, bottom: 160 });
const X0 = 64, PAD_RIGHT = 12;

const yearOf = (period) => Number(period.slice(0, 4));
const quarterOf = (period) => Math.floor((Number(period.slice(5, 7)) - 1) / 3) + 1;

/** Log-axis ticks: doublings of a round base on wide ranges, round steps on narrow ones. */
export function logTicks(lo, hi, base) {
  const ticks = [];
  if (hi / lo >= 4) {
    for (let k = -4; k < 12; k += 1) {
      const value = base * 2 ** k;
      if (value >= lo && value <= hi) ticks.push(value);
    }
    return ticks;
  }
  const raw = (hi - lo) / 5, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= raw);
  for (let value = Math.ceil(lo / step) * step; value <= hi + 1e-9; value += step) ticks.push(value);
  return ticks;
}

export function renderOutputGrowthTail(rows, display = {}, provenance = "") {
  const observations = validateOutputGrowthTailRows(rows);
  const { width = 1188, mode = "total", scale = "linear", selectedYear, seamStart, notes = [] } = display;
  const capita = mode === "capita", log = scale === "log";
  const annual = observations.filter((row) => row.kind === "annual");
  const quarters = observations.filter((row) => row.kind === "quarter");
  const seamYear = seamStart ? yearOf(seamStart) : Infinity;
  const years = observations.map((row) => yearOf(row.period));
  const from = Math.max(display.from ?? Math.min(...years), Math.min(...years));
  const to = Math.min(display.to ?? Math.max(...years), Math.max(...years));
  const year = Math.max(from, Math.min(to, selectedYear ?? to));
  const X1 = width - PAD_RIGHT;
  const xs = yearScale(from, to, X0, X1);
  const inWindow = (row) => yearOf(row.period) >= from && yearOf(row.period) <= to;

  // The level series: annual before the seam, then quarters; annual only per inhabitant.
  const annualPoints = annual.filter((row) => inWindow(row) && (capita || yearOf(row.period) < seamYear))
    .map((row) => [yearOf(row.period) + 0.5, capita ? row.gdp_per_capita_chained_eur : row.gdp_volume_eur_bn]);
  const quarterPoints = capita ? [] : quarters.filter(inWindow)
    .map((row) => [yearOf(row.period) + (quarterOf(row.period) - 0.5) / 4, row.gdp_volume_eur_bn]);
  const values = annualPoints.concat(quarterPoints).map((point) => point[1]);
  const vmin = Math.min(...values), vmax = Math.max(...values);
  const { top, bottom } = LEVEL;
  let ly, levelTicks;
  if (log) {
    const base = capita ? 1000 : 100;
    let lo = vmin / 1.08;
    const hi = vmax * 1.05;
    // Over a wide range the axis starts on the doubling tick below the data.
    if (hi / lo >= 4) lo = base * 2 ** Math.floor(Math.log2(vmin / base));
    ly = (value) => bottom - ((Math.log(value) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (bottom - top);
    levelTicks = logTicks(lo, hi, base).map((value) => ({ y: ly(value), t: grouped(value, 0), zero: false }));
  } else {
    const domain = niceLinear(Math.max(0, vmin - (vmax - vmin) * 0.1), vmax * 1.02, false);
    ly = (value) => bottom - ((value - domain.lo) / (domain.hi - domain.lo)) * (bottom - top);
    levelTicks = linearTicks(domain, ly, (value) => grouped(value, 0)).map((tick) => ({ ...tick, zero: false }));
  }
  const toPoints = (list, y) => list.map(([x, value]) => `${xs.x(x).toFixed(1)},${y(value).toFixed(1)}`).join(" ");

  // Growth: annual volume growth, per inhabitant computed from the level,
  // then each quarter on the same quarter a year earlier.
  const annualByYear = new Map(annual.map((row) => [yearOf(row.period), row]));
  const capitaGrowth = (row) => {
    const previous = annualByYear.get(yearOf(row.period) - 1);
    return previous ? 100 * (row.gdp_per_capita_chained_eur / previous.gdp_per_capita_chained_eur - 1) : null;
  };
  const annualGrowth = annual.filter((row) => inWindow(row) && (capita || yearOf(row.period) < seamYear))
    .map((row) => ({ year: yearOf(row.period), value: capita ? capitaGrowth(row) : row.growth_pct }))
    .filter((item) => item.value !== null);
  const quarterGrowth = capita ? [] : quarters.filter((row) => inWindow(row) && row.growth_pct !== null)
    .map((row) => ({ year: yearOf(row.period), quarter: quarterOf(row.period), value: row.growth_pct }));
  const growthDomain = niceLinear(Math.min(0, ...annualGrowth.map((item) => item.value), ...quarterGrowth.map((item) => item.value)),
    Math.max(0, ...annualGrowth.map((item) => item.value), ...quarterGrowth.map((item) => item.value)), true);
  const gy = (value) => GROWTH.bottom - ((value - growthDomain.lo) / (growthDomain.hi - growthDomain.lo)) * (GROWTH.bottom - GROWTH.top);

  const selected = annualByYear.get(year) ?? null;
  const selectedQuarters = quarters.filter((row) => yearOf(row.period) === year);
  const inTail = !capita && seamYear <= to;
  const seamX = xs.x(Math.max(seamYear, from));
  const lastAnnual = annual.length ? yearOf(annual.at(-1).period) : null;
  const ticks = yearTicks(xs);

  const figure = node("figure");

  // Level.
  figure.append(plotCaption(capita ? "GDP per inhabitant at constant 2020 prices — annual only" : "GDP at constant 2020 prices — annual, then annualised quarters"));
  const strip = [];
  if (capita) {
    strip.push({ color: ACCENT, label: "GDP per inhabitant, constant 2020 prices", value: selected ? `${grouped(selected.gdp_per_capita_chained_eur, 0)} €` : "not published" });
  } else {
    strip.push({ color: ACCENT, label: "GDP at constant 2020 prices", value: selected ? `${grouped(selected.gdp_volume_eur_bn, 0)} bn €` : `annual accounts end in ${lastAnnual}` });
    strip.push({ color: ACCENT, label: "Real GDP growth", value: selected ? signedGrouped(selected.growth_pct, 1, " %") : "—" });
    if (year >= seamYear && selectedQuarters.length) {
      strip.push({ color: QUARTER, label: "Quarters on a year earlier",
        // Each quarter stays on one line; a narrow strip breaks between them.
        value: selectedQuarters.map((row) => `Q${quarterOf(row.period)} ${signedGrouped(row.growth_pct, 1, " %")}`).join("  ·  ") });
    }
  }
  figure.append(valueStrip(String(year), strip));

  const level = plotBox(width, LEVEL.height, `${capita ? "Real GDP per inhabitant" : "Real GDP"} from ${from} to ${to}, ${log ? "log" : "linear"} scale; selected year ${year}`);
  if (inTail) rect(level.svg, seamX, top, X1 - seamX, bottom - top, SEAM);
  drawFrame(level.svg, level.overlay, {
    x0: X0, x1: X1, top, bottom, yTicks: levelTicks, xTicks: ticks,
    unit: `${capita ? "€ per inhabitant, constant 2020 prices (chained)" : "bn €, constant 2020 prices (chained)"}${log ? ", log scale" : ""}`,
  });
  if (inTail) anchoredLabel(level.overlay, "Quarters from here: annualised, working-day adjusted →", seamX - 8, bottom - 20, "end", { top: true, color: "#9fd9cc", width: 360 });
  polyline(level.svg, toPoints(annualPoints, ly), ACCENT, 2.5);
  if (quarterPoints.length) polyline(level.svg, toPoints(quarterPoints, ly), ACCENT, 1.8);
  const selectedX = xs.x(year + 0.5);
  line(level.svg, { x1: selectedX, x2: selectedX, y1: top, y2: bottom, stroke: FRAME.mark, "stroke-dasharray": "3 3" });
  const selectedLevel = capita
    ? selected?.gdp_per_capita_chained_eur
    : year >= seamYear && selectedQuarters.length ? selectedQuarters.at(-1).gdp_volume_eur_bn : selected?.gdp_volume_eur_bn;
  if (Number.isFinite(selectedLevel)) circle(level.svg, selectedX, ly(selectedLevel), 4.5, FRAME.ground, FRAME.mark, 2);
  yearHits(level.svg, xs, top, bottom);
  figure.append(level.box);

  // Growth.
  figure.append(plotCaption(capita ? "Real growth of GDP per inhabitant" : "Real GDP growth — annual, then each quarter on the same quarter a year earlier"));
  const growth = plotBox(width, GROWTH.height, `${capita ? "Real growth of GDP per inhabitant" : "Real GDP growth"} from ${from} to ${to}`);
  if (inTail) rect(growth.svg, seamX, GROWTH.top, X1 - seamX, GROWTH.bottom - GROWTH.top, SEAM);
  drawFrame(growth.svg, growth.overlay, {
    x0: X0, x1: X1, top: GROWTH.top, bottom: GROWTH.bottom,
    yTicks: linearTicks(growthDomain, gy, (value) => signedGrouped(value, 0, "")), xTicks: ticks, unit: "%",
  });
  for (const item of annualGrowth) {
    const y0 = gy(0), y1 = gy(item.value);
    rect(growth.svg, xs.x(item.year) + xs.step * 0.15, Math.min(y0, y1), Math.max(1, xs.step * 0.7), Math.max(0.6, Math.abs(y1 - y0)),
      item.year === year ? FRAME.mark : item.value < 0 ? FALL : ACCENT);
  }
  for (const item of quarterGrowth) {
    const y0 = gy(0), y1 = gy(item.value);
    rect(growth.svg, xs.x(item.year + (item.quarter - 1) / 4) + xs.step * 0.03, Math.min(y0, y1), Math.max(1, (xs.step / 4) * 0.8), Math.max(0.6, Math.abs(y1 - y0)),
      item.year === year ? FRAME.mark : item.value < 0 ? QUARTER_FALL : QUARTER);
  }
  line(growth.svg, { x1: selectedX, x2: selectedX, y1: GROWTH.top, y2: GROWTH.bottom, stroke: FRAME.mark, "stroke-dasharray": "3 3" });
  yearHits(growth.svg, xs, GROWTH.top, GROWTH.bottom);
  figure.append(growth.box);

  for (const note of notes) figure.append(warning(note.label, note.text));
  if (provenance) figure.append(provenanceLine(provenance));

  const table = [];
  for (const row of annual.filter(inWindow)) {
    table.push([String(yearOf(row.period)), grouped(row.gdp_volume_eur_bn, 0), signedGrouped(row.growth_pct, 1, " %"), ""]);
  }
  if (!capita) {
    for (const row of quarters.filter(inWindow)) {
      table.push([`${yearOf(row.period)}-Q${quarterOf(row.period)}`, grouped(row.gdp_volume_eur_bn, 0),
        signedGrouped(row.growth_pct, 1, " % y/y"), signedGrouped(row.quarter_on_quarter_pct, 1, " %")]);
    }
  }
  figure.append(dataTable("Real GDP, annual accounts and quarters in the represented period",
    ["Period", "GDP, constant 2020 prices, bn € (annualised)", "Real GDP growth", "Quarter on quarter"], table,
    { summary: "Data table — annual accounts and quarters in the window", numeric: true }));
  return figure;
}

export { OUTPUT_GROWTH_TAIL_VISUAL_CONTRACT } from "./output-growth-tail.contract.js";
