/**
 * Gross arrivals and departures where a provider publishes them, beside the
 * United Nations balance.
 *
 * The rows are joined by the report from three datasets before they reach
 * here. Their spine is the United Nations table, so a country the flow
 * provider does not cover still produces rows and still renders a panel — one
 * that says which collection it falls outside rather than disappearing.
 *
 * An absent flow is drawn as an absence. It is never a zero and never a gap
 * closed by the neighbouring year.
 */
import {
  axisGutter, chart, circle, dataTable, enablePicking, line, niceDomain, node,
  overlayLabel, panelGrid, people, periodYear, polyline, provenanceLine,
  valueStrip,
} from "./report-shared.js";
import { validateMigrationFlowsRows } from "./migration-flows.contract.js";

const ARRIVALS = "#8fb0d1", DEPARTURES = "#d09a6a", NET = "#b5abfc", ABSENT = "#f2994a";
const MAX_PAD_LEFT = 48, PAD_RIGHT = 6, TOP = 10, HEIGHT = 144, SVG_HEIGHT = 186;

function persons(value) {
  return value === null || value === undefined ? "not published" : people(Number(value) / 1000);
}

export function renderMigrationFlows(rows, display = {}, provenance = "") {
  const observations = validateMigrationFlowsRows(rows);
  const { width = 1188, selectedIndex, seriesColours = {}, columns = 3, flowCoverage = {} } = display;

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
  const { columns: panelColumns, width: panelWidth } = panelGrid(width, Math.min(columns, Math.max(1, byCountry.size)));
  grid.style.setProperty("--multiple-columns", String(panelColumns));

  // A panel with no published flows draws an absence rather than a plot, so
  // it contributes no scale and no label; the gutter is one figure-wide
  // width taken from the panels that do draw.
  const scales = new Map();
  for (const [id, entry] of byCountry) {
    const published = entry.rows.filter((row) => row.arrivals_persons !== null || row.departures_persons !== null);
    if (!published.length) continue;
    const values = [0, ...entry.rows.map((row) => row.net_migration_thousands)];
    for (const row of published) {
      if (row.arrivals_persons !== null) values.push(row.arrivals_persons / 1000);
      if (row.departures_persons !== null) values.push(row.departures_persons / 1000);
    }
    scales.set(id, { published, domain: niceDomain(Math.min(...values), Math.max(...values)) });
  }
  const padLeft = axisGutter([...scales.values()].map(({ domain }) => people(domain.hi)), { max: MAX_PAD_LEFT });

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
      { color: ARRIVALS, label: "Arrivals", value: persons(selected?.arrivals_persons ?? null) },
      { color: DEPARTURES, label: "Departures", value: persons(selected?.departures_persons ?? null) },
      { color: NET, label: "Net, UN", value: people(selected?.net_migration_thousands, { signed: true }) },
    ]));

    const scale = scales.get(id);
    if (!scale) {
      const absence = node("div");
      absence.className = "flow-absence";
      absence.setAttribute("role", "note");
      const marker = node("span", "✕ No gross flows published");
      marker.className = "absence-marker";
      absence.append(marker, node("p",
        `Eurostat publishes arrivals and departures for European reporting countries. ${entry.name} is outside that collection, so this panel has no flows to draw.`));
      absence.append(node("span", `United Nations net migration at ${periodYear(selectedPeriod)}: ${people(selected?.net_migration_thousands, { signed: true })} people`));
      panel.append(absence);
      grid.append(panel);
      continue;
    }

    const { published, domain } = scale;
    const inner = Math.max(120, panelWidth - padLeft - PAD_RIGHT);
    const xOf = (position) => padLeft + (periods.length === 1 ? inner / 2 : (position * inner) / (periods.length - 1));
    const yOf = (value) => TOP + HEIGHT - ((value - domain.lo) / (domain.hi - domain.lo)) * HEIGHT;
    const positionOf = new Map(periods.map((period, position) => [period, position]));

    const { root, svg, overlay } = chart(panelWidth, SVG_HEIGHT,
      `${entry.name}: arrivals, departures and net migration, ${periodYear(periods[0])} to ${periodYear(periods.at(-1))}`);
    const zeroY = yOf(0);
    line(svg, { x1: padLeft, x2: panelWidth - PAD_RIGHT, y1: zeroY, y2: zeroY, stroke: "#75798c", "stroke-width": 1 });

    for (const [field, colourOfFlow] of [["arrivals_persons", ARRIVALS], ["departures_persons", DEPARTURES]]) {
      const points = entry.rows
        .filter((row) => row[field] !== null && positionOf.has(row.period))
        .map((row) => `${xOf(positionOf.get(row.period))},${yOf(row[field] / 1000)}`);
      if (points.length) polyline(svg, points.join(" "), colourOfFlow, 2);
    }
    const netPoints = entry.rows
      .filter((row) => positionOf.has(row.period))
      .map((row) => `${xOf(positionOf.get(row.period))},${yOf(row.net_migration_thousands)}`);
    if (netPoints.length) polyline(svg, netPoints.join(" "), NET, 1.4, "4 3");

    const lastPublished = published.at(-1);
    const stopsEarly = flowCoverage[id] != null && periodYear(lastPublished.period) < String(flowCoverage[id]);
    if (stopsEarly || lastPublished.period !== periods.at(-1)) {
      const x = xOf(positionOf.get(lastPublished.period));
      const y = yOf((lastPublished.arrivals_persons ?? lastPublished.departures_persons ?? 0) / 1000);
      circle(svg, x, y, 3, ABSENT);
      overlayLabel(overlay, `to ${periodYear(lastPublished.period)}`, Math.max(2, x - 94), y - 20, { width: 88, align: "right", color: ABSENT });
    }

    overlayLabel(overlay, people(domain.hi), 0, yOf(domain.hi) - 7, { width: padLeft - 6, align: "right" });
    overlayLabel(overlay, "0", 0, zeroY - 7, { width: padLeft - 6, align: "right" });
    const selectionX = xOf(index);
    line(svg, { x1: selectionX, x2: selectionX, y1: 6, y2: TOP + HEIGHT + 8, stroke: "#e9e9ed", "stroke-width": 1, "stroke-dasharray": "3 3" });
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
  const legend = node("div");
  legend.className = "figure-legend";
  for (const [colour, text] of [[ARRIVALS, "Arrivals, Eurostat"], [DEPARTURES, "Departures, Eurostat"], [NET, "Net migration, United Nations"]]) {
    const item = node("span");
    const swatch = node("i");
    swatch.style.background = colour;
    item.append(swatch, document.createTextNode(text));
    legend.append(item);
  }
  fragment.append(legend);
  if (provenance) fragment.append(provenanceLine(provenance));
  fragment.append(dataTable(
    "Arrivals, departures and net migration by country and year",
    ["Year", "Country", "Arrivals", "Departures", "Net migration, UN"],
    observations.map((row) => [
      periodYear(row.period), row.location_name,
      persons(row.arrivals_persons ?? null), persons(row.departures_persons ?? null),
      people(row.net_migration_thousands, { signed: true }),
    ]),
  ));
  return fragment;
}
