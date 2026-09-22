/**
 * Fertility, life expectancy, and years lived in full health.
 *
 * Three panels, not three lines on one axis: a rate in births per woman and
 * two quantities in years are different measures, and the two in years come
 * from different providers on different bases. Healthy life expectancy is
 * published for a much shorter period, so its line ends with a dot and a
 * direct label saying where, rather than running on to meet the others.
 */
import {
  axisGutter, chart, circle, dataTable, enablePicking, line, niceSpan, node,
  overlayLabel, panelGrid, periodYear, polyline, provenanceLine, valueStrip,
} from "./report-shared.js";
import { validateFertilityLongevityRows } from "./fertility-longevity.contract.js";

const MAX_PAD_LEFT = 44, PAD_RIGHT = 6, TOP = 14, HEIGHT = 140, SVG_HEIGHT = 186;
const REPLACEMENT = 2.1;

const PANELS = [
  { key: "total_fertility_rate", title: "Total fertility rate", unit: "births per woman", digits: 2, reference: REPLACEMENT },
  { key: "life_expectancy_years", title: "Life expectancy at birth", unit: "years", digits: 1, reference: null },
  { key: "healthy_life_expectancy_years", title: "Healthy life expectancy", unit: "years, WHO", digits: 1, reference: null },
];

function plain(value, digits) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? "not published" : Number(value).toFixed(digits);
}

export function renderFertilityLongevity(rows, display = {}, provenance = "") {
  const observations = validateFertilityLongevityRows(rows);
  const { width = 1188, selectedIndex, seriesColours = {}, columns = 3 } = display;

  const periods = [...new Set(observations.map((row) => row.period))].sort();
  const index = Math.max(0, Math.min(periods.length - 1, Number(selectedIndex ?? periods.length - 1) || 0));
  const selectedPeriod = periods[index];
  const byCountry = new Map();
  for (const row of observations) {
    if (!byCountry.has(row.location_id)) byCountry.set(row.location_id, { name: row.location_name, rows: [] });
    byCountry.get(row.location_id).rows.push(row);
  }

  const grid = node("div");
  grid.className = "multiples";
  const { columns: panelColumns, width: panelWidth } = panelGrid(width, Math.min(columns, PANELS.length));
  grid.style.setProperty("--multiple-columns", String(panelColumns));
  const positionOf = new Map(periods.map((period, position) => [period, position]));

  // Every panel is drawn against the same x positions, so the gutter is the
  // figure's rather than each panel's: three gutters would start three plots
  // in three different places under headings that line up.
  const domains = new Map(PANELS.map((definition) => {
    const values = observations
      .map((row) => row[definition.key])
      .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
    if (definition.reference !== null) values.push(definition.reference);
    return [definition.key, niceSpan(Math.min(...values), Math.max(...values))];
  }));
  const padLeft = axisGutter([...domains.values()].flatMap((domain) => {
    const digits = domain.step < 1 ? 1 : 0;
    return [domain.lo.toFixed(digits), domain.hi.toFixed(digits)];
  }), { max: MAX_PAD_LEFT });
  const inner = Math.max(120, panelWidth - padLeft - PAD_RIGHT);
  const xOf = (position) => padLeft + (periods.length === 1 ? inner / 2 : (position * inner) / (periods.length - 1));

  for (const panelDefinition of PANELS) {
    const panel = node("div");
    panel.className = "multiple-panel";
    const header = node("div");
    header.className = "multiple-header";
    const title = node("span", panelDefinition.title);
    title.className = "multiple-title";
    header.append(title, node("span", panelDefinition.unit));
    panel.append(header);

    panel.append(valueStrip(periodYear(selectedPeriod), [...byCountry].map(([id, entry]) => {
      const row = entry.rows.find((item) => item.period === selectedPeriod);
      return {
        color: seriesColours[id] ?? "#b2b6ca",
        label: entry.name,
        value: plain(row?.[panelDefinition.key] ?? null, panelDefinition.digits),
      };
    })));

    const domain = domains.get(panelDefinition.key);
    const yOf = (value) => TOP + HEIGHT - ((value - domain.lo) / (domain.hi - domain.lo)) * HEIGHT;

    const { root, svg, overlay } = chart(panelWidth, SVG_HEIGHT,
      `${panelDefinition.title} for the selected countries, ${periodYear(periods[0])} to ${periodYear(periods.at(-1))}`);
    for (let value = domain.lo; value <= domain.hi + 1e-9; value += domain.step) {
      const y = yOf(value);
      line(svg, { x1: padLeft, x2: panelWidth - PAD_RIGHT, y1: y, y2: y, stroke: "rgba(233,233,237,.10)", "stroke-width": 1 });
      overlayLabel(overlay, value.toFixed(domain.step < 1 ? 1 : 0), 0, y - 7, { width: padLeft - 6, align: "right" });
    }
    if (panelDefinition.reference !== null) {
      const y = yOf(panelDefinition.reference);
      line(svg, { x1: padLeft, x2: panelWidth - PAD_RIGHT, y1: y, y2: y, stroke: "#9397ab", "stroke-width": 1, "stroke-dasharray": "2 4" });
      overlayLabel(overlay, "replacement, about 2.1", panelWidth - 172, y - 17, { width: 164, align: "right" });
    }

    for (const [id, entry] of byCountry) {
      const colour = seriesColours[id] ?? "#b2b6ca";
      const present = entry.rows.filter((row) => {
        const value = row[panelDefinition.key];
        return value !== null && value !== undefined && Number.isFinite(Number(value)) && positionOf.has(row.period);
      });
      if (!present.length) continue;
      const estimate = [], projection = [];
      for (const row of present) {
        const point = `${xOf(positionOf.get(row.period))},${yOf(row[panelDefinition.key])}`;
        if (row.series_kind === "estimate") estimate.push(point);
        else {
          if (!projection.length && estimate.length) projection.push(estimate.at(-1));
          projection.push(point);
        }
      }
      if (estimate.length) polyline(svg, estimate.join(" "), colour, 2);
      if (projection.length) polyline(svg, projection.join(" "), colour, 2, "7 5");
      const last = present.at(-1);
      if (last.period !== periods.at(-1)) {
        const x = xOf(positionOf.get(last.period)), y = yOf(last[panelDefinition.key]);
        circle(svg, x, y, 3, colour);
        overlayLabel(overlay, `${entry.name} — to ${periodYear(last.period)}`, Math.max(2, x - 148), y - 20,
          { width: 144, align: "right", color: colour });
      }
    }

    const selectionX = xOf(index);
    line(svg, { x1: selectionX, x2: selectionX, y1: 6, y2: TOP + HEIGHT + 10, stroke: "#e9e9ed", "stroke-width": 1, "stroke-dasharray": "3 3" });
    for (let step = 0; step < 4; step += 1) {
      const position = Math.round((step * (periods.length - 1)) / 3);
      overlayLabel(overlay, periodYear(periods[position]), Math.max(0, Math.min(panelWidth - 50, xOf(position) - 25)), 168, { width: 50 });
    }
    enablePicking(svg, periods.length, padLeft, inner);
    panel.append(root);
    grid.append(panel);
  }

  const fragment = document.createDocumentFragment();
  fragment.append(grid);
  if (provenance) fragment.append(provenanceLine(provenance));
  fragment.append(dataTable(
    "Fertility, life expectancy and healthy life expectancy by country and year",
    ["Year", "Country", "Fertility rate", "Life expectancy", "Healthy life expectancy"],
    observations.map((row) => [
      periodYear(row.period), row.location_name,
      plain(row.total_fertility_rate, 2), plain(row.life_expectancy_years, 1),
      plain(row.healthy_life_expectancy_years ?? null, 1),
    ]),
  ));
  return fragment;
}
