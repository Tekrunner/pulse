/**
 * Population of the selected countries, with each country's own rate of
 * change below it on the same x-axis. Country identity is colour plus a direct
 * label at the line's end; dash is reserved for the estimate/projection
 * distinction and is never spent on telling countries apart.
 */
import {
  chart, circle, dataTable, enablePicking, line, niceSpan, overlayLabel, people,
  periodYear, polyline, provenanceLine, signedPercent, valueStrip,
} from "./report-shared.js";
import { validateCountryPopulationPathsRows } from "./country-population-paths.contract.js";

const TOP = 12, HEIGHT = 236, GROWTH_TOP = 274, GROWTH_HEIGHT = 62;
const PAD_LEFT = 52, PAD_RIGHT = 10, SVG_HEIGHT = 372;

export function renderCountryPopulationPaths(rows, display = {}, provenance = "") {
  const observations = validateCountryPopulationPathsRows(rows);
  const { width = 1188, selectedIndex, seriesColours = {}, bandRows = [], scenarioMode = "interval95" } = display;

  const periods = [...new Set(observations.map((row) => row.period))].sort();
  const index = Math.max(0, Math.min(periods.length - 1, Number(selectedIndex ?? periods.length - 1) || 0));
  const selectedPeriod = periods[index];
  const series = new Map();
  for (const row of observations) {
    if (!series.has(row.location_id)) series.set(row.location_id, { name: row.location_name, rows: [] });
    series.get(row.location_id).rows.push(row);
  }

  const showBand = scenarioMode === "interval95" || scenarioMode === "bounds";
  const bands = new Map();
  if (showBand) {
    for (const row of bandRows) {
      if (row.scenario !== "Lower 95 PI" && row.scenario !== "Upper 95 PI") continue;
      if (!bands.has(row.location_id)) bands.set(row.location_id, { lower: new Map(), upper: new Map() });
      const edge = row.scenario === "Lower 95 PI" ? "lower" : "upper";
      bands.get(row.location_id)[edge].set(row.period, row.population_thousands);
    }
  }

  const fragment = document.createDocumentFragment();
  fragment.append(valueStrip(periodYear(selectedPeriod), [...series].map(([id, entry]) => {
    const row = entry.rows.find((item) => item.period === selectedPeriod);
    return {
      color: seriesColours[id] ?? "#b2b6ca",
      label: entry.name,
      value: people(row?.population_thousands),
      extra: row ? `${signedPercent(row.population_growth_rate_pct)} a year` : undefined,
    };
  })));

  const values = observations.map((row) => row.population_thousands);
  for (const band of bands.values()) {
    for (const value of band.lower.values()) if (value !== null) values.push(value);
    for (const value of band.upper.values()) if (value !== null) values.push(value);
  }
  const domain = niceSpan(Math.min(...values), Math.max(...values));
  const growthValues = observations.map((row) => row.population_growth_rate_pct);
  const growthDomain = niceSpan(Math.min(...growthValues, 0), Math.max(...growthValues, 0));

  const inner = Math.max(240, width - PAD_LEFT - PAD_RIGHT);
  const xOf = (position) => PAD_LEFT + (periods.length === 1 ? inner / 2 : (position * inner) / (periods.length - 1));
  const yOf = (value, dom, top, height) => top + height - ((value - dom.lo) / (dom.hi - dom.lo)) * height;
  const positionOf = new Map(periods.map((period, position) => [period, position]));

  const names = [...series.values()].map((entry) => entry.name).join(", ");
  const { root, svg, overlay } = chart(width, SVG_HEIGHT, `Population of ${names} from ${periodYear(periods[0])} to ${periodYear(periods.at(-1))}, with each country's rate of change`);

  for (let value = domain.lo; value <= domain.hi + 1e-9; value += domain.step) {
    const y = yOf(value, domain, TOP, HEIGHT);
    line(svg, { x1: PAD_LEFT, x2: width - PAD_RIGHT, y1: y, y2: y, stroke: "rgba(233,233,237,.10)", "stroke-width": 1 });
    overlayLabel(overlay, people(value), 0, y - 8, { width: PAD_LEFT - 6, align: "right" });
  }

  for (const [id, band] of bands) {
    const top = [], bottom = [];
    for (const period of periods) {
      if (!band.lower.has(period)) continue;
      const x = xOf(positionOf.get(period));
      top.push(`${x},${yOf(band.upper.get(period), domain, TOP, HEIGHT)}`);
      bottom.unshift(`${x},${yOf(band.lower.get(period), domain, TOP, HEIGHT)}`);
    }
    if (top.length) polyline(svg, top.concat(bottom).join(" "), seriesColours[id] ?? "#b2b6ca", 0, "", seriesColours[id] ?? "#b2b6ca", 0.14);
  }

  let boundaryPosition = -1;
  for (const [id, entry] of series) {
    const colour = seriesColours[id] ?? "#b2b6ca";
    const estimate = [], projection = [], growthEstimate = [], growthProjection = [];
    entry.rows.forEach((row) => {
      const position = positionOf.get(row.period);
      if (position === undefined) return;
      const point = `${xOf(position)},${yOf(row.population_thousands, domain, TOP, HEIGHT)}`;
      const growthPoint = `${xOf(position)},${yOf(row.population_growth_rate_pct, growthDomain, GROWTH_TOP, GROWTH_HEIGHT)}`;
      if (row.series_kind === "estimate") { estimate.push(point); growthEstimate.push(growthPoint); }
      else {
        if (boundaryPosition < 0) boundaryPosition = position;
        if (!projection.length && estimate.length) { projection.push(estimate.at(-1)); growthProjection.push(growthEstimate.at(-1)); }
        projection.push(point); growthProjection.push(growthPoint);
      }
    });
    if (estimate.length) polyline(svg, estimate.join(" "), colour, 2.5);
    if (projection.length) polyline(svg, projection.join(" "), colour, 2.5, "7 5");
    if (growthEstimate.length) polyline(svg, growthEstimate.join(" "), colour, 1.8);
    if (growthProjection.length) polyline(svg, growthProjection.join(" "), colour, 1.8, "7 5");
    const last = entry.rows.at(-1);
    if (last) {
      overlayLabel(overlay, entry.name, xOf(positionOf.get(last.period)) - 126, yOf(last.population_thousands, domain, TOP, HEIGHT) - 19,
        { width: 120, align: "right", color: colour });
    }
    const selectedRow = entry.rows.find((row) => row.period === selectedPeriod);
    if (selectedRow) circle(svg, xOf(index), yOf(selectedRow.population_thousands, domain, TOP, HEIGHT), 3.5, colour);
  }

  if (boundaryPosition > 0) {
    const x = xOf(boundaryPosition - 1);
    line(svg, { x1: x, x2: x, y1: 8, y2: TOP + HEIGHT + 10, stroke: "#75798c", "stroke-width": 1 });
    overlayLabel(overlay, "estimates", x - 76, 10, { width: 70, align: "right" });
    overlayLabel(overlay, "projection", x + 6, 10, { width: 70, align: "left" });
  }

  const zeroY = yOf(0, growthDomain, GROWTH_TOP, GROWTH_HEIGHT);
  line(svg, { x1: PAD_LEFT, x2: width - PAD_RIGHT, y1: zeroY, y2: zeroY, stroke: "#75798c", "stroke-width": 1 });
  overlayLabel(overlay, signedPercent(growthDomain.hi, 1), 0, yOf(growthDomain.hi, growthDomain, GROWTH_TOP, GROWTH_HEIGHT) - 8, { width: PAD_LEFT - 6, align: "right" });
  overlayLabel(overlay, signedPercent(growthDomain.lo, 1), 0, yOf(growthDomain.lo, growthDomain, GROWTH_TOP, GROWTH_HEIGHT) - 8, { width: PAD_LEFT - 6, align: "right" });
  overlayLabel(overlay, "Rate of change, % a year", 58, GROWTH_TOP - 18, { width: 190, align: "left" });

  const selectionX = xOf(index);
  line(svg, { x1: selectionX, x2: selectionX, y1: 8, y2: 350, stroke: "#e9e9ed", "stroke-width": 1, "stroke-dasharray": "3 3" });

  const ticks = Math.max(2, Math.min(7, Math.floor(inner / 170)));
  for (let step = 0; step < ticks; step += 1) {
    const position = Math.round((step * (periods.length - 1)) / (ticks - 1));
    overlayLabel(overlay, periodYear(periods[position]), Math.max(0, Math.min(width - 56, xOf(position) - 28)), 354, { width: 56 });
  }

  enablePicking(svg, periods.length, PAD_LEFT, inner);
  fragment.append(root);
  if (provenance) fragment.append(provenanceLine(provenance));
  fragment.append(dataTable(
    "Population and rate of change by country and year",
    ["Year", "Country", "Kind", "Population", "Rate of change"],
    observations.map((row) => [
      periodYear(row.period), row.location_name, row.series_kind,
      people(row.population_thousands), `${signedPercent(row.population_growth_rate_pct)} a year`,
    ]),
  ));
  return fragment;
}
