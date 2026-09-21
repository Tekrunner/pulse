/**
 * Natural change and net migration, one small multiple per selected country.
 *
 * Two filled areas from zero and a line, never a stack: the provider's
 * population change is accounted for by its two components but is not their
 * sum, and a stack drawn as if it closed would assert an identity the data
 * does not hold.
 */
import {
  chart, dataTable, enablePicking, line, niceDomain, overlayLabel, people,
  periodYear, polyline, provenanceLine, signedPercent, valueStrip, node,
} from "./report-shared.js";
import { validateChangeCompositionRows } from "./change-composition.contract.js";

const NATURAL = "#9dc0ae", MIGRATION = "#d09a6a", CHANGE = "#e9e9ed";
const PAD_LEFT = 44, PAD_RIGHT = 6, TOP = 10, HEIGHT = 128, SVG_HEIGHT = 168;

function perMille(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  return `${number > 0 ? "+" : number < 0 ? "−" : ""}${Math.abs(number).toFixed(digits)}‰`;
}

export function renderChangeComposition(rows, display = {}, provenance = "") {
  const observations = validateChangeCompositionRows(rows);
  const { width = 1188, selectedIndex, seriesColours = {}, unit = "people", columns = 3 } = display;
  const perThousand = unit === "per-1000";
  const format = perThousand ? (value) => perMille(value) : (value) => people(value, { signed: true });

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
  grid.style.setProperty("--multiple-columns", String(Math.min(columns, Math.max(1, byCountry.size))));
  const panelWidth = Math.max(260, Math.floor((width - (Math.min(columns, byCountry.size) - 1) * 12) / Math.min(columns, byCountry.size)) - 20);

  for (const [id, entry] of byCountry) {
    const colour = seriesColours[id] ?? "#b2b6ca";
    const panel = node("div");
    panel.className = "multiple-panel";
    const title = node("span", entry.name);
    title.className = "multiple-title";
    title.style.color = colour;
    panel.append(title);

    const selected = entry.rows.find((row) => row.period === selectedPeriod);
    panel.append(valueStrip(periodYear(selectedPeriod), [
      { color: NATURAL, label: "Natural change", value: format(perThousand ? selected?.natural_change_rate_per_1000 : selected?.natural_change_thousands) },
      { color: MIGRATION, label: "Net migration", value: format(perThousand ? selected?.net_migration_rate_per_1000 : selected?.net_migration_thousands) },
      ...(perThousand ? [] : [{ color: CHANGE, label: "Population change", value: people(selected?.population_change_thousands, { signed: true }) }]),
    ]));

    const naturalOf = (row) => (perThousand ? row.natural_change_rate_per_1000 : row.natural_change_thousands);
    const migrationOf = (row) => (perThousand ? row.net_migration_rate_per_1000 : row.net_migration_thousands);
    const values = entry.rows.flatMap((row) => [naturalOf(row), migrationOf(row), ...(perThousand ? [] : [row.population_change_thousands])]);
    const domain = niceDomain(Math.min(...values), Math.max(...values));

    const inner = Math.max(180, panelWidth - PAD_LEFT - PAD_RIGHT);
    const xOf = (position) => PAD_LEFT + (periods.length === 1 ? inner / 2 : (position * inner) / (periods.length - 1));
    const yOf = (value) => TOP + HEIGHT - ((value - domain.lo) / (domain.hi - domain.lo)) * HEIGHT;
    const positionOf = new Map(periods.map((period, position) => [period, position]));

    const { root, svg, overlay } = chart(panelWidth, SVG_HEIGHT,
      `${entry.name}: natural change and net migration${perThousand ? " per 1,000 population" : ""}, ${periodYear(periods[0])} to ${periodYear(periods.at(-1))}`);
    const zeroY = yOf(0);

    for (const [accessor, colourOfArea] of [[naturalOf, NATURAL], [migrationOf, MIGRATION]]) {
      const top = [], bottom = [];
      for (const row of entry.rows) {
        const position = positionOf.get(row.period);
        if (position === undefined) continue;
        top.push(`${xOf(position)},${yOf(accessor(row))}`);
        bottom.unshift(`${xOf(position)},${zeroY}`);
      }
      if (top.length) polyline(svg, top.concat(bottom).join(" "), colourOfArea, 0, "", colourOfArea, 0.38);
    }
    line(svg, { x1: PAD_LEFT, x2: panelWidth - PAD_RIGHT, y1: zeroY, y2: zeroY, stroke: "#75798c", "stroke-width": 1 });
    for (const [accessor, colourOfLine] of [[naturalOf, NATURAL], [migrationOf, MIGRATION]]) {
      const points = entry.rows
        .filter((row) => positionOf.has(row.period))
        .map((row) => `${xOf(positionOf.get(row.period))},${yOf(accessor(row))}`);
      if (points.length) polyline(svg, points.join(" "), colourOfLine, 1.6);
    }
    if (!perThousand) {
      const points = entry.rows
        .filter((row) => positionOf.has(row.period))
        .map((row) => `${xOf(positionOf.get(row.period))},${yOf(row.population_change_thousands)}`);
      if (points.length) polyline(svg, points.join(" "), CHANGE, 1.2, "2 3", "none", 0.8);
    }

    overlayLabel(overlay, format(domain.hi), 0, yOf(domain.hi) - 7, { width: PAD_LEFT - 6, align: "right" });
    overlayLabel(overlay, format(domain.lo), 0, yOf(domain.lo) - 7, { width: PAD_LEFT - 6, align: "right" });
    const selectionX = xOf(index);
    line(svg, { x1: selectionX, x2: selectionX, y1: 6, y2: TOP + HEIGHT + 8, stroke: "#e9e9ed", "stroke-width": 1, "stroke-dasharray": "3 3" });
    for (let step = 0; step < 4; step += 1) {
      const position = Math.round((step * (periods.length - 1)) / 3);
      overlayLabel(overlay, periodYear(periods[position]), Math.max(0, Math.min(panelWidth - 50, xOf(position) - 25)), 150, { width: 50 });
    }
    enablePicking(svg, periods.length, PAD_LEFT, inner);
    panel.append(root);
    grid.append(panel);
  }

  const fragment = document.createDocumentFragment();
  fragment.append(grid);
  const legend = node("div");
  legend.className = "figure-legend";
  for (const [colour, text] of [[NATURAL, "Natural change"], [MIGRATION, "Net migration"], [CHANGE, "Population change"]]) {
    const item = node("span");
    const swatch = node("i");
    swatch.style.background = colour;
    item.append(swatch, document.createTextNode(text));
    legend.append(item);
  }
  fragment.append(legend);
  if (provenance) fragment.append(provenanceLine(provenance));
  fragment.append(dataTable(
    "Components of population change, by country and year",
    ["Year", "Country", "Natural change", "Net migration", "Population change"],
    observations.map((row) => [
      periodYear(row.period), row.location_name,
      `${people(row.natural_change_thousands, { signed: true })} (${perMille(row.natural_change_rate_per_1000, 2)})`,
      `${people(row.net_migration_thousands, { signed: true })} (${perMille(row.net_migration_rate_per_1000, 2)})`,
      people(row.population_change_thousands, { signed: true }),
    ]),
  ));
  return fragment;
}
