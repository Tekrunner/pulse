/**
 * GDP per inhabitant by departement relative to France in the same year, on
 * a map with an inset for Paris and the inner ring and one per overseas
 * departement, beside the selected departement's path over time and the
 * highest and lowest departements.
 *
 * Eight bins with unequal widths and a neutral 90–110 class, because half the
 * departements lie between 72 and 89 while Paris exceeds 300. The map's span
 * is the published span of the rows: a selected year outside it draws the
 * nearest published year and says so. Outlines are projected here,
 * equirectangular at 46.5° N; rings too small to see at their scale are
 * dropped.
 */
import {
  FRAME, dataTable, drawFrame, grouped, line, linearTicks, niceLinear, node, plotBox,
  plotCaption, polyline, provenanceLine, valueStrip, warning, yearScale, yearTicks,
} from "./report-shared.js";
import { validateIndexChoroplethRows } from "./index-choropleth.contract.js";

/** Bin upper bounds (exclusive) and colours; the last bin is open. */
export const INDEX_BINS = Object.freeze([
  Object.freeze({ lo: 0, hi: 60, color: "#2b5a85", label: "< 60" }),
  Object.freeze({ lo: 60, hi: 70, color: "#3f77a6", label: "60–70" }),
  Object.freeze({ lo: 70, hi: 80, color: "#6b9dc4", label: "70–80" }),
  Object.freeze({ lo: 80, hi: 90, color: "#a7c6de", label: "80–90" }),
  Object.freeze({ lo: 90, hi: 110, color: "#e6e0d2", label: "90–110" }),
  Object.freeze({ lo: 110, hi: 150, color: "#ecb67f", label: "110–150" }),
  Object.freeze({ lo: 150, hi: 200, color: "#d47d3e", label: "150–200" }),
  Object.freeze({ lo: 200, hi: Infinity, color: "#9c4a1c", label: "≥ 200" }),
]);

/** The bin an index falls in, 0 to 7; a bound belongs to the bin above it. Null when there is no index. */
export function binOf(index) {
  if (index === null || index === undefined || !Number.isFinite(index)) return null;
  const bin = INDEX_BINS.findIndex((item) => index < item.hi);
  return bin < 0 ? INDEX_BINS.length - 1 : bin;
}

const NOT_PUBLISHED = "#2f3542", SELECTED = "#ffd166", EDGE = "#111318", PATH = "#f2b872";
const WELL = "#161a23", WELL_EDGE = "#3a4152", MUTED = "#abb5c5";
const HATCH = "repeating-linear-gradient(45deg, #2a2f3b 0 3px, #4b5263 3px 5px)";
const MAP = Object.freeze({ width: 580, height: 710 });
const LINE = Object.freeze({ height: 190, top: 24, bottom: 160, x0: 48, padRight: 8 });
const K = Math.cos((46.5 * Math.PI) / 180);

const yearOf = (period) => Number(period.slice(0, 4));

/** A projection fitting the outer rings of `rows` into `box`, as [x, y, width, height]. */
function fit(rows, [bx, by, bw, bh]) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const row of rows) {
    for (const polygon of row.geometry.coordinates) {
      for (const [lon, lat] of polygon[0]) {
        minx = Math.min(minx, lon * K); maxx = Math.max(maxx, lon * K);
        miny = Math.min(miny, -lat); maxy = Math.max(maxy, -lat);
      }
    }
  }
  const scale = Math.min(bw / (maxx - minx || 1), bh / (maxy - miny || 1));
  const ox = bx + (bw - (maxx - minx) * scale) / 2, oy = by + (bh - (maxy - miny) * scale) / 2;
  return (lon, lat) => [ox + (lon * K - minx) * scale, oy + (-lat - miny) * scale];
}

/** One path for a departement's outer rings, without rings smaller than `minRing` in both directions. */
function outline(row, project, minRing) {
  const parts = [];
  for (const polygon of row.geometry.coordinates) {
    const points = polygon[0].map(([lon, lat]) => project(lon, lat));
    const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
    if (Math.max(...xs) - Math.min(...xs) < minRing && Math.max(...ys) - Math.min(...ys) < minRing) continue;
    parts.push(`M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`);
  }
  return parts.join("");
}

function svgNode(name, attrs = {}, text) {
  const item = node(name, text, true);
  for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value));
  return item;
}

export function renderIndexChoropleth(rows, display = {}, provenance = "") {
  const areas = validateIndexChoroplethRows(rows);
  const { width = 1188, selectedYear, notes = [] } = display;
  const years = areas.flatMap((row) => row.series.map((entry) => yearOf(entry.period)));
  const first = years.length ? Math.min(...years) : selectedYear, last = years.length ? Math.max(...years) : selectedYear;
  const wanted = selectedYear ?? last;
  const year = Math.min(Math.max(wanted, first), last), beyond = wanted !== year;
  const entryOf = (row, y = year) => row.series.find((entry) => yearOf(entry.period) === y) ?? null;
  const indexOf = (row) => entryOf(row)?.gdp_per_inhabitant_index_france ?? null;
  const selected = areas.find((row) => row.departement_code === display.selectedDepartement)
    ?? areas.find((row) => row.departement_code === "75") ?? areas[0];
  const selectedCode = selected?.departement_code;
  const current = selected ? entryOf(selected) : null;
  const france = current?.france_gdp_per_inhabitant_eur
    ?? areas.map((row) => entryOf(row)?.france_gdp_per_inhabitant_eur).find(Number.isFinite) ?? null;
  const wide = width >= 1000;

  const figure = node("figure");

  // Caption, strip and the nearest-year banner.
  figure.append(plotCaption(`GDP per inhabitant, France = 100 — ${year}${current?.is_provisional ? ", provisional" : ""}`));
  const index = current?.gdp_per_inhabitant_index_france ?? null;
  const strip = valueStrip(beyond ? `${year} · latest published` : String(year), [
    { label: `${selected.departement_name} (${selectedCode})`, value: index === null ? "not published" : `${grouped(index, 0)} (France = 100)` },
    { label: "per inhabitant", value: current?.gdp_per_inhabitant_eur == null ? "—" : `${grouped(current.gdp_per_inhabitant_eur, 0)} €` },
    { label: "France", value: france === null ? "—" : `${grouped(france, 0)} €` },
  ]);
  // The artboard's strip carries no swatches.
  for (const swatch of strip.querySelectorAll("i")) swatch.remove();
  figure.append(strip);
  if (beyond) {
    const banner = node("div");
    banner.className = "banner";
    const tag = node("span", "Nearest published year");
    tag.className = "tag";
    const text = node("span", `Departement figures are published ${first}–${last}; the map shows ${year}, the nearest published year, not ${wanted}.`);
    text.style.fontSize = "13px";
    const button = node("button", `Select ${year} everywhere`);
    button.type = "button";
    button.className = "b";
    button.addEventListener("click", () => {
      button.dispatchEvent(new CustomEvent("pulse-select", { bubbles: true, detail: { year } }));
    });
    banner.append(tag, text, button);
    figure.append(banner);
  }

  // The map and the column beside it, stacked when narrow.
  const block = node("div");
  Object.assign(block.style, {
    display: "grid", gridTemplateColumns: wide ? `${MAP.width}px minmax(0, 1fr)` : "minmax(0, 1fr)", gap: "24px", alignItems: "start",
  });
  const mapWidth = wide ? MAP.width : Math.min(MAP.width, width);
  const mapHeight = Math.round((MAP.height * mapWidth) / MAP.width);
  const map = plotBox(MAP.width, MAP.height, `Map of GDP per inhabitant by departement, index France = 100, ${year}, with insets for Paris and the inner ring and for each overseas departement; ${selected.departement_name} selected`);
  map.box.style.width = `${mapWidth}px`;
  map.box.style.height = `${mapHeight}px`;
  map.svg.setAttribute("width", mapWidth);
  map.svg.setAttribute("height", mapHeight);

  const pick = (code) => (event) => {
    event.currentTarget.dispatchEvent(new CustomEvent("pulse-select-area", { bubbles: true, detail: { code } }));
  };
  const shape = (row, d) => {
    const bin = binOf(indexOf(row)), chosen = row.departement_code === selectedCode;
    const path = svgNode("path", {
      d, fill: bin === null ? NOT_PUBLISHED : INDEX_BINS[bin].color, stroke: chosen ? SELECTED : EDGE, "stroke-width": chosen ? 2.2 : 0.5,
    });
    path.style.cursor = "pointer";
    path.dataset.code = row.departement_code;
    path.append(svgNode("title", {}, `${row.departement_name} (${row.departement_code}): ${bin === null ? "not published" : grouped(indexOf(row), 0)}`));
    path.addEventListener("click", pick(row.departement_code));
    return path;
  };
  // The selected outline is drawn last, so its stroke sits above its neighbours'.
  const selectedLast = (list) => [...list].sort((a, b) => (a.departement_code === selectedCode) - (b.departement_code === selectedCode));

  const metro = areas.filter((row) => row.inset !== "overseas");
  if (metro.length) {
    const project = fit(metro, [10, 10, 540, 540]);
    for (const row of selectedLast(metro)) {
      const d = outline(row, project, 1.2);
      if (d) map.svg.append(shape(row, d));
    }
  }
  const ring = areas.filter((row) => row.inset === "inner-ring");
  if (ring.length) {
    const group = svgNode("g", { transform: "translate(464,592)" });
    group.append(svgNode("rect", { x: -4, y: -4, width: 112, height: 98, fill: WELL, stroke: WELL_EDGE, rx: 6 }));
    const inner = svgNode("g", { transform: "translate(2,4) scale(0.68)" });
    const project = fit(ring, [0, 0, 150, 120]);
    for (const row of selectedLast(ring)) {
      const d = outline(row, project, 0.5);
      if (d) inner.append(shape(row, d));
    }
    group.append(inner, svgNode("text", { x: 52, y: 89, fill: MUTED, "font-size": 10, "text-anchor": "middle" }, "Paris and inner ring"));
    map.svg.append(group);
  }
  const overseas = areas.filter((row) => row.inset === "overseas")
    .sort((a, b) => (a.departement_code < b.departement_code ? -1 : a.departement_code > b.departement_code ? 1 : 0));
  overseas.forEach((row, k) => {
    const group = svgNode("g", { transform: `translate(${4 + k * 90},592)` });
    group.append(svgNode("rect", { x: -4, y: -4, width: 84, height: 98, fill: WELL, stroke: WELL_EDGE, rx: 6 }));
    const d = outline(row, fit([row], [0, 0, 76, 76]), 0.8);
    if (d) group.append(shape(row, d));
    // In SVG rather than the overlay, so the name scales with the map.
    group.append(svgNode("text", { x: 38, y: 84, fill: MUTED, "font-size": 10, "text-anchor": "middle", "dominant-baseline": "central" }, row.departement_name));
    map.svg.append(group);
  });
  block.append(map.box);

  const column = node("div");
  Object.assign(column.style, { display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" });

  // Legend.
  const legend = node("div");
  const legendCaption = plotCaption("Index, France = 100");
  legendCaption.style.marginBottom = "8px";
  const swatches = node("div");
  Object.assign(swatches.style, { display: "flex", flexWrap: "wrap", gap: "4px 0" });
  const swatch = (label, itemWidth, paint) => {
    const item = node("span");
    Object.assign(item.style, { display: "inline-flex", flexDirection: "column", gap: "3px", width: `${itemWidth}px`, fontSize: "11px", color: MUTED });
    const box = node("i");
    box.style.height = "12px";
    paint(box.style);
    item.append(box, document.createTextNode(label));
    return item;
  };
  for (const bin of INDEX_BINS) swatches.append(swatch(bin.label, 64, (style) => { style.background = bin.color; }));
  swatches.append(swatch("not published", 88, (style) => { style.backgroundColor = "#2a2f3b"; style.backgroundImage = HATCH; }));
  legend.append(legendCaption, swatches);
  column.append(legend);

  // The selected departement over time, on the map's own span.
  const columnWidth = wide ? width - MAP.width - 24 : width;
  const lineWidth = Math.max(160, Math.min(560, columnWidth));
  const X0 = LINE.x0, X1 = lineWidth - LINE.padRight, { top, bottom } = LINE;
  const xs = yearScale(first, last, X0, X1);
  const path = selected.series.filter((entry) => entry.gdp_per_inhabitant_index_france !== null)
    .map((entry) => [yearOf(entry.period), entry.gdp_per_inhabitant_index_france]);
  const values = path.map((point) => point[1]);
  const domain = niceLinear(Math.min(...values, 100), Math.max(...values, 100), false);
  const yv = (value) => bottom - ((value - domain.lo) / (domain.hi - domain.lo)) * (bottom - top);
  const ticks = linearTicks(domain, yv, (value) => grouped(value, 0))
    .map((tick) => ({ ...tick, zero: tick.zero || Math.abs(yv(100) - tick.y) < 0.5 }));
  const over = node("figure");
  Object.assign(over.style, { display: "flex", flexDirection: "column", gap: "8px", margin: "0" });
  over.append(plotCaption(`${selected.departement_name} over time`));
  const chart = plotBox(lineWidth, LINE.height, `${selected.departement_name}, GDP per inhabitant relative to France (France = 100) from ${first} to ${last}; ${year} marked`);
  drawFrame(chart.svg, chart.overlay, { x0: X0, x1: X1, top, bottom, yTicks: ticks, xTicks: yearTicks(xs, 7), unit: "France = 100" });
  line(chart.svg, { x1: X0, x2: X1, y1: yv(100), y2: yv(100), stroke: "rgba(115,214,194,.6)" });
  if (path.length) polyline(chart.svg, path.map(([y, value]) => `${xs.x(y + 0.5).toFixed(1)},${yv(value).toFixed(1)}`).join(" "), PATH, 2.2);
  const selectedX = xs.x(year + 0.5);
  line(chart.svg, { x1: selectedX, x2: selectedX, y1: top, y2: bottom, stroke: FRAME.mark, "stroke-dasharray": "3 3" });
  over.append(chart.box);
  column.append(over);

  // Highest and lowest, the keyboard equivalent of the map's shapes.
  const ranked = areas.filter((row) => indexOf(row) !== null).sort((a, b) => indexOf(b) - indexOf(a));
  const lists = node("div");
  Object.assign(lists.style, { display: "grid", gridTemplateColumns: width < 900 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", gap: "16px" });
  const list = (title, members) => {
    const wrap = node("div");
    const caption = plotCaption(title);
    caption.style.marginBottom = "6px";
    wrap.append(caption);
    for (const row of members) {
      const button = node("button");
      button.type = "button";
      button.className = "row";
      button.style.gridTemplateColumns = "minmax(0, 1fr) 48px";
      const name = node("span", `${row.departement_name} `);
      const code = node("span", row.departement_code);
      code.className = "muted";
      name.append(code);
      const value = node("span", grouped(indexOf(row), 0));
      Object.assign(value.style, { textAlign: "right", fontVariantNumeric: "tabular-nums" });
      button.append(name, value);
      button.addEventListener("click", pick(row.departement_code));
      wrap.append(button);
    }
    return wrap;
  };
  lists.append(list("Highest", ranked.slice(0, 5)), list("Lowest", ranked.slice(-5).reverse()));
  column.append(lists);
  block.append(column);
  figure.append(block);

  for (const note of notes) figure.append(warning(note.label, note.text));
  if (provenance) figure.append(provenanceLine(provenance));

  // Every departement, the published ones by index and then those without a figure.
  const unpublished = areas.filter((row) => indexOf(row) === null)
    .sort((a, b) => (a.departement_code < b.departement_code ? -1 : a.departement_code > b.departement_code ? 1 : 0));
  const table = ranked.concat(unpublished).map((row) => {
    const entry = entryOf(row);
    return [`${row.departement_name} (${row.departement_code})`,
      entry?.gdp_per_inhabitant_eur == null ? "—" : `${grouped(entry.gdp_per_inhabitant_eur, 0)} €`,
      grouped(entry?.gdp_per_inhabitant_index_france, 1)];
  });
  figure.append(dataTable(`GDP per inhabitant by departement, ${year}`,
    ["Departement", "€ per inhabitant", "France = 100"], table,
    { summary: "Data table — all departements, shown year", numeric: true }));
  return figure;
}

export { INDEX_CHOROPLETH_VISUAL_CONTRACT } from "./index-choropleth.contract.js";
