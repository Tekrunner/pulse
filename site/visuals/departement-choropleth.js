import { NS, node } from "./report-shared.js";

export const DEPARTEMENT_CHOROPLETH_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "departement-choropleth",
  question:
    "How unevenly is unemployment spread across the French départements, and where are the extremes?",
  consumerSchema: Object.freeze({
    departement_code: "string",
    departement_name: "string",
    region_code: "string",
    period: "string|null",
    unemployment_rate_pct: "number|null",
    geometry_geojson: "string",
    bbox_west: "number",
    bbox_south: "number",
    bbox_east: "number",
    bbox_north: "number",
  }),
  displaySchema: Object.freeze({
    width: "number",
    classBreaks: "array",
    classColours: "array",
    noDataColour: "string",
    selectedCode: "string|null",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  cleanup: "focused callback only — releases the shape listeners the map registers",
});

/** Overseas départements are drawn as insets: at their true positions the
 *  metropolitan map would shrink to a few pixels. */
const OVERSEAS = Object.freeze(["971", "972", "973", "974", "976"]);

export function validateChoroplethRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row, i) => {
    if (typeof row?.departement_code !== "string" || !row.departement_code) {
      throw new TypeError(`departement-choropleth@1.0.0 · row ${i} · expected a departement_code`);
    }
    if (typeof row?.geometry_geojson !== "string" || !row.geometry_geojson) {
      throw new TypeError(`departement-choropleth@1.0.0 · row ${i} · expected a geometry_geojson string`);
    }
    for (const field of ["bbox_west", "bbox_south", "bbox_east", "bbox_north"]) {
      if (!Number.isFinite(Number(row?.[field]))) {
        throw new TypeError(`departement-choropleth@1.0.0 · row ${i} · expected a finite ${field}`);
      }
    }
    // A null rate is valid and means "not published". Coercing it to zero would
    // paint an unpublished territory as the best-performing one on the map.
    const rate = row.unemployment_rate_pct,
      published = rate !== null && rate !== undefined && Number.isFinite(Number(rate));
    return {
      departement_code: row.departement_code,
      departement_name: String(row.departement_name ?? ""),
      region_code: String(row.region_code ?? ""),
      period: published ? String(row.period) : null,
      unemployment_rate_pct: published ? Number(rate) : null,
      geometry_geojson: row.geometry_geojson,
      bbox_west: Number(row.bbox_west),
      bbox_south: Number(row.bbox_south),
      bbox_east: Number(row.bbox_east),
      bbox_north: Number(row.bbox_north),
    };
  });
}

export function classOf(rate, breaks) {
  if (rate === null || rate === undefined) return null;
  let index = 0;
  while (index < breaks.length && rate >= breaks[index]) index += 1;
  return index;
}

export function classLabels(breaks) {
  const labels = [`under ${breaks[0]}%`];
  for (let i = 1; i < breaks.length; i += 1) {
    labels.push(`${breaks[i - 1]} – ${breaks[i]}%`);
  }
  labels.push(`${breaks.at(-1)}% and over`);
  return labels;
}

function projector(rows, width, height, pad = 4) {
  const west = Math.min(...rows.map((r) => r.bbox_west)),
    east = Math.max(...rows.map((r) => r.bbox_east)),
    south = Math.min(...rows.map((r) => r.bbox_south)),
    north = Math.max(...rows.map((r) => r.bbox_north)),
    // Longitude degrees shorten towards the poles; scaling them by the cosine
    // of the mid-latitude keeps shapes from stretching sideways.
    cos = Math.cos((((north + south) / 2) * Math.PI) / 180),
    spanX = Math.max(1e-9, (east - west) * cos),
    spanY = Math.max(1e-9, north - south),
    scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY),
    offsetX = pad + ((width - pad * 2) - spanX * scale) / 2,
    offsetY = pad + ((height - pad * 2) - spanY * scale) / 2;
  return (lon, lat) => [
    offsetX + (lon - west) * cos * scale,
    offsetY + (north - lat) * scale,
  ];
}

function pathData(geojson, project) {
  const geometry = JSON.parse(geojson),
    polygons =
      geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : geometry.type === "Polygon"
          ? [geometry.coordinates]
          : [];
  if (!polygons.length) throw new TypeError("departement-choropleth@1.0.0 · unsupported geometry type");
  const parts = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      let d = "";
      for (let i = 0; i < ring.length; i += 1) {
        const [x, y] = project(ring[i][0], ring[i][1]);
        d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      if (d) parts.push(`${d}Z`);
    }
  }
  return parts.join("");
}

function describe(row) {
  return row.unemployment_rate_pct === null
    ? `${row.departement_name}, ${row.departement_code}: no rate published`
    : `${row.departement_name}, ${row.departement_code}: ${row.unemployment_rate_pct.toFixed(1)} percent`;
}

function shape(row, project, display, onSelect) {
  const path = document.createElementNS(NS, "path"),
    published = row.unemployment_rate_pct !== null,
    index = classOf(row.unemployment_rate_pct, display.classBreaks);
  path.setAttribute("d", pathData(row.geometry_geojson, project));
  path.setAttribute(
    "fill",
    published ? display.classColours[Math.min(index, display.classColours.length - 1)] : display.noDataColour,
  );
  // A hairline border on every shape, so a territory is legible whether or not
  // its class is; the not-published fill additionally carries a dashed edge, so
  // colour is never the only cue.
  path.setAttribute("stroke", published ? "#161826" : "#9397ab");
  path.setAttribute("stroke-width", published ? "0.6" : "1");
  if (!published) path.setAttribute("stroke-dasharray", "3 2");
  path.setAttribute("tabindex", "0");
  path.setAttribute("role", "button");
  path.setAttribute("aria-label", describe(row));
  path.dataset.departement = row.departement_code;
  if (display.selectedCode === row.departement_code) {
    path.setAttribute("stroke", "#e9e9ed");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("aria-current", "true");
  }
  const select = () => onSelect(row.departement_code);
  path.addEventListener("click", select);
  path.addEventListener("focus", select);
  path.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select();
    }
  });
  return path;
}

/**
 * The map is drawn from the published geometry and the published rate; it owns
 * neither. A territory whose rate is absent renders in the not-published class,
 * never as zero and never as a missing shape.
 */
export function renderDepartementChoropleth(input, display, provenance) {
  const rows = validateChoroplethRows(input),
    total = Math.max(320, display.width),
    metropolitan = rows.filter((row) => !OVERSEAS.includes(row.departement_code)),
    overseas = OVERSEAS.map((code) => rows.find((row) => row.departement_code === code)).filter(
      Boolean,
    ),
    root = node("div");
  root.className = "choropleth";
  const emit = (code) =>
    root.dispatchEvent(
      new CustomEvent("pulse-select-territory", { bubbles: true, detail: { code } }),
    );

  const mapWidth = Math.min(total, 560),
    mapHeight = Math.round(mapWidth * 0.98),
    svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${mapWidth} ${mapHeight}`);
  svg.setAttribute("width", mapWidth);
  svg.setAttribute("height", mapHeight);
  svg.setAttribute("role", "group");
  svg.setAttribute(
    "aria-label",
    `Localised unemployment rate by département, metropolitan France${metropolitan[0]?.period ? `, ${metropolitan.find((row) => row.period)?.period ?? ""}` : ""}. Every département is listed in the table below this figure. ${provenance?.summary || ""}`,
  );
  const project = projector(metropolitan, mapWidth, mapHeight);
  for (const row of metropolitan) svg.append(shape(row, project, display, emit));
  const map = node("div");
  map.className = "choropleth-map";
  map.append(svg);

  const insets = node("div");
  insets.className = "choropleth-insets";
  for (const row of overseas) {
    const card = node("figure"),
      side = 78,
      mini = document.createElementNS(NS, "svg");
    card.className = "choropleth-inset";
    mini.setAttribute("viewBox", `0 0 ${side} ${side}`);
    mini.setAttribute("width", side);
    mini.setAttribute("height", side);
    mini.setAttribute("role", "group");
    mini.setAttribute("aria-label", describe(row));
    mini.append(shape(row, projector([row], side, side, 6), display, emit));
    const caption = node("figcaption");
    caption.append(
      node("span", row.departement_name),
      node(
        "b",
        row.unemployment_rate_pct === null
          ? "no rate"
          : `${row.unemployment_rate_pct.toFixed(1)}%`,
      ),
    );
    card.append(mini, caption);
    insets.append(card);
  }

  const legend = node("div");
  legend.className = "choropleth-legend";
  classLabels(display.classBreaks).forEach((label, index) => {
    const item = node("span"),
      swatch = node("i");
    swatch.style.background = display.classColours[index];
    item.append(swatch, node("span", label));
    legend.append(item);
  });
  const absent = node("span"),
    absentSwatch = node("i");
  absent.className = "legend-absent";
  absentSwatch.style.background = display.noDataColour;
  absent.append(absentSwatch, node("span", "not published"));
  legend.append(absent);

  // Map and insets share one row where the figure is wide enough for both, and
  // fall onto separate rows where it is not.
  const body = node("div");
  body.className = "choropleth-body";
  body.append(map, insets);
  root.append(legend, body);
  root._cleanup = () => {
    for (const path of root.querySelectorAll("path[data-departement]")) path.replaceWith(path.cloneNode(true));
  };
  return root;
}
