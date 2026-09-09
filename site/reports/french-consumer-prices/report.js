import { DataClientError } from "../../data/client.js";
import { getPageDataClient } from "../../data/browser-shell.js";
import {
  getPageStatusClient,
  qualificationLine,
  qualifyReport,
} from "../../data/status-client.js";
import { scenarioStatusClient } from "../../data/status-scenarios.js";
import { renderHeadlineTrend } from "../../visuals/headline-trend.js";
import {
  renderContributionStack,
  validateContributionStackRows,
} from "../../visuals/contribution-stack.js";
import { renderDivergenceMultiples } from "../../visuals/divergence-multiples.js";
import { renderIndexLevelPaths } from "../../visuals/index-level-paths.js";

const interFontUrl = new URL("../../../assets/fonts/InterVariable.woff2", import.meta.url);
if (!document.querySelector("style[data-pulse-inter]")) {
  const fontStyle = document.createElement("style");
  fontStyle.dataset.pulseInter = "";
  fontStyle.textContent = `@font-face{font-family:Inter;src:url("${interFontUrl}") format("woff2");font-style:normal;font-weight:100 900;font-display:swap}`;
  document.head.append(fontStyle);
}

export const REPORT_ID = "french-consumer-prices";
export const MONTHLY_DATASET_ID = "insee-cpi-monthly",
  CATEGORY_DATASET_ID = "insee-cpi-category-analysis";
export const MONTHLY_SQL =
  "SELECT CAST(period AS VARCHAR) period, CAST(cpi_index AS DOUBLE) cpi_index, CAST(monthly_change_pct AS DOUBLE) monthly_change_pct, CAST(annual_change_pct AS DOUBLE) annual_change_pct FROM insee_cpi_monthly WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period";
export const CATEGORY_SQL = `WITH measured AS (SELECT *,
  (services_index / lag(services_index) OVER (ORDER BY period) - 1) * 100 services_monthly_change_pct,
  (manufactured_products_index / lag(manufactured_products_index) OVER (ORDER BY period) - 1) * 100 manufactured_products_monthly_change_pct,
  (food_index / lag(food_index) OVER (ORDER BY period) - 1) * 100 food_monthly_change_pct,
  (actual_rent_index / lag(actual_rent_index) OVER (ORDER BY period) - 1) * 100 actual_rent_monthly_change_pct
  FROM insee_cpi_category_analysis)
SELECT CAST(period AS VARCHAR) period,
  CAST(food_index AS DOUBLE) food_index,
  CAST(food_annual_change_pct AS DOUBLE) food_annual_change_pct,
  CAST(food_monthly_change_pct AS DOUBLE) food_monthly_change_pct,
  CAST(services_index AS DOUBLE) services_index,
  CAST(services_annual_change_pct AS DOUBLE) services_annual_change_pct,
  CAST(services_monthly_change_pct AS DOUBLE) services_monthly_change_pct,
  CAST(manufactured_products_index AS DOUBLE) manufactured_products_index,
  CAST(manufactured_products_annual_change_pct AS DOUBLE) manufactured_products_annual_change_pct,
  CAST(manufactured_products_monthly_change_pct AS DOUBLE) manufactured_products_monthly_change_pct,
  CAST(energy_index AS DOUBLE) energy_index,
  CAST(energy_annual_change_pct AS DOUBLE) energy_annual_change_pct,
  CAST(actual_rent_index AS DOUBLE) actual_rent_index,
  CAST(actual_rent_annual_change_pct AS DOUBLE) actual_rent_annual_change_pct,
  CAST(actual_rent_monthly_change_pct AS DOUBLE) actual_rent_monthly_change_pct,
  CAST(food_official_contribution_pct_points AS DOUBLE) food_official_contribution_pct_points,
  CAST(services_official_contribution_pct_points AS DOUBLE) services_official_contribution_pct_points,
  CAST(manufactured_products_official_contribution_pct_points AS DOUBLE) manufactured_products_official_contribution_pct_points,
  CAST(energy_official_contribution_pct_points AS DOUBLE) energy_official_contribution_pct_points,
  CAST(actual_rent_pulse_contribution_pct_points AS DOUBLE) actual_rent_pulse_contribution_pct_points,
  CAST(food_weight AS DOUBLE) food_weight, food_weight_reference_year,
  CAST(services_weight AS DOUBLE) services_weight, services_weight_reference_year,
  CAST(manufactured_products_weight AS DOUBLE) manufactured_products_weight, manufactured_products_weight_reference_year,
  CAST(energy_weight AS DOUBLE) energy_weight, energy_weight_reference_year,
  CAST(actual_rent_weight AS DOUBLE) actual_rent_weight, actual_rent_weight_reference_year
FROM measured WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period`;
const CATS = ["food", "services", "manufactured", "energy", "rent"],
  LABELS = {
    food: "Food",
    services: "Services",
    manufactured: "Manufactured products",
    energy: "Energy",
    rent: "Rents paid",
    headline: "Headline",
  },
  COLORS = {
    headline: "#9184d9",
    food: "#8fb0d1",
    services: "#b5abfc",
    manufactured: "#9397ab",
    energy: "#d09a6a",
    rent: "#9dc0ae",
  };
const PERIOD_SQL = { monthly: MONTHLY_SQL, category: CATEGORY_SQL };
const el = (name, text) => {
  const item = document.createElement(name);
  if (text !== undefined) item.textContent = text;
  return item;
};
const isoMonth = (value) => String(value).slice(0, 7),
  shift = (period, months) => {
    const [y, m] = period.split("-").map(Number),
      d = new Date(Date.UTC(y, m - 1 + months, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
const signed = (v, d = 1) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;

function scenarioClient(client, scenario) {
  if (!scenario) return client;
  const ds = {
    representedPeriod: { start: "1998-01-01", end: "2026-07-01" },
    semanticMetadata: { indicators: [] },
  };
  if (scenario === "loading")
    return { getDataset: async () => ds, query: () => new Promise(() => {}) };
  if (scenario === "empty")
    return { getDataset: async () => ds, query: async () => [] };
  if (scenario === "query")
    return {
      getDataset: async () => ds,
      query: async () => {
        throw new DataClientError(
          "query",
          "The report data could not be queried.",
        );
      },
    };
  if (scenario === "query-after-ready") {
    let calls = 0;
    return {
      getDataset: (id) => client.getDataset(id),
      query: (...args) => {
        calls += 1;
        if (calls > 3)
          throw new DataClientError(
            "query",
            "The report data could not be queried.",
          );
        return client.query(...args);
      },
    };
  }
  return client;
}

function monthSelect(label, period, min, max, onchange) {
  const wrap = el("label");
  wrap.className = "month-picker";
  wrap.append(el("span", label));
  const month = el("select"),
    year = el("select");
  month.setAttribute("aria-label", `${label} month`);
  year.setAttribute("aria-label", `${label} year`);
  month.dataset.control = `${label}-month`;
  year.dataset.control = `${label}-year`;
  for (let i = 1; i <= 12; i++) {
    const o = el(
      "option",
      new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
        new Date(Date.UTC(2020, i - 1, 1)),
      ),
    );
    o.value = String(i).padStart(2, "0");
    month.append(o);
  }
  for (let y = Number(min.slice(0, 4)); y <= Number(max.slice(0, 4)); y++) {
    const o = el("option", String(y));
    o.value = String(y);
    year.append(o);
  }
  month.value = period.slice(5);
  year.value = period.slice(0, 4);
  const changed = () => onchange(`${year.value}-${month.value}`);
  month.addEventListener("change", changed);
  year.addEventListener("change", changed);
  wrap.append(month, year);
  return wrap;
}

function tableDetails(title, provenance, sql, rows, columns) {
  const details = el("details"),
    summary = el("summary", "Provenance, query and data table"),
    p = el("p", provenance),
    code = el("code", sql),
    scroll = el("div"),
    table = el("table"),
    caption = el("caption", title),
    head = el("thead"),
    tr = el("tr");
  scroll.className = "table-scroll";
  table.className = "accessible-data";
  for (const c of columns) {
    const th = el("th", c.label);
    th.scope = "col";
    tr.append(th);
  }
  head.append(tr);
  const body = el("tbody");
  for (const row of rows) {
    const line = el("tr");
    columns.forEach((c, i) => {
      const cell = el(
        i ? "td" : "th",
        c.format ? c.format(row[c.key]) : String(row[c.key] ?? ""),
      );
      if (!i) cell.scope = "row";
      line.append(cell);
    });
    body.append(line);
  }
  table.append(caption, head, body);
  scroll.append(table);
  details.append(summary, p, code, scroll);
  return details;
}

function measured(wrapper, draw, initialWidth) {
  let width = 0,
    node = null,
    observer = null,
    timer = null;
  const commit = (candidate) => {
    const measuredWidth =
        typeof candidate === "number"
          ? candidate
          : wrapper.getBoundingClientRect().width,
      next = Math.round(measuredWidth);
    if (next > 0 && next !== width) {
      width = next;
      draw(next);
    }
  };
  const observe = () => {
    if (node !== wrapper) {
      observer?.disconnect();
      node = wrapper;
      observer = new ResizeObserver(() => commit());
      observer.observe(wrapper);
    }
    commit(initialWidth);
    requestAnimationFrame(() => commit());
  };
  observe();
  timer = setInterval(() => commit(), 500);
  return () => {
    observer?.disconnect();
    clearInterval(timer);
  };
}

function figureCard(
  number,
  title,
  subtitle,
  rows,
  columns,
  sql,
  provenance,
  draw,
  onSelect,
  forceError,
  control,
  initialWidth,
) {
  const figure = el("figure"),
    caption = el("figcaption"),
    heading = el("h3", title),
    description = el("p", subtitle),
    wrapper = el("div");
  heading.id = `figure-${number}-heading`;
  figure.setAttribute("aria-labelledby", heading.id);
  wrapper.className = "chart-wrapper";
  caption.append(heading, description);
  figure.dataset.figure = String(number);
  figure.dataset.state = "ready";
  figure.append(caption);
  if (control) figure.append(control);
  figure.append(wrapper);
  let cleanup = () => {};
  const fail = (kind, error) => {
    figure.dataset.state = kind;
    const message = el("div");
    message.className = "slot-error";
    message.setAttribute("role", "alert");
    if (kind === "render-error")
      message.innerHTML =
        "<strong>This figure failed while drawing. Its numbers are below.</strong><p>The data arrived and validated; rendering threw. The report keeps the accessible table so the answer is still available, and other figures are untouched.</p><code>RenderError · divergence-multiples@1.0.0 · caught at the figure boundary</code>";
    else
      message.innerHTML = `<strong>This figure cannot be drawn from the result it was given.</strong><p>The visual contract requires a finite services contribution. The rest of the report is unaffected.</p><code>Visual contract failure · ${String(error.message)}</code>`;
    wrapper.replaceChildren(message);
  };
  try {
    if (forceError === "schema" && number === 2) {
      rows = rows.map((r) => ({ ...r, services_pp: undefined }));
      validateContributionStackRows(rows);
    } else {
      if (forceError === "render" && number === 3)
        throw new Error("render fixture");
      cleanup = measured(
        wrapper,
        (width) => {
          try {
            const visual = draw(width);
            visual.addEventListener("pulse-select", (event) =>
              onSelect(event.detail.index),
            );
            wrapper.replaceChildren(visual);
            figure.dataset.state = "ready";
          } catch (error) {
            fail("render-error", error);
          }
        },
        initialWidth,
      );
    }
  } catch (error) {
    fail(forceError === "schema" ? "schema-error" : "render-error", error);
  }
  figure.append(tableDetails(title, provenance, sql, rows, columns.table));
  figure._cleanup = cleanup;
  return figure;
}

export function renderFrenchConsumerPricesReport({
  client = getPageDataClient(),
  statusClient = getPageStatusClient(),
  scenario,
} = {}) {
  const main = el("main");
  main.className = "cpi-report";
  const navigation = el("nav"),
    home = el("a", "Pulse reports");
  navigation.setAttribute("aria-label", "Report navigation");
  home.href = "../../";
  navigation.append(home);
  const header = el("header"),
    kicker = el("span", "Standing report · France · monthly"),
    title = el("h1", "Consumer prices in France"),
    standfirst = el(
      "p",
      "Rebuilt each month from INSEE’s consumer price index, Base 2025.",
    ),
    meta = el("dl");
  kicker.className = "eyebrow";
  standfirst.className = "standfirst";
  header.append(kicker, title, standfirst, meta);
  const standings = el("section"),
    standingsTitle = el("h2", "Where prices stand"),
    scorecards = el("div"),
    controls = el("section"),
    content = el("section");
  standingsTitle.id = "where-prices-stand";
  standings.setAttribute("aria-labelledby", standingsTitle.id);
  scorecards.className = "scorecards";
  standings.className = "standings";
  standings.append(standingsTitle, scorecards);
  controls.className = "exploration";
  controls.setAttribute("aria-label", "Exploration controls");
  content.className = "report-content";
  main.append(navigation, header, standings, controls, content);
  const active = scenarioClient(client, scenario);
  const activeStatus = scenarioStatusClient(statusClient, scenario);
  let qualification = null;
  let monthly = [],
    history = [],
    category = [],
    minP,
    maxP,
    startP,
    endP,
    selP = null,
    preset = "five-years",
    lead = "headline",
    amount = 100,
    calcFrom,
    calcTo,
    cleanups = [],
    request = 0;
  const cats = Object.fromEntries(CATS.map((k) => [k, true]));
  // Rebuilding a measured report must be a layout transaction: keep its height
  // until the replacement is drawn, and restore controls by stable identity.
  // Otherwise removing a focused input or collapsing the charts changes the
  // browser's scroll anchor, including for updates unrelated to month selection.
  main.style.overflowAnchor = "none";
  const disclosureKey = (item) =>
    item.closest("figure")?.dataset.figure || "calculator";
  function captureView() {
    const focused = main.contains(document.activeElement)
      ? document.activeElement
      : null;
    return {
      x: window.scrollX,
      y: window.scrollY,
      open: new Set([...content.querySelectorAll("details[open]")].map(disclosureKey)),
      focus: focused?.dataset.control || focused?.id,
      numberInput: focused?.matches('input[type="number"]') ? focused : null,
    };
  }
  function restoreView(view) {
    for (const item of content.querySelectorAll("details")) {
      item.open = view.open.has(disclosureKey(item));
    }
    let focused = [...main.querySelectorAll("[data-control], [id]")]
      .find((item) => (item.dataset.control || item.id) === view.focus);
    if (focused && view.focus) {
      // Keep the actual number input: assigning .value cannot preserve an
      // in-progress decimal such as "125." or its native editing state.
      if (view.numberInput) {
        focused.replaceWith(view.numberInput);
        focused = view.numberInput;
      }
      focused.focus({ preventScroll: true });
    }
    content.style.minHeight = "";
    window.scrollTo({ left: view.x, top: view.y, behavior: "instant" });
  }
  // One qualification line in the provenance list, and nothing attached to a
  // figure: suspect, stale or failed lineage qualifies the reading, it does not
  // interrupt it, so the per-figure alert path stays reserved for render
  // failures. Staleness resolves against this clock, not the build's.
  function applyQualification() {
    for (const previous of [...meta.querySelectorAll("[data-qualification]")])
      previous.remove();
    const line = qualificationLine(qualification);
    if (!line || !meta.children.length) return;
    const item = el("div");
    item.dataset.qualification = qualification.state;
    item.append(el("dt", "Data qualification"), el("dd", line));
    meta.append(item);
  }
  async function loadQualification() {
    try {
      const [status, reports] = await Promise.all([
        activeStatus.status(),
        activeStatus.reports(),
      ]);
      qualification = qualifyReport({
        status,
        reports,
        reportId: REPORT_ID,
        now: new Date(),
      });
    } catch {
      // Provenance stays exactly as published when health cannot be read.
      qualification = null;
    }
    applyQualification();
  }
  const state = (kind, text) => {
    content.dataset.state = kind;
    content.setAttribute("aria-live", "polite");
    content.setAttribute("aria-busy", kind === "loading" ? "true" : "false");
    const message = el("p", text);
    message.className = "state-message";
    if (kind === "loading") {
      const skeletons = [300, 340, 220].map((height) => {
        const item = el("div");
        item.className = "state-skeleton";
        item.style.minHeight = `${height}px`;
        return item;
      });
      content.replaceChildren(message, ...skeletons);
    } else content.replaceChildren(message);
  };
  const selectIndex = () =>
    Math.max(
      0,
      monthly.findIndex(
        (r) =>
          isoMonth(r.period) === (selP || isoMonth(monthly.at(-1)?.period)),
      ),
    );
  const updateSelection = (i) => {
    selP = isoMonth(
      monthly[Math.min(monthly.length - 1, Math.max(0, i))]?.period,
    );
    renderReady();
  };
  function renderControls(selected, now) {
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
    for (const [key, label] of [
      ["two-years", "2 years"],
      ["five-years", "5 years"],
      ["from-start", "From start"],
    ]) {
      const lab = el("label"),
        input = el("input");
      input.type = "radio";
      input.name = "period";
      input.value = key;
      input.dataset.control = `period-${key}`;
      input.checked = preset === key;
      input.addEventListener("change", () => {
        preset = key;
        startP =
          key === "from-start"
            ? minP
            : shift(maxP, key === "two-years" ? -23 : -59);
        endP = maxP;
        void load();
      });
      lab.append(input, el("span", label));
      presets.append(lab);
    }
    const range = el("div");
    range.className = "period-range";
    range.append(
      monthSelect("Start", startP, minP, maxP, (p) => {
        startP = p;
        if (startP > endP) endP = startP;
        preset = "custom";
        void load();
      }),
      el("span", "to"),
      monthSelect("End", endP, minP, maxP, (p) => {
        endP = p;
        if (endP < startP) startP = endP;
        preset = "custom";
        void load();
      }),
    );
    periodRow.append(range);

    const observation = el("label"),
      slider = el("input"),
      output = el("output");
    observation.className = "observation-control";
    observation.append(
      el("span", "Observation month — or click any point on a figure"),
    );
    slider.id = "pulse-month";
    slider.type = "range";
    slider.min = "0";
    slider.max = String(monthly.length - 1);
    slider.step = "1";
    slider.value = String(selected);
    slider.setAttribute("aria-label", "Observation month");
    slider.setAttribute(
      "aria-valuetext",
      `${isoMonth(now.period)}, headline ${signed(now.annual_change_pct)} percent year on year`,
    );
    slider.addEventListener("input", () =>
      updateSelection(Number(slider.value)),
    );
    output.htmlFor = slider.id;
    output.setAttribute("aria-live", "polite");
    output.textContent = `${isoMonth(now.period)} · headline ${signed(now.annual_change_pct)}% y/y · ${signed(now.monthly_change_pct)}% m/m · index ${Number(now.cpi_index).toFixed(2)}`;
    observation.append(slider, output);
    controls.append(periodField, observation);

    const catField = el("fieldset"),
      catLegend = el("legend", "Components shown"),
      catRow = el("div");
    catRow.className = "component-row";
    catField.className = "component-field";
    catField.append(catLegend, catRow);
    for (const key of CATS) {
      const lab = el("label"),
        input = el("input"),
        swatch = el("span");
      input.type = "checkbox";
      input.dataset.control = `component-${key}`;
      input.checked = cats[key];
      swatch.className = "swatch";
      swatch.style.background = COLORS[key];
      input.addEventListener("change", () => {
        cats[key] = input.checked;
        renderReady();
      });
      lab.append(input, swatch, el("span", LABELS[key]));
      catRow.append(lab);
    }
    controls.append(catField);
  }
  function renderReady(openDisclosures) {
    if (!monthly.length) return;
    const view = captureView();
    if (openDisclosures) view.open = openDisclosures;
    content.style.minHeight = `${content.getBoundingClientRect().height}px`;
    buildReady();
    restoreView(view);
  }
  function buildReady() {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    content.dataset.state = "ready";
    content.removeAttribute("aria-busy");
    const selected = selectIndex(),
      now = monthly[selected],
      yearAgo = monthly.find(
        (r) => isoMonth(r.period) === shift(isoMonth(now.period), -12),
      );
    scorecards.replaceChildren();
    const largest = [
      ["Food", category[selected]?.food_official_contribution_pct_points],
      [
        "Services",
        category[selected]?.services_official_contribution_pct_points,
      ],
      [
        "Manufactured products",
        category[selected]
          ?.manufactured_products_official_contribution_pct_points,
      ],
      ["Energy", category[selected]?.energy_official_contribution_pct_points],
    ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    for (const [label, value, note] of [
      [
        "Annual change",
        `${signed(now.annual_change_pct)}%`,
        yearAgo
          ? `${isoMonth(now.period).replace(/^\d{4}-(\d{2})$/, (_, m) => new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2020, Number(m) - 1, 1))))} ${isoMonth(now.period).slice(0, 4)} · ${signed(yearAgo.annual_change_pct)}% a year earlier`
          : "Provider-published",
      ],
      [
        "Monthly change",
        `${signed(now.monthly_change_pct)}%`,
        selected
          ? `Month on ${isoMonth(monthly[selected - 1].period).replace(/^(\d{4})-(\d{2})$/, (_, y, m) => `${new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2020, Number(m) - 1, 1)))} ${y}`)}`
          : "First observation",
      ],
      [
        "Index level",
        Number(now.cpi_index).toFixed(2),
        `Base 2025 = 100 · ${signed(Number(now.cpi_index) - 100, 2)} since the base year`,
      ],
      [
        "Largest contribution",
        `${signed(largest[1])} pp`,
        `${largest[0]}, of a ${Number(now.annual_change_pct).toFixed(1)} pp annual rate`,
      ],
    ]) {
      const card = el("article");
      card.append(el("span", label), el("strong", value), el("small", note));
      scorecards.append(card);
    }
    renderControls(selected, now);
    content.replaceChildren();
    const leadRows =
      lead === "headline"
        ? monthly.map((r) => ({
            period: isoMonth(r.period),
            annual_change_pct: r.annual_change_pct,
            monthly_change_pct: r.monthly_change_pct,
          }))
        : category.map((r) => ({
            period: isoMonth(r.period),
            annual_change_pct:
              r[
                `${lead === "manufactured" ? "manufactured_products" : lead === "rent" ? "actual_rent" : lead}_annual_change_pct`
              ],
            monthly_change_pct:
              r[
                `${lead === "manufactured" ? "manufactured_products" : lead === "rent" ? "actual_rent" : lead}_monthly_change_pct`
              ],
          }));
    const leadControl = el("fieldset"),
      leadLegend = el("legend", "Series — one at a time"),
      leadRow = el("div");
    leadControl.className = "figure-series";
    leadRow.className = "segments";
    leadRow.setAttribute("role", "radiogroup");
    leadRow.setAttribute("aria-label", "Series shown in this figure");
    leadControl.append(leadLegend, leadRow);
    for (const key of [
      "headline",
      "food",
      "services",
      "manufactured",
      "rent",
    ]) {
      const lab = el("label"),
        input = el("input"),
        swatch = el("span");
      input.type = "radio";
      input.name = "lead";
      input.dataset.control = `lead-${key}`;
      input.checked = lead === key;
      swatch.className = "swatch";
      swatch.style.background = COLORS[key];
      input.addEventListener("change", () => {
        lead = key;
        renderReady();
      });
      lab.append(input, swatch, el("span", LABELS[key]));
      leadRow.append(lab);
    }
    const provenance =
      "Source: INSEE, Indice des prix à la consommation (IPC), Base 2025. Licence Ouverte / Open Licence 2.0.";
    const common = { periodCount: monthly.length },
      initialWidth = Math.max(
        320,
        Math.round(content.getBoundingClientRect().width - 33.6),
      );
    const f1 = figureCard(
      1,
      "How is inflation evolving?",
      "Annual change, month by month, with the month-over-month change beneath it.",
      leadRows,
      {
        ...common,
        table: [
          { key: "period", label: "Period" },
          {
            key: "annual_change_pct",
            label: "Annual change (%)",
            format: (v) => Number(v).toFixed(1),
          },
          {
            key: "monthly_change_pct",
            label: "Monthly change (%)",
            format: (v) => (v == null ? "—" : Number(v).toFixed(1)),
          },
        ],
      },
      lead === "headline" ? PERIOD_SQL.monthly : PERIOD_SQL.category,
      provenance,
      (w) =>
        renderHeadlineTrend(
          leadRows,
          {
            width: w,
            selectedIndex: selected,
            unit: "percent",
            label: LABELS[lead],
            color: COLORS[lead],
          },
          { summary: provenance },
        ),
      updateSelection,
      scenario,
      leadControl,
      initialWidth,
    );
    const contribution = category.map((r, i) => ({
      period: isoMonth(r.period),
      food_pp: r.food_official_contribution_pct_points,
      services_pp: r.services_official_contribution_pct_points,
      manufactured_pp: r.manufactured_products_official_contribution_pct_points,
      energy_pp: r.energy_official_contribution_pct_points,
      headline_pct: monthly[i].annual_change_pct,
      rent_pulse_pp: r.actual_rent_pulse_contribution_pct_points,
      rent_weight_per_10k: r.actual_rent_weight,
    }));
    const f2 = figureCard(
      2,
      "What is carrying the annual rate?",
      "INSEE’s four published contributions to the headline annual change, stacked, against the headline rate itself. Rents paid (COICOP 04.1) are already inside the services contribution above. The rent lane is a Pulse calculation — annual basket weight ÷ 10 000 × rent annual change.",
      contribution,
      {
        ...common,
        table: [
          { key: "period", label: "Period" },
          { key: "food_pp", label: "Food pp" },
          { key: "services_pp", label: "Services pp" },
          { key: "manufactured_pp", label: "Manufactured pp" },
          { key: "energy_pp", label: "Energy pp" },
          {
            key: "rent_pulse_pp",
            label: "Rents pp (Pulse)",
            format: (v) => Number(v).toFixed(3),
          },
        ],
      },
      PERIOD_SQL.category,
      provenance,
      (w) =>
        renderContributionStack(
          contribution,
          { width: w, selectedIndex: selected, showRentLane: cats.rent },
          { summary: provenance },
        ),
      updateSelection,
      scenario,
      null,
      initialWidth,
    );
    const enabled = CATS.filter((k) => cats[k]),
      divergence = enabled.flatMap((key) =>
        category.map((r, i) => ({
          period: isoMonth(r.period),
          category: key,
          annual_change_pct:
            r[
              `${key === "manufactured" ? "manufactured_products" : key === "rent" ? "actual_rent" : key}_annual_change_pct`
            ],
          headline_annual_change_pct: monthly[i].annual_change_pct,
          weight_per_10k:
            r[
              `${key === "manufactured" ? "manufactured_products" : key === "rent" ? "actual_rent" : key}_weight`
            ],
          weight_reference_year:
            r[
              `${key === "manufactured" ? "manufactured_products" : key === "rent" ? "actual_rent" : key}_weight_reference_year`
            ],
          is_pulse_calculation: key === "rent",
        })),
      );
    const f3 = figureCard(
      3,
      "Which components diverge from headline?",
      "Each component’s annual change against the headline rate on the same axis, one panel per component. Panels share their vertical scale so the size of a gap is comparable across them. Beneath each panel, the component’s share of the basket over the same months.",
      divergence,
      {
        ...common,
        table: [
          { key: "period", label: "Period" },
          { key: "category", label: "Component" },
          { key: "annual_change_pct", label: "Annual change (%)" },
          { key: "headline_annual_change_pct", label: "Headline (%)" },
          { key: "weight_per_10k", label: "Weight / 10,000" },
          { key: "weight_reference_year", label: "Weight year" },
        ],
      },
      PERIOD_SQL.category,
      provenance,
      (w) =>
        enabled.length
          ? renderDivergenceMultiples(
              divergence,
              { width: w, selectedIndex: selected, sharedDomain: true },
              { summary: provenance },
            )
          : el(
              "p",
              "No components selected; headline remains available in the other figures.",
            ),
      updateSelection,
      scenario,
      null,
      initialWidth,
    );
    const levels = ["headline", ...enabled].flatMap((key) =>
      (key === "headline" ? monthly : category).map((r) => ({
        period: isoMonth(r.period),
        series: key,
        index:
          key === "headline"
            ? r.cpi_index
            : r[
                `${key === "manufactured" ? "manufactured_products" : key === "rent" ? "actual_rent" : key}_index`
              ],
      })),
    );
    const f4 = figureCard(
      4,
      "What has the price level actually done?",
      "Index levels, Base 2025 = 100.",
      levels,
      {
        ...common,
        table: [
          { key: "period", label: "Period" },
          { key: "series", label: "Series" },
          { key: "index", label: "Index", format: (v) => Number(v).toFixed(2) },
        ],
      },
      PERIOD_SQL.category,
      provenance,
      (w) =>
        renderIndexLevelPaths(
          levels,
          { width: w, selectedIndex: selected, referenceValue: 100 },
          { summary: provenance },
        ),
      updateSelection,
      scenario,
      null,
      initialWidth,
    );
    content.append(f1, f2, f3, f4);
    cleanups = [f1._cleanup, f2._cleanup, f3._cleanup, f4._cleanup];
    const calc = el("section"),
      calcTitle = el("h2", "What is an amount worth in another month?"),
      calcIntro = el(
        "p",
        "The headline index carries the whole calculation: an amount is scaled by the ratio of the two months’ index levels.",
      ),
      calcControls = el("div"),
      amountLabel = el("label"),
      amountInput = el("input");
    calc.className = "calculator";
    calcControls.className = "calculator-controls";
    amountLabel.append(el("span", "Amount (€)"));
    amountInput.id = "calc-amount";
    amountInput.type = "number";
    amountInput.value = String(amount);
    amountInput.min = "0";
    amountInput.dataset.control = "calculator-amount";
    amountInput.step = "any";
    amountInput.addEventListener("input", () => {
      amount = Number(amountInput.value);
      renderReady();
    });
    amountLabel.append(amountInput);
    const fromRow = history.find((r) => isoMonth(r.period) === calcFrom) || now,
      toRow = history.find((r) => isoMonth(r.period) === calcTo) || now,
      result = (amount * Number(toRow.cpi_index)) / Number(fromRow.cpi_index),
      money = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "EUR",
      }),
      fromIndex = history.indexOf(fromRow),
      toIndex = history.indexOf(toRow),
      gap = toIndex - fromIndex,
      change = (Number(toRow.cpi_index) / Number(fromRow.cpi_index) - 1) * 100,
      annual =
        Math.abs(gap) >= 12
          ? (Math.pow(
              Number(toRow.cpi_index) / Number(fromRow.cpi_index),
              12 / Math.abs(gap),
            ) -
              1) *
            100
          : null,
      resultCard = el("article"),
      resultKicker = el("span", "Equivalent amount"),
      resultValue = el("strong", money.format(result)),
      resultNote = el(
        "small",
        `${signed(change)}% over ${Math.abs(gap)} months${annual == null ? "" : ` · ${signed(annual)}% a year`}`,
      ),
      calcSentence = el(
        "p",
        `${money.format(amount)} in ${calcFrom.replace(/^(\d{4})-(\d{2})$/, (_, y, m) => `${new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2020, Number(m) - 1, 1)))} ${y}`)} has the same purchasing power as ${money.format(result)} in ${calcTo.replace(/^(\d{4})-(\d{2})$/, (_, y, m) => `${new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2020, Number(m) - 1, 1)))} ${y}`)}, on index levels of ${Number(fromRow.cpi_index).toFixed(2)} and ${Number(toRow.cpi_index).toFixed(2)} (Base 2025 = 100).`,
      );
    const swap = el("button", "⇄ Swap");
    swap.type = "button";
    swap.dataset.control = "calculator-swap";
    swap.setAttribute("aria-label", "Swap the origin and target months");
    swap.addEventListener("click", () => {
      [calcFrom, calcTo] = [calcTo, calcFrom];
      renderReady();
    });
    resultCard.className = "calculator-result";
    resultCard.append(resultKicker, resultValue, resultNote);
    calcControls.append(
      amountLabel,
      monthSelect("In this month", calcFrom, minP, maxP, (p) => {
        calcFrom = p;
        renderReady();
      }),
      swap,
      monthSelect(
        "Expressed in this month’s euros",
        calcTo,
        minP,
        maxP,
        (p) => {
          calcTo = p;
          renderReady();
        },
      ),
      resultCard,
    );
    const details = el("details"),
      summary = el("summary", "Method and provenance");
    details.innerHTML =
      "<div><p>Amount × (headline index of the target month ÷ headline index of the origin month). Index series 011814056, Base 2025 = 100, DECIMAL(12,2), all households, France, excluding tobacco. The result is a Pulse calculation; both index levels are provider-published. INSEE publishes its own equivalent-purchasing-power converter on the same series.</p><code>SELECT period, cpi_index FROM insee_cpi_monthly ORDER BY period</code></div>";
    details.prepend(summary);
    calc.append(calcTitle, calcIntro, calcControls, calcSentence, details);
    content.append(calc);
    const method = el("section");
    method.className = "method";
    method.innerHTML =
      "<article><h3>What is provider-published</h3><p>Index levels, monthly and annual changes for headline, food, services, manufactured products and energy, the four contributions, and annual basket weights for all five components. Precision is shown exactly as published: index two decimals, percentages and contributions one decimal.</p></article><article><h3>What Pulse calculates</h3><p>The rent annual change, (index ÷ index twelve months earlier − 1) × 100; the rent contribution, weight ÷ 10 000 × that change; the month-over-month change of each component, from its index; and the equivalent-amount calculation.</p></article><article><h3>Limits to read with</h3><p>Weights are annual, so a within-year contribution moves only with prices. Rents overlap the services contribution. The five basket shares shown do not sum to 100% — the datasets do not publish the complete basket here, so the remainder is not attributable. Base-2025 rebasing means levels are not comparable with earlier-base publications.</p></article>";
    const methodHeading = el("h2", "Method, provenance and limits");
    method.prepend(methodHeading);
    const sourceNote = el("p", "Source: INSEE, Indice des prix à la consommation (IPC), Base 2025 — all households, France; headline series excludes tobacco. Series identifiers are listed in each figure’s disclosure.");
    sourceNote.className = "method-source";
    method.append(sourceNote);
    content.append(method);
    performance.mark("pulse:first-readable-visual");
  }
  async function load() {
    const id = ++request;
    const previousView = captureView();
    content.style.minHeight = `${content.getBoundingClientRect().height}px`;
    state(
      "loading",
      `Loading observations from ${startP || "the default five-year window"}…`,
    );
    try {
      const [m, c] = await Promise.all([
        active.getDataset(MONTHLY_DATASET_ID),
        active.getDataset(CATEGORY_DATASET_ID),
      ]);
      minP = isoMonth(
        [m.representedPeriod.start, c.representedPeriod.start].sort().at(-1),
      );
      maxP = isoMonth(
        [m.representedPeriod.end, c.representedPeriod.end].sort()[0],
      );
      if (!startP) {
        startP = shift(maxP, -59);
        endP = maxP;
        calcFrom = shift(maxP, -12);
        calcTo = maxP;
      }
      const [mr, cr, hr] = await Promise.all([
        active.query(MONTHLY_DATASET_ID, MONTHLY_SQL, {
          params: [`${startP}-01`, `${endP}-01`],
        }),
        active.query(CATEGORY_DATASET_ID, CATEGORY_SQL, {
          params: [`${startP}-01`, `${endP}-01`],
        }),
        active.query(MONTHLY_DATASET_ID, MONTHLY_SQL, {
          params: [`${minP}-01`, `${maxP}-01`],
        }),
      ]);
      if (id !== request) return;
      monthly = mr;
      category = cr;
      history = hr;
      if (!monthly.length || !category.length) {
        state(
          "empty",
          "No observations in this window. The datasets stop at the latest month both providers publish in full. Widen the period, or return after the next INSEE release.",
        );
        const reset = el("button", "Show the last five years");
        reset.type = "button";
        reset.addEventListener("click", () => {
          preset = "five-years";
          startP = shift(maxP, -59);
          endP = maxP;
          void load();
        });
        content.append(reset);
        return;
      }
      meta.innerHTML = `<div><dt>Latest published month</dt><dd>${maxP}</dd></div><div><dt>Source</dt><dd>INSEE — IPC, Base 2025</dd></div><div><dt>Licence</dt><dd>Licence Ouverte / Open Licence 2.0</dd></div><div><dt>Datasets</dt><dd>insee_cpi_monthly · insee_cpi_category_analysis (contract 1.0.0)</dd></div>`;
      applyQualification();
      renderReady(previousView.open);
    } catch (error) {
      const lastSuccessful =
          isoMonth(monthly.at(-1)?.period) || maxP || "not yet available",
        selection = selP || "latest";
      state(
        "query-error",
        `${error.safeMessage || "The query for this period did not complete."} No figures are shown rather than partial ones. Last successful month: ${lastSuccessful}. Selection ${selection} retained. query_failed · insee_cpi_monthly + insee_cpi_category_analysis · window=${startP || "default"}`,
      );
      const retry = el("button", "Retry the query");
      retry.addEventListener("click", () => void load());
      content.append(retry);
    }
  }
  void load();
  void loadQualification();
  return main;
}
