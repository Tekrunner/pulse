import { DataClientError } from "../../data/client.js";
import { getPageDataClient } from "../../data/browser-shell.js";
import {
  getPageStatusClient,
  qualificationLine,
  qualifyReport,
} from "../../data/status-client.js";
import { scenarioStatusClient } from "../../data/status-scenarios.js";
import { renderHeadlineTrendPair } from "../../visuals/headline-trend-pair.js";
import { renderSlackMultiples } from "../../visuals/slack-multiples.js";
import { renderAgeBandLines, AGE_BANDS } from "../../visuals/age-band-lines.js";
import { renderParticipationGapBand } from "../../visuals/participation-gap-band.js";
import {
  renderDepartementChoropleth,
  classOf,
} from "../../visuals/departement-choropleth.js";
import {
  renderInternationalLines,
  renderComparatorLines,
} from "../../visuals/international-lines.js";

const interFontUrl = new URL("../../../assets/fonts/InterVariable.woff2", import.meta.url);
if (!document.querySelector("style[data-pulse-inter]")) {
  const fontStyle = document.createElement("style");
  fontStyle.dataset.pulseInter = "";
  fontStyle.textContent = `@font-face{font-family:Inter;src:url("${interFontUrl}") format("woff2");font-style:normal;font-weight:100 900;font-display:swap}`;
  document.head.append(fontStyle);
}

export const REPORT_ID = "french-unemployment";
export const NATIONAL_DATASET_ID = "french-labour-market-quarterly",
  DEPARTEMENT_RATES_DATASET_ID = "french-departement-unemployment",
  DEPARTEMENT_GEOMETRY_DATASET_ID = "french-departement-geometry",
  INTERNATIONAL_UNEMPLOYMENT_DATASET_ID = "oecd-unemployment-comparison",
  INTERNATIONAL_PARTICIPATION_DATASET_ID = "oecd-participation-comparison";

// Every statement below is the declared query of the same name in report.yml.
// The report owns data access; visuals receive plain rows and never see SQL.
export const HEADLINE_TREND_SQL =
  "SELECT CAST(period AS VARCHAR) AS period, CAST(unemployment_rate_pct AS DOUBLE) AS unemployment_rate_pct, CAST(unemployed_thousands AS DOUBLE) AS unemployed_thousands FROM french_labour_market_quarterly WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period";
export const LABOUR_SLACK_SQL =
  "SELECT CAST(period AS VARCHAR) AS period, CAST(unemployed_thousands AS DOUBLE) AS unemployed_thousands, CAST(unemployment_rate_pct AS DOUBLE) AS unemployment_rate_pct, CAST(long_term_unemployed_thousands AS DOUBLE) AS long_term_unemployed_thousands, CAST(long_term_unemployment_rate_pct AS DOUBLE) AS long_term_unemployment_rate_pct, CAST(halo_15_to_64_thousands AS DOUBLE) AS halo_15_to_64_thousands, CAST(halo_share_of_population_15_to_64_pct AS DOUBLE) AS halo_share_of_population_15_to_64_pct, CAST(underemployed_thousands AS DOUBLE) AS underemployed_thousands, CAST(underemployment_rate_pct AS DOUBLE) AS underemployment_rate_pct FROM french_labour_market_quarterly WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period";
export const AGE_BANDS_SQL =
  "SELECT CAST(period AS VARCHAR) AS period, CAST(unemployment_rate_under_25_pct AS DOUBLE) AS unemployment_rate_under_25_pct, CAST(unemployment_rate_25_to_49_pct AS DOUBLE) AS unemployment_rate_25_to_49_pct, CAST(unemployment_rate_50_and_over_pct AS DOUBLE) AS unemployment_rate_50_and_over_pct, CAST(unemployed_under_25_thousands AS DOUBLE) AS unemployed_under_25_thousands, CAST(unemployed_25_to_49_thousands AS DOUBLE) AS unemployed_25_to_49_thousands, CAST(unemployed_50_and_over_thousands AS DOUBLE) AS unemployed_50_and_over_thousands FROM french_labour_market_quarterly WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period";
export const PARTICIPATION_RATES_SQL =
  "SELECT CAST(period AS VARCHAR) AS period, CAST(participation_rate_men_15_to_64_pct AS DOUBLE) AS participation_rate_men_15_to_64_pct, CAST(participation_rate_women_15_to_64_pct AS DOUBLE) AS participation_rate_women_15_to_64_pct, CAST(participation_rate_15_to_64_pct AS DOUBLE) AS participation_rate_15_to_64_pct, CAST(participation_rate_pct AS DOUBLE) AS participation_rate_pct FROM french_labour_market_quarterly WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period";
export const DEPARTEMENT_GEOMETRY_SQL =
  "SELECT departement_code, departement_name, region_code, geometry_geojson, CAST(bbox_west AS DOUBLE) AS bbox_west, CAST(bbox_south AS DOUBLE) AS bbox_south, CAST(bbox_east AS DOUBLE) AS bbox_east, CAST(bbox_north AS DOUBLE) AS bbox_north FROM french_departement_geometry ORDER BY departement_code";
export const DEPARTEMENT_RATES_SQL =
  "SELECT CAST(period AS VARCHAR) AS period, territory_kind, territory_code, territory_name, CAST(unemployment_rate_pct AS DOUBLE) AS unemployment_rate_pct FROM french_departement_unemployment WHERE territory_kind IN ('departement', 'country') AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period, territory_code";
export const INTERNATIONAL_UNEMPLOYMENT_SQL =
  "SELECT CAST(period AS VARCHAR) AS period, reference_area_code, reference_area_name, reference_area_kind, CAST(unemployment_rate_pct AS DOUBLE) AS unemployment_rate_pct FROM oecd_unemployment_comparison WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY reference_area_code, period";
export const INTERNATIONAL_PARTICIPATION_SQL =
  "SELECT CAST(period AS VARCHAR) AS period, reference_area_code, reference_area_name, reference_area_kind, sex, CAST(participation_rate_pct AS DOUBLE) AS participation_rate_pct FROM oecd_participation_comparison WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY reference_area_code, sex, period";

const HEADLINE_TREND_COLUMNS = ["period", "unemployment_rate_pct", "unemployed_thousands"];
const LABOUR_SLACK_COLUMNS = [
  "period", "unemployed_thousands", "unemployment_rate_pct",
  "long_term_unemployed_thousands", "long_term_unemployment_rate_pct",
  "halo_15_to_64_thousands", "halo_share_of_population_15_to_64_pct",
  "underemployed_thousands", "underemployment_rate_pct",
];
const AGE_BANDS_COLUMNS = [
  "period", "unemployment_rate_under_25_pct", "unemployment_rate_25_to_49_pct",
  "unemployment_rate_50_and_over_pct", "unemployed_under_25_thousands",
  "unemployed_25_to_49_thousands", "unemployed_50_and_over_thousands",
];
const PARTICIPATION_RATES_COLUMNS = [
  "period", "participation_rate_men_15_to_64_pct",
  "participation_rate_women_15_to_64_pct", "participation_rate_15_to_64_pct",
  "participation_rate_pct",
];
const DEPARTEMENT_GEOMETRY_COLUMNS = [
  "departement_code", "departement_name", "region_code", "geometry_geojson",
  "bbox_west", "bbox_south", "bbox_east", "bbox_north",
];
const DEPARTEMENT_RATES_COLUMNS = [
  "period", "territory_kind", "territory_code", "territory_name", "unemployment_rate_pct",
];
const INTERNATIONAL_UNEMPLOYMENT_COLUMNS = [
  "period", "reference_area_code", "reference_area_name", "reference_area_kind",
  "unemployment_rate_pct",
];
const INTERNATIONAL_PARTICIPATION_COLUMNS = [
  "period", "reference_area_code", "reference_area_name", "reference_area_kind",
  "sex", "participation_rate_pct",
];

// The categorical order validated against this report's surface. France holds
// slot 1 permanently; every other comparator claims a free slot when it is
// added and releases it only when removed, so removing one never repaints the
// others.
const SERIES_SLOTS = Object.freeze([
  "#3987e5", "#d95926", "#199e70", "#c98500",
  "#d55181", "#008300", "#9085e9", "#e66767",
]);
const MAP_CLASS_BREAKS = Object.freeze([6, 7, 8, 10]);
const MAP_CLASS_COLOURS = Object.freeze([
  "#1c5cab", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb",
]);
const MAP_NO_DATA_COLOUR = "#3f424d";
const MAP_PROMOTES_TABLE_BELOW = 700;
const DEFAULT_COMPARATORS = Object.freeze(["FRA", "DEU", "GBR", "USA", "EU"]);
const EMPHASIS_CODE = "FRA";
const SERIES_CAP = 8;
const PRESETS = Object.freeze([
  ["five-years", "5 years", 19],
  ["ten-years", "10 years", 39],
  ["from-start", "From start", null],
]);

const INSEE_PROVENANCE =
  "Source: INSEE, enquête Emploi, indicateurs trimestriels au sens du BIT · Licence Ouverte / Open Licence 2.0";
const LOCALISED_PROVENANCE =
  "Rates: INSEE, taux de chômage localisés · Licence Ouverte / Open Licence 2.0. Boundaries: IGN, ADMIN EXPRESS COG CARTO, édition 2026 · Licence Ouverte / Open Licence 2.0";
const OECD_UNEMPLOYMENT_PROVENANCE = "Source: OECD, Monthly unemployment rates · CC BY 4.0";
const OECD_PARTICIPATION_PROVENANCE = "Source: OECD, Labour force participation rate · CC BY 4.0";
// The OECD's adaptation disclaimer is not carried here. Drawing published
// values in a figure is use, not adaptation: CC BY 4.0 reserves "Adapted
// Material" for material modified in a manner requiring permission, and a rate
// plotted on an axis is a fact. The obligation attaches where Pulse actually
// republishes a substantial portion of the OECD database in restructured form,
// and the full attribution travels with it in sources/oecd-*/source.yaml.

const el = (name, text) => {
  const item = document.createElement(name);
  if (text !== undefined) item.textContent = String(text);
  return item;
};
const iso = (value) => String(value).slice(0, 10);
const quarterOf = (value) => Math.floor((Number(String(value).slice(5, 7)) - 1) / 3) + 1;
const qLabel = (value, short = false) =>
  `Q${quarterOf(value)} ${short ? String(value).slice(2, 4) : String(value).slice(0, 4)}`;
const mLabel = (value) =>
  new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso(value)}T00:00:00Z`),
  );
const shiftMonths = (value, months) => {
  const total =
    Number(String(value).slice(0, 4)) * 12 + (Number(String(value).slice(5, 7)) - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
};
const shiftQuarters = (value, quarters) => {
  const total =
    Number(String(value).slice(0, 4)) * 12 +
    (Number(String(value).slice(5, 7)) - 1) +
    quarters * 3;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
};
// Headcounts are published in thousands, to one decimal, and read in millions.
// Rounded on the integer hundredths rather than by toFixed: 1,825.0 thousand is
// 1.825 million, which is not exactly representable, so toFixed(2) would show
// 1.82 and lose the half upwards.
const millionsValue = (value) => (Math.round(Number(value) / 10) / 100).toFixed(2);
const millions = (value, { long = false } = {}) => {
  const text = millionsValue(value);
  return long ? `${text} million` : `${text}M`;
};
const signed = (value, digits = 1) =>
  `${value > 0 ? "▲ " : value < 0 ? "▼ " : ""}${Math.abs(value).toFixed(digits)}`;

/**
 * The mapping boundary. Each column is checked against the type the declared
 * schema gives it — named, not inferred from the value that arrived, so a
 * number that starts arriving as text is caught rather than accepted.
 */
function checkedQuery(params, columns, { requireRows = false, strings = ["period"], nullable = [] } = {}) {
  return {
    params,
    expectedColumns: columns,
    requireRows,
    mapRow(row) {
      for (const column of columns) {
        const value = row[column];
        if (nullable.includes(column) && (value === null || value === undefined)) continue;
        const valid = strings.includes(column)
          ? typeof value === "string" && value.length > 0
          : typeof value !== "string" && Number.isFinite(Number(value));
        if (!valid) {
          throw new DataClientError("schema", `The report data has an incompatible '${column}' field.`);
        }
      }
      return row;
    },
  };
}

function scenarioClient(client, scenario) {
  if (!scenario) return client;
  const dataset = {
    representedPeriod: { start: "2003-01-01", end: "2026-04-01" },
    semanticMetadata: { indicators: [] },
  };
  if (scenario === "loading")
    return { getDataset: async () => dataset, query: () => new Promise(() => {}) };
  if (scenario === "empty")
    return { getDataset: async () => dataset, query: async () => [] };
  if (scenario === "query")
    return {
      getDataset: async () => dataset,
      query: async () => {
        throw new DataClientError("query", "The report data could not be queried.");
      },
    };
  if (scenario === "engine")
    return {
      getDataset: async () => dataset,
      query: async () => {
        throw new DataClientError("wasm-startup", "The data engine did not start.");
      },
    };
  if (scenario === "slot-query") {
    // One dataset fails while every other section keeps its data: the report
    // must isolate the failure rather than clear itself.
    return {
      getDataset: (id) => client.getDataset(id),
      query: (id, ...rest) => {
        if (id === DEPARTEMENT_RATES_DATASET_ID || id === DEPARTEMENT_GEOMETRY_DATASET_ID) {
          return Promise.reject(new DataClientError("query", "The query did not complete."));
        }
        return client.query(id, ...rest);
      },
    };
  }
  return client;
}

function quarterSelect(label, value, min, max, onchange) {
  const wrap = el("label");
  wrap.className = "quarter-picker";
  wrap.append(el("span", label));
  const quarter = el("select"),
    year = el("select");
  quarter.setAttribute("aria-label", `${label} quarter`);
  year.setAttribute("aria-label", `${label} year`);
  quarter.dataset.control = `${label.toLowerCase()}-quarter`;
  year.dataset.control = `${label.toLowerCase()}-year`;
  for (let q = 1; q <= 4; q += 1) {
    const option = el("option", `Q${q}`);
    option.value = String(q);
    quarter.append(option);
  }
  for (let y = Number(min.slice(0, 4)); y <= Number(max.slice(0, 4)); y += 1) {
    const option = el("option", String(y));
    option.value = String(y);
    year.append(option);
  }
  quarter.value = String(quarterOf(value));
  year.value = value.slice(0, 4);
  const changed = () =>
    onchange(`${year.value}-${String((Number(quarter.value) - 1) * 3 + 1).padStart(2, "0")}-01`);
  quarter.addEventListener("change", changed);
  year.addEventListener("change", changed);
  wrap.append(quarter, year);
  return wrap;
}

function dataTable(caption, columns, rows, { sortable = false } = {}) {
  const scroll = el("div"),
    table = el("table"),
    head = el("thead"),
    headRow = el("tr"),
    body = el("tbody");
  scroll.className = "table-scroll";
  table.className = "accessible-data";
  table.append(el("caption", caption));
  for (const column of columns) {
    const cell = el("th", column.label);
    cell.scope = "col";
    if (column.numeric) cell.className = "n";
    headRow.append(cell);
  }
  head.append(headRow);
  const paint = (ordered) => {
    body.replaceChildren();
    for (const row of ordered) {
      const line = el("tr");
      columns.forEach((column, index) => {
        const cell = el(
          index ? "td" : "th",
          column.format ? column.format(row[column.key], row) : String(row[column.key] ?? ""),
        );
        if (!index) cell.scope = "row";
        if (column.numeric) cell.className = "n";
        line.append(cell);
      });
      body.append(line);
    }
  };
  paint(rows);
  if (sortable) {
    let active = null,
      descending = true;
    columns.forEach((column, index) => {
      if (!column.sortKey) return;
      const button = el("button", column.label);
      button.type = "button";
      button.className = "sort-button";
      button.addEventListener("click", () => {
        descending = active === column.key ? !descending : true;
        active = column.key;
        const sorted = [...rows].sort((a, b) => {
          const left = a[column.sortKey],
            right = b[column.sortKey];
          if (left === right) return 0;
          if (left === null || left === undefined) return 1;
          if (right === null || right === undefined) return -1;
          const order = typeof left === "number" ? left - right : String(left).localeCompare(String(right));
          return descending ? -order : order;
        });
        paint(sorted);
        for (const cell of headRow.children) cell.removeAttribute("aria-sort");
        headRow.children[index].setAttribute("aria-sort", descending ? "descending" : "ascending");
      });
      headRow.children[index].replaceChildren(button);
    });
  }
  table.append(head, body);
  scroll.append(table);
  return scroll;
}

function disclosure(summaryText, provenance, sql, table) {
  const details = el("details"),
    summary = el("summary", summaryText),
    note = el("p", provenance),
    code = el("code", sql);
  note.className = "provenance";
  details.append(summary, note, code, table);
  return details;
}

function measured(wrapper, draw, initialWidth) {
  let width = 0,
    node = null,
    observer = null;
  const commit = (candidate) => {
    // Floored, not rounded: rounding a 925.6px container up to 926 gives the
    // figure a pixel it does not have and puts a scrollbar under every chart.
    const next = Math.floor(
      typeof candidate === "number" ? candidate : wrapper.getBoundingClientRect().width,
    );
    if (next > 0 && next !== width) {
      width = next;
      draw(next);
    }
  };
  if (node !== wrapper) {
    node = wrapper;
    observer = new ResizeObserver(() => commit());
    observer.observe(wrapper);
  }
  commit(initialWidth);
  requestAnimationFrame(() => commit());
  const timer = setInterval(() => commit(), 500);
  return () => {
    observer?.disconnect();
    clearInterval(timer);
  };
}

/**
 * One independent figure. A failure inside it is written into the figure and
 * nowhere else: siblings keep their data, their controls and their focus.
 */
function figureCard({
  key,
  title,
  subtitle,
  legend,
  control,
  readout,
  draw,
  onSelect,
  onSelectTerritory,
  disclosureNode,
  initialWidth,
  forceError,
}) {
  const figure = el("figure"),
    caption = el("figcaption"),
    heading = el("h3", title),
    wrapper = el("div");
  heading.id = `figure-${key}-heading`;
  figure.dataset.figure = key;
  figure.dataset.state = "ready";
  figure.setAttribute("aria-labelledby", heading.id);
  wrapper.className = "chart-wrapper";
  caption.append(heading);
  if (subtitle) {
    const description = el("p", subtitle);
    caption.append(description);
  }
  figure.append(caption);
  if (legend) figure.append(legend);
  if (control) figure.append(control);
  figure.append(wrapper);
  let cleanup = () => {};
  const fail = (kind, message, retry) => {
    figure.dataset.state = kind;
    const box = el("div");
    box.className = "slot-error";
    box.setAttribute("role", "alert");
    box.append(el("strong", message.heading), el("p", message.body));
    if (retry) {
      const button = el("button", "Try this figure again");
      button.type = "button";
      button.addEventListener("click", retry);
      box.append(button);
    }
    box.append(el("code", message.code));
    wrapper.replaceChildren(box);
  };
  try {
    if (forceError === "schema" && key === "slack-multiples") {
      throw new DataClientError("schema", "published columns no longer match this figure");
    }
    cleanup = measured(
      wrapper,
      (width) => {
        try {
          if (forceError === "render" && key === "age-band-lines") {
            throw new Error("render fixture");
          }
          const visual = draw(width);
          if (onSelect) {
            visual.addEventListener("pulse-select", (event) => onSelect(event.detail.index));
          }
          if (onSelectTerritory) {
            visual.addEventListener("pulse-select-territory", (event) =>
              onSelectTerritory(event.detail.code),
            );
          }
          wrapper.replaceChildren(visual);
          figure.dataset.state = "ready";
        } catch (error) {
          fail("render-error", {
            heading: "This figure could not be drawn.",
            body: "The values are below as a table. The data arrived and validated; drawing threw, and the report keeps the accessible table so the answer is still available.",
            code: `RenderError · ${key}@1.0.0 · caught at the figure boundary · ${String(error.message)}`,
          });
        }
      },
      initialWidth,
    );
  } catch (error) {
    fail("schema-error", {
      heading: "This figure is out of date with its data.",
      body: "The published columns no longer match what this figure expects. It has been hidden rather than drawn from fields it cannot verify. Retrying cannot help.",
      code: `SchemaIncompatibility · ${key}@1.0.0 · ${String(error.safeMessage || error.message)}`,
    });
  }
  if (readout) figure.append(readout);
  if (disclosureNode) figure.append(disclosureNode);
  figure._cleanup = cleanup;
  return figure;
}

function readoutLine(parts) {
  const paragraph = el("p");
  paragraph.className = "readout";
  for (const part of parts) {
    paragraph.append(typeof part === "string" ? document.createTextNode(part) : part);
  }
  return paragraph;
}
const strong = (text) => el("b", text);

function caution(bodyNodes) {
  const box = el("div");
  box.className = "caution";
  const text = el("p");
  text.append(...bodyNodes);
  box.append(text);
  return box;
}

export function renderFrenchUnemploymentReport({
  client = getPageDataClient(),
  statusClient = getPageStatusClient(),
  scenario,
} = {}) {
  const main = el("main");
  main.className = "pulse-report unemployment-report";
  const navigation = el("nav"),
    home = el("a", "Pulse reports");
  navigation.setAttribute("aria-label", "Report navigation");
  home.href = "../../";
  navigation.append(home);
  const header = el("header"),
    kicker = el("span", "Standing report · France · quarterly"),
    title = el("h1", "Unemployment in France"),
    standfirst = el(
      "p",
      "Unemployment in France on the ILO definition. Every figure below is published by INSEE or the OECD and is shown at the precision the provider publishes.",
    ),
    meta = el("dl");
  kicker.className = "eyebrow";
  standfirst.className = "standfirst";
  header.append(kicker, title, standfirst, meta);
  const standings = el("section"),
    standingsTitle = el("h2", "Where the labour market stands"),
    scorecards = el("div"),
    controls = el("section"),
    content = el("section");
  standingsTitle.id = "where-the-labour-market-stands";
  standings.className = "standings";
  standings.setAttribute("aria-labelledby", standingsTitle.id);
  scorecards.className = "scorecards";
  standings.append(standingsTitle, scorecards);
  controls.className = "exploration";
  controls.setAttribute("aria-label", "Exploration controls");
  content.className = "report-content";
  main.append(navigation, header, standings, controls, content);

  const active = scenarioClient(client, scenario);
  const activeStatus = scenarioStatusClient(statusClient, scenario);
  let qualification = null,
    headline = [],
    slack = [],
    ages = [],
    participation = [],
    geometry = [],
    localised = [],
    comparison = [],
    comparisonParticipation = [],
    territorialFailure = null,
    internationalFailure = null,
    minQ,
    maxQ,
    startQ,
    endQ,
    selQ = null,
    selectionPinned = false,
    selectedDepartement = null,
    preset = "ten-years",
    basis = "15-64",
    comparators = [...DEFAULT_COMPARATORS],
    cleanups = [],
    request = 0;
  main.style.overflowAnchor = "none";

  const colourFor = (() => {
    const assigned = new Map([[EMPHASIS_CODE, SERIES_SLOTS[0]]]);
    return (codes) => {
      for (const code of [...assigned.keys()]) {
        if (code !== EMPHASIS_CODE && !codes.includes(code)) assigned.delete(code);
      }
      for (const code of codes) {
        if (assigned.has(code)) continue;
        const taken = new Set(assigned.values()),
          free = SERIES_SLOTS.find((slot) => !taken.has(slot));
        assigned.set(code, free || SERIES_SLOTS.at(-1));
      }
      return Object.fromEntries(assigned);
    };
  })();

  function captureView() {
    const focused = document.activeElement;
    return {
      x: window.scrollX,
      y: window.scrollY,
      control: focused?.dataset?.control || null,
      departement: focused?.dataset?.departement || null,
      open: [...content.querySelectorAll("details[open]")].map(
        (item) => item.closest("figure,section")?.dataset.figure || item.dataset.disclosure || "",
      ),
    };
  }
  function restoreView(view) {
    if (view.control) {
      const restored =
        content.querySelector(`[data-control="${view.control}"]`) ??
        controls.querySelector(`[data-control="${view.control}"]`);
      restored?.focus({ preventScroll: true });
    }
    if (view.departement) {
      content
        .querySelector(`[data-departement="${view.departement}"]`)
        ?.focus({ preventScroll: true });
    }
    content.style.minHeight = "";
    window.scrollTo({ left: view.x, top: view.y, behavior: "instant" });
  }

  function applyQualification() {
    for (const previous of [...meta.querySelectorAll("[data-qualification]")]) previous.remove();
    const line = qualificationLine(qualification);
    if (!line || !meta.children.length) return;
    const item = el("div");
    item.dataset.qualification = qualification.state;
    item.append(el("dt", "Data qualification"), el("dd", line));
    meta.append(item);
  }
  async function loadQualification() {
    try {
      const [status, reports] = await Promise.all([activeStatus.status(), activeStatus.reports()]);
      qualification = qualifyReport({ status, reports, reportId: REPORT_ID, now: new Date() });
    } catch {
      qualification = null;
    }
    applyQualification();
  }

  const state = (kind, text, extra) => {
    content.dataset.state = kind;
    content.setAttribute("aria-live", "polite");
    content.setAttribute("aria-busy", kind === "loading" ? "true" : "false");
    const message = el("p", text);
    message.className = "state-message";
    if (kind === "loading") {
      const skeletons = [320, 300, 260].map((height) => {
        const item = el("div");
        item.className = "state-skeleton";
        item.style.minHeight = `${height}px`;
        return item;
      });
      content.replaceChildren(message, ...skeletons);
    } else content.replaceChildren(message, ...(extra ? [extra] : []));
  };

  /**
   * Until the reader picks an observation the report follows the latest one, so
   * narrowing the window still opens on the newest quarter rather than on the
   * oldest one now in range. Once a quarter is picked it is kept, clamped to
   * whichever end of the new window it fell off.
   */
  const selectIndex = () => {
    if (!selectionPinned || !selQ) return headline.length - 1;
    const found = headline.findIndex((row) => iso(row.period) === selQ);
    if (found >= 0) return found;
    return selQ > iso(headline.at(-1).period) ? headline.length - 1 : 0;
  };
  const updateSelection = (index) => {
    selectionPinned = true;
    selQ = iso(headline[Math.min(headline.length - 1, Math.max(0, index))]?.period);
    renderReady();
  };
  /**
   * The international families publish monthly and quarterly on their own
   * calendars, but the reader picks one observation for the whole report. A
   * period picked on any of those figures is resolved to the quarter that
   * contains it, clamped into the national series; the reverse mapping picks
   * the position in that figure's own period list closest to the selection.
   */
  const selectPeriod = (period) => {
    const month = Number(String(period).slice(5, 7)),
      quarter = `${String(period).slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`,
      first = iso(headline[0].period),
      last = iso(headline.at(-1).period);
    selectionPinned = true;
    selQ = quarter < first ? first : quarter > last ? last : quarter;
    renderReady();
  };
  const positionIn = (periods, quarterStart, { monthly = false } = {}) => {
    if (!periods.length) return 0;
    // A quarter is represented by its last month in a monthly panel.
    const target = monthly ? shiftMonths(quarterStart, 2) : quarterStart,
      exact = periods.indexOf(target);
    if (exact >= 0) return exact;
    if (target < periods[0]) return 0;
    if (target > periods.at(-1)) return periods.length - 1;
    return Math.max(0, periods.findIndex((period) => period > target) - 1);
  };

  function renderControls(selected) {
    controls.replaceChildren();
    const periodField = el("fieldset"),
      legend = el("legend", "Represented period"),
      periodRow = el("div"),
      presets = el("div");
    periodField.className = "period-field";
    periodRow.className = "period-row";
    presets.className = "segments";
    presets.setAttribute("role", "radiogroup");
    presets.setAttribute("aria-label", "Represented period presets");
    periodField.append(legend, periodRow);
    periodRow.append(presets);
    for (const [key, label, back] of PRESETS) {
      const item = el("label"),
        input = el("input");
      input.type = "radio";
      input.name = "unemployment-period";
      input.value = key;
      input.dataset.control = `period-${key}`;
      input.checked = preset === key;
      input.addEventListener("change", () => {
        preset = key;
        startQ = back === null ? minQ : shiftQuarters(maxQ, -back);
        endQ = maxQ;
        void load();
      });
      item.append(input, el("span", label));
      presets.append(item);
    }
    const range = el("div");
    range.className = "period-range";
    range.append(
      quarterSelect("Start", startQ, minQ, maxQ, (value) => {
        startQ = value;
        if (startQ > endQ) endQ = startQ;
        preset = "custom";
        void load();
      }),
      el("span", "to"),
      quarterSelect("End", endQ, minQ, maxQ, (value) => {
        endQ = value;
        if (endQ < startQ) startQ = endQ;
        preset = "custom";
        void load();
      }),
    );
    periodRow.append(range);

    const now = headline[selected],
      participationNow = participation[selected],
      observation = el("label"),
      slider = el("input"),
      output = el("output");
    observation.className = "observation-control";
    observation.append(el("span", "Observation quarter — or click any point on a figure"));
    slider.id = "pulse-quarter";
    slider.type = "range";
    slider.min = "0";
    slider.max = String(Math.max(0, headline.length - 1));
    slider.step = "1";
    slider.value = String(selected);
    slider.dataset.control = "observation-quarter";
    slider.setAttribute("aria-label", "Observation quarter");
    slider.setAttribute(
      "aria-valuetext",
      `${qLabel(now.period)}, unemployment rate ${now.unemployment_rate_pct.toFixed(1)} percent`,
    );
    slider.addEventListener("input", () => updateSelection(Number(slider.value)));
    output.htmlFor = slider.id;
    output.setAttribute("aria-live", "polite");
    output.textContent = `${qLabel(now.period)} · ${now.unemployment_rate_pct.toFixed(1)}% · ${millions(now.unemployed_thousands)} people${
      participationNow ? ` · participation ${participationNow.participation_rate_15_to_64_pct.toFixed(1)}%` : ""
    }`;
    observation.append(slider, output);
    controls.append(periodField, observation);
  }

  function renderScorecards(index) {
    const now = headline[index],
      previous = headline[index - 1],
      slackNow = slack[index],
      participationNow = participation[index];
    scorecards.replaceChildren();
    const cards = [
      [
        "Unemployment rate",
        `${now.unemployment_rate_pct.toFixed(1)}%`,
        previous
          ? `${signed(now.unemployment_rate_pct - previous.unemployment_rate_pct)} pt on the quarter · ${qLabel(now.period)}`
          : `${qLabel(now.period)}`,
      ],
      participationNow && [
        "Participation, 15–64",
        `${participationNow.participation_rate_15_to_64_pct.toFixed(1)}%`,
        `men ${participationNow.participation_rate_men_15_to_64_pct.toFixed(1)}% · women ${participationNow.participation_rate_women_15_to_64_pct.toFixed(1)}% · ${qLabel(now.period)}`,
      ],
      slackNow && [
        "Halo around unemployment",
        millions(slackNow.halo_15_to_64_thousands),
        `${slackNow.halo_share_of_population_15_to_64_pct.toFixed(1)}% of the 15–64 population · ${qLabel(now.period)}`,
      ],
      slackNow && [
        "Underemployment",
        `${slackNow.underemployment_rate_pct.toFixed(1)}%`,
        `${millions(slackNow.underemployed_thousands, { long: true })} people · ${qLabel(now.period)}`,
      ],
    ].filter(Boolean);
    for (const [label, value, note] of cards) {
      const card = el("article");
      card.append(el("span", label), el("strong", value), el("small", note));
      scorecards.append(card);
    }
  }

  function section(id, heading, intro) {
    const node = el("section"),
      title = el("h2", heading);
    title.id = id;
    node.className = "report-section";
    node.setAttribute("aria-labelledby", id);
    node.append(title);
    if (intro) {
      const paragraph = el("p", intro);
      paragraph.className = "section-intro";
      node.append(paragraph);
    }
    return node;
  }

  function territorialRows() {
    // The localised series trails the national one, so the map answers for the
    // selected quarter when that quarter is published and for the latest
    // published quarter otherwise. Which one it used is stated beside it.
    const departements = localised.filter((row) => row.territory_kind === "departement"),
      published = [...new Set(departements.map((row) => iso(row.period)))].sort(),
      target = published.includes(selQ) ? selQ : published.at(-1),
      atTarget = new Map(
        departements
          .filter((row) => iso(row.period) === target)
          .map((row) => [row.territory_code, row]),
      ),
      reference = localised.find(
        (row) => row.territory_kind === "country" && row.territory_code === "FM" && iso(row.period) === target,
      );
    return {
      target,
      reference,
      trailing: target !== selQ,
      rows: geometry.map((shape) => {
        const rate = atTarget.get(shape.departement_code);
        return {
          ...shape,
          period: rate ? iso(rate.period) : null,
          unemployment_rate_pct: rate ? Number(rate.unemployment_rate_pct) : null,
        };
      }),
    };
  }

  const TERRITORY_COLUMNS = [
    { key: "departement_name", label: "Département", sortKey: "departement_name" },
    { key: "departement_code", label: "Code", sortKey: "departement_code" },
    {
      key: "unemployment_rate_pct",
      label: "Rate (%)",
      numeric: true,
      sortKey: "unemployment_rate_pct",
      format: (value) => (value === null ? "not published" : value.toFixed(1)),
    },
    {
      key: "unemployment_rate_pct",
      label: "Class",
      format: (value) =>
        value === null
          ? "not published"
          : `${classOf(value, MAP_CLASS_BREAKS) + 1} of ${MAP_CLASS_COLOURS.length}`,
    },
  ];
  const rankedTerritoryTable = (territory) =>
    dataTable(
      `Localised unemployment rate by département, ${qLabel(territory.target)}`,
      TERRITORY_COLUMNS,
      [...territory.rows].sort((a, b) => {
        if (a.unemployment_rate_pct === null) return 1;
        if (b.unemployment_rate_pct === null) return -1;
        return b.unemployment_rate_pct - a.unemployment_rate_pct;
      }),
      { sortable: true },
    );

  function comparatorCatalogue() {
    const entries = new Map();
    for (const row of comparison) {
      entries.set(row.reference_area_code, {
        code: row.reference_area_code,
        name: row.reference_area_name,
        kind: row.reference_area_kind,
      });
    }
    const unavailable = new Map();
    for (const row of comparisonParticipation) {
      if (entries.has(row.reference_area_code)) continue;
      unavailable.set(row.reference_area_code, {
        code: row.reference_area_code,
        name: row.reference_area_name,
        kind: row.reference_area_kind,
      });
    }
    return { available: [...entries.values()], unavailable: [...unavailable.values()] };
  }

  function renderReady(openDisclosures) {
    if (!headline.length) return;
    for (const dispose of cleanups) dispose();
    cleanups = [];
    const index = selectIndex(),
      now = headline[index],
      width = content.getBoundingClientRect().width || 900;
    // Everything downstream names the selected quarter, so settle the implicit
    // "latest" into a real period before anything reads it.
    selQ = iso(now.period);
    renderScorecards(index);
    renderControls(index);
    content.dataset.state = "ready";
    content.setAttribute("aria-busy", "false");
    content.replaceChildren();

    const track = (figure) => {
      if (figure._cleanup) cleanups.push(figure._cleanup);
      return figure;
    };

    // 1 — headline
    const headlineSection = section("how-many-people-are-out-of-work", "How many people are out of work");
    headlineSection.append(
      track(
        figureCard({
          key: "headline-trend-pair",
          title: "ILO unemployment rate",
          initialWidth: width,
          forceError: scenario,
          draw: (w) =>
            renderHeadlineTrendPair(
              headline,
              { width: w, selectedIndex: index, representedPeriod: qLabel(now.period) },
              { summary: INSEE_PROVENANCE },
            ),
          onSelect: updateSelection,
          disclosureNode: disclosure(
            "Provenance, query and data table",
            INSEE_PROVENANCE,
            HEADLINE_TREND_SQL,
            dataTable(
              "ILO unemployment rate and unemployed people, by quarter",
              [
                { key: "period", label: "Quarter", format: (value) => qLabel(value) },
                { key: "unemployment_rate_pct", label: "Rate (%)", numeric: true, format: (v) => v.toFixed(1) },
                {
                  key: "unemployed_thousands",
                  label: "Unemployed (millions)",
                  numeric: true,
                  format: (v) => millionsValue(v),
                },
              ],
              headline,
            ),
          ),
        }),
      ),
    );
    content.append(headlineSection);

    // 2 — slack
    const slackSection = section(
      "unemployment-halo-and-underemployment",
      "Unemployment, halo and underemployment",
    );
    slackSection.append(
      track(
        figureCard({
          key: "slack-multiples",
          title: "Measures of labour-market slack",
          initialWidth: width,
          forceError: scenario,
          draw: (w) =>
            renderSlackMultiples(
              slack,
              { width: w, selectedIndex: index },
              { summary: INSEE_PROVENANCE },
            ),
          onSelect: updateSelection,
          disclosureNode: disclosure(
            "Provenance, query and data table",
            INSEE_PROVENANCE,
            LABOUR_SLACK_SQL,
            dataTable(
              "Unemployment, long-term unemployment, the halo and underemployment, by quarter",
              [
                { key: "period", label: "Quarter", format: (value) => qLabel(value) },
                { key: "unemployed_thousands", label: "Unemployed (M)", numeric: true, format: (v) => millionsValue(v) },
                { key: "unemployment_rate_pct", label: "Rate, % of labour force", numeric: true, format: (v) => v.toFixed(1) },
                { key: "long_term_unemployed_thousands", label: "Long-term (M)", numeric: true, format: (v) => millionsValue(v) },
                { key: "long_term_unemployment_rate_pct", label: "Long-term, % of labour force", numeric: true, format: (v) => v.toFixed(1) },
                { key: "halo_15_to_64_thousands", label: "Halo, 15–64 (M)", numeric: true, format: (v) => millionsValue(v) },
                { key: "halo_share_of_population_15_to_64_pct", label: "Halo, % of population 15–64", numeric: true, format: (v) => v.toFixed(1) },
                { key: "underemployed_thousands", label: "Underemployed (M)", numeric: true, format: (v) => millionsValue(v) },
                { key: "underemployment_rate_pct", label: "Underemployment, % of employment", numeric: true, format: (v) => v.toFixed(1) },
              ],
              slack,
            ),
          ),
        }),
      ),
    );
    const definitions = el("details");
    definitions.dataset.disclosure = "definitions";
    const definitionList = el("dl");
    for (const [term, body] of [
      [
        "ILO unemployment",
        "Without a job, available to start within two weeks, and having actively looked for work in the past four weeks. Long-term unemployment is the subset who have been looking for a year or more.",
      ],
      [
        "Halo around unemployment",
        "People who want a job but do not meet both ILO conditions — available but not actively searching, or searching but not immediately available. They are outside the labour force, which is why the published halo rate is a share of the population rather than of the labour force.",
      ],
      [
        "Underemployment",
        "People in work who want more hours: part-timers available to work more, plus those who involuntarily worked less than usual. The published rate is a share of employment.",
      ],
    ]) {
      definitionList.append(el("dt", term), el("dd", body));
    }
    definitions.append(el("summary", "Definitions"), definitionList);
    slackSection.append(definitions);
    content.append(slackSection);

    // 3 — age
    const ageSection = section("who-is-out-of-work", "Who is out of work");
    ageSection.append(
      track(
        figureCard({
          key: "age-band-lines",
          title: "Unemployment rate by age band",
          initialWidth: width,
          forceError: scenario,
          draw: (w) =>
            renderAgeBandLines(ages, { width: w, selectedIndex: index }, { summary: INSEE_PROVENANCE }),
          onSelect: updateSelection,
          disclosureNode: disclosure(
            "Provenance, query and data table",
            INSEE_PROVENANCE,
            AGE_BANDS_SQL,
            dataTable(
              "Unemployment rate and unemployed people by age band, by quarter",
              [
                { key: "period", label: "Quarter", format: (value) => qLabel(value) },
                ...AGE_BANDS.flatMap((band) => [
                  {
                    key: `unemployment_rate_${band.key}_pct`,
                    label: `${band.label} (%)`,
                    numeric: true,
                    format: (v) => v.toFixed(1),
                  },
                  {
                    key: `unemployed_${band.key}_thousands`,
                    label: `${band.label} (M)`,
                    numeric: true,
                    format: (v) => millionsValue(v),
                  },
                ]),
              ],
              ages,
            ),
          ),
        }),
      ),
    );
    content.append(ageSection);

    // 4 — participation
    const participationSection = section(
      "who-takes-part-at-all",
      "Who takes part at all",
      "The activity rate counts everyone working or looking for work. The 15-to-64 basis carries a published split by sex; the 15-or-over basis is the one the OECD comparison below uses.",
    );
    const basisField = el("fieldset"),
      basisLegend = el("legend", "Basis"),
      basisRow = el("div");
    basisField.className = "period-field";
    basisRow.className = "segments";
    basisRow.setAttribute("role", "radiogroup");
    basisRow.setAttribute("aria-label", "Participation basis");
    for (const [key, label] of [
      ["15-64", "Aged 15 to 64, by sex"],
      ["all-ages", "Aged 15 or over, both sexes"],
    ]) {
      const item = el("label"),
        input = el("input");
      input.type = "radio";
      input.name = "participation-basis";
      input.value = key;
      input.dataset.control = `basis-${key}`;
      input.checked = basis === key;
      input.addEventListener("change", () => {
        basis = key;
        renderReady();
      });
      item.append(input, el("span", label));
      basisRow.append(item);
    }
    basisField.append(basisLegend, basisRow);
    participationSection.append(
      track(
        figureCard({
          key: "participation-gap-band",
          title:
            basis === "all-ages"
              ? "Labour force participation, both sexes aged 15 or over"
              : "Labour force participation, men and women aged 15 to 64",
          control: basisField,
          initialWidth: width,
          forceError: scenario,
          draw: (w) =>
            renderParticipationGapBand(
              participation,
              { width: w, selectedIndex: index, basis },
              { summary: INSEE_PROVENANCE },
            ),
          onSelect: updateSelection,
          disclosureNode: disclosure(
            "Provenance, query and data table",
            INSEE_PROVENANCE,
            PARTICIPATION_RATES_SQL,
            dataTable(
              "Labour force participation rate, by quarter",
              [
                { key: "period", label: "Quarter", format: (value) => qLabel(value) },
                { key: "participation_rate_men_15_to_64_pct", label: "Men 15–64 (%)", numeric: true, format: (v) => v.toFixed(1) },
                { key: "participation_rate_women_15_to_64_pct", label: "Women 15–64 (%)", numeric: true, format: (v) => v.toFixed(1) },
                { key: "participation_rate_15_to_64_pct", label: "Both sexes 15–64 (%)", numeric: true, format: (v) => v.toFixed(1) },
                { key: "participation_rate_pct", label: "Both sexes 15+ (%)", numeric: true, format: (v) => v.toFixed(1) },
              ],
              participation,
            ),
          ),
        }),
      ),
    );
    content.append(participationSection);

    // 5 — territorial
    const territorialSection = section(
      "where-people-are-out-of-work",
      "Where people are out of work",
      "The same ILO definition as the national headline, measured for each territory.",
    );
    if (territorialFailure) {
      const box = el("div");
      box.className = "slot-error";
      box.setAttribute("role", "alert");
      box.append(
        el("strong", "This figure could not load."),
        el("p", "The query did not complete. Other sections are unaffected."),
      );
      const retry = el("button", "Try this figure again");
      retry.type = "button";
      retry.addEventListener("click", () => void load());
      box.append(retry, el("code", `query_failed · ${DEPARTEMENT_RATES_DATASET_ID}`));
      territorialSection.dataset.state = "query-error";
      territorialSection.append(box);
    } else {
      const territory = territorialRows(),
        withRate = territory.rows.filter((row) => row.unemployment_rate_pct !== null),
        selected =
          territory.rows.find((row) => row.departement_code === selectedDepartement) ||
          withRate.slice().sort((a, b) => b.unemployment_rate_pct - a.unemployment_rate_pct)[0];
      territorialSection.append(
        track(
          figureCard({
            key: "departement-choropleth",
            title: `Localised unemployment rate by département, ${qLabel(territory.target)}`,
            subtitle:
              "Five classes on round breaks. Every département keeps a hairline border, so a shape is always legible whether or not its class is.",
            initialWidth: width,
            // Below this width a hundred shapes are unreadable, so the ranked
            // table takes the map's place. It is the same accessible
            // equivalent the wide view already carries in its disclosure:
            // promoted, not substituted.
            draw: (w) =>
              w < MAP_PROMOTES_TABLE_BELOW
                ? rankedTerritoryTable(territory)
                : renderDepartementChoropleth(
                    territory.rows,
                    {
                      width: w,
                      classBreaks: MAP_CLASS_BREAKS,
                      classColours: MAP_CLASS_COLOURS,
                      noDataColour: MAP_NO_DATA_COLOUR,
                      selectedCode: selected?.departement_code ?? null,
                      // The visual derives which shapes are too far away to
                      // draw in place; naming what the rest of them are is the
                      // report's job, because only the report knows the
                      // subject is France.
                      mainAreaLabel: "metropolitan France",
                    },
                    { summary: LOCALISED_PROVENANCE },
                  ),
            onSelectTerritory: (code) => {
              if (code === selectedDepartement) return;
              selectedDepartement = code;
              renderReady();
            },
            readout: selected
              ? readoutLine([
                  "Selected: ",
                  strong(`${selected.departement_name} (${selected.departement_code})`),
                  " · ",
                  strong(
                    selected.unemployment_rate_pct === null
                      ? "no rate published"
                      : `${selected.unemployment_rate_pct.toFixed(1)}%`,
                  ),
                  ` · ${qLabel(territory.target)} — click or focus any département to select it`,
                ])
              : null,
            disclosureNode: disclosure(
              "Provenance, query and data table",
              LOCALISED_PROVENANCE,
              DEPARTEMENT_RATES_SQL,
              rankedTerritoryTable(territory),
            ),
          }),
        ),
      );
      if (territory.reference) {
        const reference = readoutLine([
            "National reference, same quarter and same source: ",
            strong(
              `France métropolitaine ${Number(territory.reference.unemployment_rate_pct).toFixed(1)}%`,
            ),
          ". This is the reference published inside the localised series, measured for metropolitan France; the national headline above is measured for France including Mayotte and is normally a quarter ahead.",
        ]);
        reference.dataset.readout = "national-reference";
        territorialSection.append(reference);
      }
      const gaps = [
        "Mayotte has a boundary but no localised rate at any date, so it renders in the not-published class rather than as a missing island.",
      ];
      if (territory.rows.some((row) => row.departement_code.startsWith("97") && row.unemployment_rate_pct === null && row.departement_code !== "976")) {
        gaps.push(
          "The four other overseas départements have no published rate before 2014, so at this quarter they carry the same treatment.",
        );
      }
      if (territory.trailing) {
        gaps.push(
          `The localised series does not yet publish ${qLabel(selQ)}; the map shows ${qLabel(territory.target)}, its latest published quarter.`,
        );
      }
      territorialSection.append(caution(gaps.map((text) => el("span", `${text} `))));
    }
    content.append(territorialSection);

    // 6 — international
    const internationalSection = section(
      "how-france-compares",
      "How France compares",
      "Harmonised OECD rates, adjusted for comparability, which can differ from the number each country announces at home.",
    );
    if (internationalFailure) {
      const box = el("div");
      box.className = "slot-error";
      box.setAttribute("role", "alert");
      box.append(
        el("strong", "This figure could not load."),
        el("p", "The query did not complete. Other sections are unaffected."),
      );
      internationalSection.dataset.state = "query-error";
      internationalSection.append(box, el("code", `query_failed · ${INTERNATIONAL_UNEMPLOYMENT_DATASET_ID}`));
    } else {
      const catalogue = comparatorCatalogue(),
        selectedCodes = comparators.filter((code) =>
          catalogue.available.some((entry) => entry.code === code),
        ),
        unavailableSelected = comparators.flatMap((code) => {
          const entry = catalogue.unavailable.find((item) => item.code === code);
          return entry ? [entry] : [];
        }),
        colours = colourFor(selectedCodes),
        shown = comparison
          .filter((row) => selectedCodes.includes(row.reference_area_code))
          .map((row) => ({ ...row })),
        monthlyPeriods = [...new Set(shown.map((row) => iso(row.period)))].sort(),
        monthlyPosition = positionIn(monthlyPeriods, selQ, { monthly: true });
      internationalSection.append(
        track(
          figureCard({
            key: "international-lines",
            title: "Unemployment rate, OECD harmonised, monthly",
            subtitle:
              "France is fixed in the chart and cannot be removed; every other area keeps its colour for as long as it is selected. Each line runs to its own latest published month, so an area that publishes nothing at the selected month shows the month it stops at instead of a value.",
            control: comparatorPicker(catalogue, selectedCodes, colours),
            initialWidth: width,
            draw: (w) =>
              renderInternationalLines(
                shown,
                {
                  width: w,
                  selectedIndex: monthlyPosition,
                  seriesColours: colours,
                  emphasisCode: EMPHASIS_CODE,
                  unavailable: unavailableSelected,
                },
                { summary: OECD_UNEMPLOYMENT_PROVENANCE },
              ),
            onSelect: (index) => selectPeriod(monthlyPeriods[index] ?? monthlyPeriods.at(-1)),
            disclosureNode: disclosure(
              "Provenance, query and data table",
              OECD_UNEMPLOYMENT_PROVENANCE,
              INTERNATIONAL_UNEMPLOYMENT_SQL,
              dataTable(
                `Selected comparators, ${monthlyPeriods.length ? mLabel(monthlyPeriods[monthlyPosition]) : "no published month"} where published, otherwise their own latest`,
                [
                  { key: "reference_area_name", label: "Area" },
                  { key: "reference_area_code", label: "Code" },
                  { key: "unemployment_rate_pct", label: "Rate (%)", numeric: true, format: (v) => Number(v).toFixed(1) },
                  { key: "period", label: "Latest month", format: (value) => mLabel(value) },
                  { key: "reference_area_kind", label: "Kind" },
                ],
                selectedCodes
                  .map((code) => {
                    const series = shown.filter((row) => row.reference_area_code === code);
                    return (
                      series.find(
                        (row) => iso(row.period) === monthlyPeriods[monthlyPosition],
                      ) ?? series.at(-1)
                    );
                  })
                  .filter(Boolean),
              ),
            ),
          }),
        ),
      );

      const participationShown = comparisonParticipation.filter(
        (row) => comparators.includes(row.reference_area_code) && row.sex === "all",
      );
      if (participationShown.length) {
        const participationColours = colourFor([
            ...new Set(participationShown.map((row) => row.reference_area_code)),
          ]),
          participationPeriods = [
            ...new Set(participationShown.map((row) => iso(row.period))),
          ].sort(),
          participationPosition = positionIn(participationPeriods, selQ);
        internationalSection.append(
          track(
            figureCard({
              key: "international-participation",
              title: "Participation rate, OECD harmonised, aged 15 or over",
              initialWidth: width,
              draw: (w) =>
                renderComparatorLines(
                  participationShown.map((row) => ({
                    period: iso(row.period),
                    code: row.reference_area_code,
                    name: row.reference_area_name,
                    kind: row.reference_area_kind,
                    value: Number(row.participation_rate_pct),
                  })),
                  {
                    width: w,
                    selectedIndex: participationPosition,
                    grain: "quarterly",
                    measureLabel: "Labour force participation rate, aged 15 or over, both sexes, quarterly",
                    seriesColours: participationColours,
                    emphasisCode: EMPHASIS_CODE,
                    unavailable: [],
                  },
                  { summary: OECD_PARTICIPATION_PROVENANCE },
                ),
              onSelect: (index) =>
                selectPeriod(participationPeriods[index] ?? participationPeriods.at(-1)),
              disclosureNode: disclosure(
                "Provenance, query and data table",
                OECD_PARTICIPATION_PROVENANCE,
                INTERNATIONAL_PARTICIPATION_SQL,
                participationBySex(),
              ),
            }),
          ),
        );
      }
    }
    content.append(internationalSection);

    const sources = el("footer", undefined);
    sources.className = "method-source";
    sources.textContent =
      "Sources: INSEE (enquête Emploi; taux de chômage localisés) under Licence Ouverte / Open Licence 2.0 · IGN ADMIN EXPRESS COG CARTO under Licence Ouverte / Open Licence 2.0 · OECD (Monthly unemployment rates; Labour force participation rate) under CC BY 4.0.";
    content.append(sources);

    if (openDisclosures?.length) {
      for (const item of content.querySelectorAll("details")) {
        const key = item.closest("figure,section")?.dataset.figure || item.dataset.disclosure || "";
        if (openDisclosures.includes(key)) item.open = true;
      }
    }
    performance.mark("pulse:first-readable-visual");
  }

  function comparatorPicker(catalogue, selectedCodes, colours) {
    const field = el("fieldset"),
      legend = el("legend", `Comparators — ${selectedCodes.length} of ${SERIES_CAP}`),
      chips = el("div");
    field.className = "comparator-field";
    chips.className = "comparator-chips";
    for (const code of selectedCodes) {
      const entry = catalogue.available.find((item) => item.code === code),
        chip = el("span"),
        swatch = el("i");
      chip.className = "comparator-chip";
      swatch.style.background = colours[code];
      chip.append(swatch, el("span", entry?.name ?? code));
      if (code !== EMPHASIS_CODE) {
        const remove = el("button", "×");
        remove.type = "button";
        remove.dataset.control = `comparator-remove-${code}`;
        remove.setAttribute("aria-label", `Remove ${entry?.name ?? code}`);
        remove.addEventListener("click", () => {
          comparators = comparators.filter((item) => item !== code);
          renderReady();
        });
        chip.append(remove);
      }
      chips.append(chip);
    }
    const add = el("label");
    add.className = "comparator-add";
    add.append(el("span", "Add an OECD member or aggregate"));
    const select = el("select");
    select.dataset.control = "comparator-add";
    select.setAttribute("aria-label", "Add an OECD member or aggregate");
    const placeholder = el("option", "Choose an area…");
    placeholder.value = "";
    select.append(placeholder);
    const options = [...catalogue.available, ...catalogue.unavailable].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of options) {
      if (comparators.includes(entry.code)) continue;
      const option = el(
        "option",
        catalogue.unavailable.some((item) => item.code === entry.code)
          ? `${entry.name} — not published monthly`
          : entry.name,
      );
      option.value = entry.code;
      select.append(option);
    }
    select.disabled = selectedCodes.length >= SERIES_CAP;
    select.addEventListener("change", () => {
      if (!select.value) return;
      comparators = [...comparators, select.value];
      renderReady();
    });
    add.append(select);
    field.append(legend, chips, add);
    if (selectedCodes.length >= SERIES_CAP) {
      const cap = el("p");
      cap.className = "tiny";
      cap.textContent =
        "Eight series is the limit. Past eight the palette has no ninth colour a colour-blind reader can separate, so a ninth is refused rather than served with a colour that lies. Remove one to add another.";
      field.append(cap);
    }
    return field;
  }

  function participationBySex() {
    const latest = new Map();
    for (const row of comparisonParticipation) {
      if (!comparators.includes(row.reference_area_code)) continue;
      const key = `${row.reference_area_code}|${row.sex}`,
        current = latest.get(key);
      if (!current || iso(row.period) > iso(current.period)) latest.set(key, row);
    }
    const codes = [...new Set([...latest.values()].map((row) => row.reference_area_code))],
      rows = codes.flatMap((code) => {
        const all = latest.get(`${code}|all`),
          men = latest.get(`${code}|men`),
          women = latest.get(`${code}|women`);
        if (!all || !men || !women) return [];
        return [
          {
            name: all.reference_area_name,
            code,
            period: iso(all.period),
            all: Number(all.participation_rate_pct),
            men: Number(men.participation_rate_pct),
            women: Number(women.participation_rate_pct),
            gap: Number(men.participation_rate_pct) - Number(women.participation_rate_pct),
          },
        ];
      });
    return dataTable(
        "Participation rate by sex, each area at its own latest published quarter",
        [
          { key: "name", label: "Area" },
          { key: "code", label: "Code" },
          { key: "all", label: "All (%)", numeric: true, format: (v) => v.toFixed(1) },
          { key: "men", label: "Men (%)", numeric: true, format: (v) => v.toFixed(1) },
          { key: "women", label: "Women (%)", numeric: true, format: (v) => v.toFixed(1) },
          { key: "gap", label: "Gap (pt)", numeric: true, format: (v) => v.toFixed(1) },
          { key: "period", label: "Quarter", format: (value) => qLabel(value) },
        ],
        rows,
      );
  }

  async function load() {
    const id = ++request;
    const previousView = captureView();
    content.style.minHeight = `${content.getBoundingClientRect().height}px`;
    state("loading", `Loading observations from ${startQ ? qLabel(startQ) : "the default ten-year window"}…`);
    try {
      const national = await active.getDataset(NATIONAL_DATASET_ID);
      minQ = iso(national.representedPeriod.start);
      maxQ = iso(national.representedPeriod.end);
      if (!startQ) {
        startQ = shiftQuarters(maxQ, -39);
        endQ = maxQ;
      }
      if (startQ < minQ) startQ = minQ;
      if (endQ > maxQ) endQ = maxQ;
      const window = [startQ, endQ];
      const [headlineRows, slackRows, ageRows, participationRows] = await Promise.all([
        active.query(NATIONAL_DATASET_ID, HEADLINE_TREND_SQL, checkedQuery(window, HEADLINE_TREND_COLUMNS, { requireRows: false })),
        active.query(NATIONAL_DATASET_ID, LABOUR_SLACK_SQL, checkedQuery(window, LABOUR_SLACK_COLUMNS)),
        active.query(NATIONAL_DATASET_ID, AGE_BANDS_SQL, checkedQuery(window, AGE_BANDS_COLUMNS)),
        active.query(NATIONAL_DATASET_ID, PARTICIPATION_RATES_SQL, checkedQuery(window, PARTICIPATION_RATES_COLUMNS)),
      ]);
      if (id !== request) return;
      headline = headlineRows;
      slack = slackRows;
      ages = ageRows;
      participation = participationRows;
      if (!headline.length) {
        state(
          "empty",
          "No observations in this window. The national series runs from 2003. Widen the period, or return after the next INSEE release.",
          (() => {
            const reset = el("button", "Show the last ten years");
            reset.type = "button";
            reset.addEventListener("click", () => {
              preset = "ten-years";
              startQ = shiftQuarters(maxQ, -39);
              endQ = maxQ;
              void load();
            });
            return reset;
          })(),
        );
        return;
      }
      // The territorial and international families load independently: either
      // may fail without taking the national sections with it.
      const [territorial, international] = await Promise.allSettled([
        Promise.all([
          active.query(DEPARTEMENT_GEOMETRY_DATASET_ID, DEPARTEMENT_GEOMETRY_SQL, checkedQuery([], DEPARTEMENT_GEOMETRY_COLUMNS, {
            requireRows: true,
            strings: ["departement_code", "departement_name", "region_code", "geometry_geojson"],
          })),
          active.query(DEPARTEMENT_RATES_DATASET_ID, DEPARTEMENT_RATES_SQL, checkedQuery(window, DEPARTEMENT_RATES_COLUMNS, {
            strings: ["period", "territory_kind", "territory_code", "territory_name"],
            nullable: ["unemployment_rate_pct"],
          })),
        ]),
        (async () => {
          // The reader's window is expressed in quarters of the national
          // series, but the OECD families publish on their own calendars: the
          // monthly one runs months past the last national quarter. Cutting
          // them back to it would hide published months for no reason, so when
          // the window is open to the end each family reaches its own edge.
          const [monthly, quarterly] = await Promise.all([
            active.getDataset(INTERNATIONAL_UNEMPLOYMENT_DATASET_ID),
            active.getDataset(INTERNATIONAL_PARTICIPATION_DATASET_ID),
          ]);
          const atEdge = endQ === maxQ,
            monthlyEnd = atEdge ? iso(monthly.representedPeriod.end) : shiftMonths(endQ, 2),
            quarterlyEnd = atEdge ? iso(quarterly.representedPeriod.end) : endQ;
          return Promise.all([
            active.query(INTERNATIONAL_UNEMPLOYMENT_DATASET_ID, INTERNATIONAL_UNEMPLOYMENT_SQL, checkedQuery([startQ, monthlyEnd], INTERNATIONAL_UNEMPLOYMENT_COLUMNS, {
              strings: ["period", "reference_area_code", "reference_area_name", "reference_area_kind"],
            })),
            active.query(INTERNATIONAL_PARTICIPATION_DATASET_ID, INTERNATIONAL_PARTICIPATION_SQL, checkedQuery([startQ, quarterlyEnd], INTERNATIONAL_PARTICIPATION_COLUMNS, {
              strings: ["period", "reference_area_code", "reference_area_name", "reference_area_kind", "sex"],
            })),
          ]);
        })(),
      ]);
      if (id !== request) return;
      territorialFailure = territorial.status === "rejected" ? territorial.reason : null;
      internationalFailure = international.status === "rejected" ? international.reason : null;
      [geometry, localised] = territorial.status === "fulfilled" ? territorial.value : [[], []];
      [comparison, comparisonParticipation] =
        international.status === "fulfilled" ? international.value : [[], []];
      const territorialLatest = localised.length
          ? [...localised].map((row) => iso(row.period)).sort().at(-1)
          : null,
        internationalLatest = comparison.length
          ? [...comparison].map((row) => iso(row.period)).sort().at(-1)
          : null;
      meta.replaceChildren();
      for (const [label, value] of [
        ["National data through", qLabel(iso(headline.at(-1).period))],
        ["Départements through", territorialLatest ? qLabel(territorialLatest) : "unavailable"],
        ["International through", internationalLatest ? mLabel(internationalLatest) : "unavailable"],
        ["Licences", "Licence Ouverte 2.0 · CC BY 4.0"],
      ]) {
        const item = el("div");
        item.append(el("dt", label), el("dd", value));
        meta.append(item);
      }
      applyQualification();
      renderReady(previousView.open);
      restoreView(previousView);
    } catch (error) {
      const lastSuccessful = headline.length ? qLabel(iso(headline.at(-1).period)) : maxQ ? qLabel(maxQ) : "not yet available",
        selection = selQ ? qLabel(selQ) : "latest";
      state(
        error?.code === "wasm-startup" || error?.code === "shared-engine-failure" ? "engine-error" : "query-error",
        `${error?.safeMessage || "The query for this period did not complete."} No figures are shown rather than partial ones. Last successful quarter: ${lastSuccessful}. Selection ${selection} retained. query_failed · ${NATIONAL_DATASET_ID} · window=${startQ || "default"}`,
        (() => {
          const retry = el("button", "Retry the query");
          retry.type = "button";
          retry.addEventListener("click", () => void load());
          return retry;
        })(),
      );
    }
  }
  void load();
  void loadQualification();
  return main;
}
