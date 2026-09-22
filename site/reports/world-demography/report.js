/**
 * The world-demography report.
 *
 * The report owns data access, parameter-bound SQL, row mapping, state,
 * routing and the shared client. Visuals receive validated plain rows plus
 * display and provenance inputs, and return ordinary DOM.
 *
 * Three figures draw on more than one dataset. Each declares the query that
 * supplies its row spine on its slot; the others are declared alongside and
 * joined here, before the visual is called. A query may select only from its
 * own dataset's table, so the join is the report's work and nobody else's.
 */
import { DataClientError } from "../../data/client.js";
import { getPageDataClient } from "../../data/browser-shell.js";
import { runReportSlot, setAccessibleState } from "../../data/report-runtime.js";
import { renderWorldPopulationPath } from "../../visuals/world-population-path.js";
import { renderCountryPopulationPaths } from "../../visuals/country-population-paths.js";
import { renderChangeComposition } from "../../visuals/change-composition.js";
import { renderMigrationFlows } from "../../visuals/migration-flows.js";
import { renderFertilityLongevity } from "../../visuals/fertility-longevity.js";
import { renderAgeStructure } from "../../visuals/age-structure.js";
import { captureView, restoreView } from "./state.js";

export const REPORT_ID = "world-demography";

/**
 * Six country slots, because a parameterised query has a fixed arity and six
 * is where the direct labels at the line ends begin to collide. Unused slots
 * are passed a location code no row carries.
 */
export const MAX_COUNTRIES = 6;
const UNUSED_LOCATION = -1;
// A filler for the ISO3 slots of unselected countries. Two hyphens can
// never be an ISO 3166-1 alpha-3 code, so no row matches it.
const UNUSED_ISO3 = "--";

/** The report's own selectable universe: the provider publishes all 237. */
export const UNIVERSE_FLOOR = 300;

export const DEFAULT_COUNTRIES = Object.freeze([250, 276, 826]);
const PALETTE = Object.freeze(["#b5abfc", "#8fb0d1", "#9dc0ae", "#d09a6a", "#c98fb0", "#8c93a8"]);

export const QUERIES = Object.freeze({
  "world-indicators":
    "SELECT CAST(period AS VARCHAR) AS period, series_kind, CAST(population_thousands AS DOUBLE) AS population_thousands, CAST(population_growth_rate_pct AS DOUBLE) AS population_growth_rate_pct FROM world_demography_indicators WHERE location_kind = 'world' AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period",
  "world-scenarios":
    "SELECT CAST(period AS VARCHAR) AS period, scenario, scenario_kind, CAST(population_thousands AS DOUBLE) AS population_thousands FROM world_demography_scenarios WHERE location_kind = 'world' AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY scenario, period",
  "country-population":
    "SELECT CAST(period AS VARCHAR) AS period, location_id, location_name, series_kind, CAST(population_thousands AS DOUBLE) AS population_thousands, CAST(population_growth_rate_pct AS DOUBLE) AS population_growth_rate_pct FROM world_demography_indicators WHERE location_id IN (?, ?, ?, ?, ?, ?) AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY location_id, period",
  "country-scenarios":
    "SELECT CAST(period AS VARCHAR) AS period, location_id, scenario, scenario_kind, CAST(population_thousands AS DOUBLE) AS population_thousands FROM world_demography_scenarios WHERE location_id IN (?, ?, ?, ?, ?, ?) AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY location_id, scenario, period",
  "country-components":
    "SELECT CAST(period AS VARCHAR) AS period, location_id, location_name, series_kind, CAST(population_change_thousands AS DOUBLE) AS population_change_thousands, CAST(natural_change_thousands AS DOUBLE) AS natural_change_thousands, CAST(natural_change_rate_per_1000 AS DOUBLE) AS natural_change_rate_per_1000, CAST(net_migration_thousands AS DOUBLE) AS net_migration_thousands, CAST(net_migration_rate_per_1000 AS DOUBLE) AS net_migration_rate_per_1000 FROM world_demography_indicators WHERE location_id IN (?, ?, ?, ?, ?, ?) AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY location_id, period",
  "country-net-migration":
    "SELECT CAST(period AS VARCHAR) AS period, location_id, location_name, iso3_code, CAST(net_migration_thousands AS DOUBLE) AS net_migration_thousands FROM world_demography_indicators WHERE location_id IN (?, ?, ?, ?, ?, ?) AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY location_id, period",
  "immigration-flows":
    "SELECT CAST(period AS VARCHAR) AS period, iso3_code, immigration_persons FROM european_immigration_flows WHERE iso3_code IN (?, ?, ?, ?, ?, ?) AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY iso3_code, period",
  "emigration-flows":
    "SELECT CAST(period AS VARCHAR) AS period, iso3_code, emigration_persons FROM european_emigration_flows WHERE iso3_code IN (?, ?, ?, ?, ?, ?) AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY iso3_code, period",
  "country-longevity":
    "SELECT CAST(period AS VARCHAR) AS period, location_id, location_name, iso3_code, series_kind, CAST(total_fertility_rate AS DOUBLE) AS total_fertility_rate, CAST(life_expectancy_years AS DOUBLE) AS life_expectancy_years FROM world_demography_indicators WHERE location_id IN (?, ?, ?, ?, ?, ?) AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY location_id, period",
  "healthy-years":
    "SELECT CAST(period AS VARCHAR) AS period, iso3_code, CAST(healthy_life_expectancy_years AS DOUBLE) AS healthy_life_expectancy_years FROM healthy_life_expectancy WHERE sex = 'total' AND iso3_code IN (?, ?, ?, ?, ?, ?) AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY iso3_code, period",
  "age-bands":
    "SELECT location_id, location_name, age_grouping, age_group, age_start, age_end, CAST(population_male_thousands AS DOUBLE) AS population_male_thousands, CAST(population_female_thousands AS DOUBLE) AS population_female_thousands, CAST(population_total_thousands AS DOUBLE) AS population_total_thousands, CAST(share_of_population_pct AS DOUBLE) AS share_of_population_pct FROM world_demography_age_structure WHERE location_id IN (?, ?, ?, ?, ?, ?) AND period = CAST(? AS DATE) ORDER BY location_id, age_grouping, age_start",
  "country-universe":
    "SELECT location_id, location_name, iso3_code, CAST(population_thousands AS DOUBLE) AS population_thousands FROM world_demography_indicators WHERE location_kind = 'country' AND period = CAST(? AS DATE) AND population_thousands >= CAST(? AS DOUBLE) ORDER BY location_name",
});

const DATASETS = Object.freeze({
  indicators: "world-demography-indicators",
  scenarios: "world-demography-scenarios",
  ageStructure: "world-demography-age-structure",
  immigration: "european-immigration-flows",
  emigration: "european-emigration-flows",
  healthy: "healthy-life-expectancy",
});

const FIGURES = Object.freeze([
  { id: "world-population-path", heading: "The world's population, and the range the projection spans",
    caption: "Population on 1 July each year. The shaded range is the provider's 95% prediction interval; the named scenarios hold one assumption fixed and are bounds for reasoning rather than forecasts." },
  { id: "country-population-paths", heading: "Population of the selected countries",
    caption: "Each country's population on 1 July. France here is the provider's France, which excludes the overseas departments; they are published as separate locations." },
  { id: "change-composition", heading: "What changes a population: natural change and net migration",
    caption: "" },
  { id: "migration-flows", heading: "Arrivals and departures, where a provider publishes them",
    caption: "Eurostat counts everyone who changed their country of usual residence for at least twelve months, in both directions and regardless of citizenship. Its arrivals and departures are differenceable against each other. They are not the components of the United Nations balance drawn beside them, which comes from a different provider on a different basis." },
  { id: "fertility-longevity", heading: "Fertility, life expectancy, and years lived in full health",
    caption: "Healthy life expectancy is a modelled quantity from the World Health Organization, weighting years lived by disability across causes. It is published for a much shorter period than life expectancy, and on a different basis, so the two are drawn in their own panels." },
  { id: "age-structure", heading: "Age structure at the selected year",
    caption: "Population by five-year age band and sex, and the same people split into young, working age and old. The provider's bands are five years wide, so the working-age split falls at 15 and 65 rather than at 18." },
]);

const element = (name, text, className) => {
  const item = document.createElement(name);
  if (text !== undefined) item.textContent = String(text);
  if (className) item.className = className;
  return item;
};

const yearOf = (period) => Number(String(period).slice(0, 4));
const dateOf = (year) => `${year}-01-01`;

function slots(values, empty) {
  const padded = values.slice(0, MAX_COUNTRIES);
  while (padded.length < MAX_COUNTRIES) padded.push(empty);
  return padded;
}

function attribution(dataset, column) {
  const indicator = dataset?.semanticMetadata?.indicators?.find((item) => item.column === column);
  return indicator?.attribution ?? "Published public dataset";
}

/** A figure's own shell. Its caption is report-owned copy; its body is the visual's. */
function figureShell(definition) {
  const figure = element("figure");
  figure.dataset.figure = definition.id;
  const caption = element("figcaption");
  const heading = element("h3", definition.heading);
  heading.id = `figure-${definition.id}-heading`;
  figure.setAttribute("aria-labelledby", heading.id);
  caption.append(heading);
  if (definition.caption) caption.append(element("p", definition.caption));
  const body = element("div", undefined, "figure-body");
  body.dataset.slot = definition.id;
  figure.append(caption, body);
  return { figure, body };
}

export function renderWorldDemographyReport({ client = getPageDataClient(), scenario } = {}) {
  const activeClient = scenarioClient(client, scenario);
  const root = element("div", undefined, "pulse-report wd-report");
  const header = element("header");
  const eyebrow = element("p", "Pulse standing report", "eyebrow");
  const title = element("h1", "World demography");
  const standfirst = element("p", "For the world and for every country above 300,000 people.", "standfirst");
  const edges = element("dl");
  header.append(eyebrow, title, standfirst, edges);

  const controls = element("section", undefined, "exploration");
  controls.setAttribute("aria-label", "Exploration controls");
  const content = element("div", undefined, "report-content");
  root.append(header, controls, content);

  const shells = new Map();
  for (const definition of FIGURES) {
    const { figure, body } = figureShell(definition);
    shells.set(definition.id, body);
    content.append(figure);
  }

  const state = {
    preset: "all",
    from: 1950,
    to: 2100,
    explicitEnd: false,
    year: 2023,
    selected: [...DEFAULT_COUNTRIES],
    colours: new Map(DEFAULT_COUNTRIES.map((id, index) => [id, PALETTE[index]])),
    scenarioMode: "interval95",
    unit: "people",
    universe: [],
    boundary: 2023,
    names: new Map(),
    iso3: new Map(),
  };

  const colourFor = (id) => state.colours.get(id) ?? "#b2b6ca";
  const colourMap = () => Object.fromEntries([...state.colours].map(([id, colour]) => [id, colour]));
  const assignColour = (id) => {
    if (state.colours.has(id)) return;
    const used = new Set(state.colours.values());
    state.colours.set(id, PALETTE.find((colour) => !used.has(colour)) ?? "#b2b6ca");
  };

  let datasets = {};
  const familyEnd = (datasetId) => {
    const published = datasets[datasetId]?.representedPeriod?.end;
    if (!published) return dateOf(state.to);
    // While the window runs to the latest, each family stops at its own
    // published end; an explicit end pulls every family back together.
    const publishedYear = yearOf(published);
    return state.explicitEnd ? dateOf(state.to) : dateOf(Math.min(state.to, publishedYear));
  };

  const countryParams = (datasetId) => [
    ...slots(state.selected, UNUSED_LOCATION),
    dateOf(state.from),
    familyEnd(datasetId),
  ];
  const iso3Params = (datasetId) => [
    ...slots(state.selected.map((id) => state.iso3.get(id) ?? UNUSED_ISO3), UNUSED_ISO3),
    dateOf(state.from),
    familyEnd(datasetId),
  ];

  // Most of this report's queries do not depend on the selected year: moving
  // the observation changes which point is marked, not which rows were asked
  // for. Re-running them on every tick of the year control would re-read the
  // same rows out of the engine a dozen times to draw the same lines. A query
  // is therefore keyed on the parameters it was actually given, and only a
  // query whose parameters changed reaches the client.
  const rowCache = new Map();
  const query = (datasetId, key, params, columns, mapRow) => {
    const cacheKey = JSON.stringify([datasetId, key, params]);
    const cached = rowCache.get(cacheKey);
    if (cached) return cached;
    const pendingRows = activeClient
      .query(datasetId, QUERIES[key], { params, expectedColumns: columns, mapRow })
      // A failed query is not cached: retry has to be able to reach the engine.
      .catch((error) => { rowCache.delete(cacheKey); throw error; });
    rowCache.set(cacheKey, pendingRows);
    return pendingRows;
  };

  const numeric = (value) => (value === null || value === undefined ? null : Number(value));
  const required = (value, field) => {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new DataClientError("schema", `The report data is missing ${field}.`);
    return number;
  };

  const mapWorld = (row) => ({
    period: String(row.period), series_kind: String(row.series_kind),
    population_thousands: required(row.population_thousands, "a world population"),
    population_growth_rate_pct: required(row.population_growth_rate_pct, "a world rate of change"),
  });
  const mapCountryPopulation = (row) => ({
    period: String(row.period), location_id: Number(row.location_id), location_name: String(row.location_name),
    series_kind: String(row.series_kind),
    population_thousands: required(row.population_thousands, "a population"),
    population_growth_rate_pct: required(row.population_growth_rate_pct, "a rate of change"),
  });
  const mapScenario = (row) => ({
    period: String(row.period), location_id: row.location_id === undefined ? null : Number(row.location_id),
    scenario: String(row.scenario), scenario_kind: String(row.scenario_kind),
    population_thousands: numeric(row.population_thousands),
  });
  const mapComponents = (row) => ({
    period: String(row.period), location_id: Number(row.location_id), location_name: String(row.location_name),
    series_kind: String(row.series_kind),
    population_change_thousands: required(row.population_change_thousands, "a population change"),
    natural_change_thousands: required(row.natural_change_thousands, "a natural change"),
    natural_change_rate_per_1000: required(row.natural_change_rate_per_1000, "a natural change rate"),
    net_migration_thousands: required(row.net_migration_thousands, "a net migration"),
    net_migration_rate_per_1000: required(row.net_migration_rate_per_1000, "a net migration rate"),
  });

  const selectedIndex = () => Math.max(0, Math.min(state.to - state.from, state.year - state.from));

  const mounts = {
    "world-population-path": (body) => runReportSlot({
      element: body,
      query: async () => {
        const [rows, bandRows] = await Promise.all([
          query(DATASETS.indicators, "world-indicators", [dateOf(state.from), familyEnd(DATASETS.indicators)],
            ["period", "series_kind", "population_thousands", "population_growth_rate_pct"], mapWorld),
          query(DATASETS.scenarios, "world-scenarios", [dateOf(state.from), familyEnd(DATASETS.scenarios)],
            ["period", "scenario", "scenario_kind", "population_thousands"], mapScenario).catch(() => []),
        ]);
        body.dataset.bandRows = String(bandRows.length);
        pending.bandRows = bandRows;
        return rows;
      },
      render: (rows, target) => {
        const periods = rows.map((row) => row.period);
        target.replaceChildren(renderWorldPopulationPath(rows, {
          width: plotWidth(target),
          selectedIndex: nearest(periods, state.year),
          scenarioMode: state.scenarioMode,
          bandRows: pending.bandRows ?? [],
        }, attribution(datasets[DATASETS.indicators], "population_thousands")));
        wireSelection(target, periods);
      },
      retry: () => mount("world-population-path"),
    }),

    "country-population-paths": (body) => runReportSlot({
      element: body,
      query: async () => {
        if (!state.selected.length) throw new DataClientError("empty", "Choose at least one country in the control row to draw this figure.");
        const [rows, bandRows] = await Promise.all([
          query(DATASETS.indicators, "country-population", countryParams(DATASETS.indicators),
            ["period", "location_id", "location_name", "series_kind", "population_thousands", "population_growth_rate_pct"], mapCountryPopulation),
          query(DATASETS.scenarios, "country-scenarios", countryParams(DATASETS.scenarios),
            ["period", "location_id", "scenario", "scenario_kind", "population_thousands"], mapScenario).catch(() => []),
        ]);
        pending.countryBands = bandRows;
        return rows;
      },
      render: (rows, target) => {
        const periods = [...new Set(rows.map((row) => row.period))].sort();
        target.replaceChildren(renderCountryPopulationPaths(rows, {
          width: plotWidth(target),
          selectedIndex: nearest(periods, state.year),
          seriesColours: colourMap(),
          scenarioMode: state.scenarioMode,
          bandRows: pending.countryBands ?? [],
        }, attribution(datasets[DATASETS.indicators], "population_thousands")));
        wireSelection(target, periods);
      },
      retry: () => mount("country-population-paths"),
    }),

    "change-composition": (body) => runReportSlot({
      element: body,
      query: async () => {
        if (!state.selected.length) throw new DataClientError("empty", "Choose at least one country in the control row to draw this figure.");
        return query(DATASETS.indicators, "country-components", countryParams(DATASETS.indicators),
          ["period", "location_id", "location_name", "series_kind", "population_change_thousands",
            "natural_change_thousands", "natural_change_rate_per_1000",
            "net_migration_thousands", "net_migration_rate_per_1000"], mapComponents);
      },
      render: (rows, target) => {
        const periods = [...new Set(rows.map((row) => row.period))].sort();
        target.replaceChildren(renderChangeComposition(rows, {
          width: plotWidth(target),
          selectedIndex: nearest(periods, state.year),
          seriesColours: colourMap(),
          unit: state.unit,
        }, attribution(datasets[DATASETS.indicators], "natural_change_thousands")));
        wireSelection(target, periods);
      },
      retry: () => mount("change-composition"),
    }),

    "migration-flows": (body) => runReportSlot({
      element: body,
      query: async () => {
        if (!state.selected.length) throw new DataClientError("empty", "Choose at least one country in the control row to draw this figure.");
        // The spine is the United Nations table: a country Eurostat does not
        // cover still yields rows, so its panel renders the absence instead
        // of vanishing. The two flow queries are joined onto it here.
        const [spine, arrivals, departures] = await Promise.all([
          query(DATASETS.indicators, "country-net-migration", countryParams(DATASETS.indicators),
            ["period", "location_id", "location_name", "iso3_code", "net_migration_thousands"],
            (row) => ({
              period: String(row.period), location_id: Number(row.location_id),
              location_name: String(row.location_name),
              iso3_code: row.iso3_code === null || row.iso3_code === undefined ? null : String(row.iso3_code),
              net_migration_thousands: required(row.net_migration_thousands, "a net migration"),
            })),
          query(DATASETS.immigration, "immigration-flows", iso3Params(DATASETS.immigration),
            ["period", "iso3_code", "immigration_persons"],
            (row) => ({ period: String(row.period), iso3_code: String(row.iso3_code), immigration_persons: numeric(row.immigration_persons) })).catch(() => []),
          query(DATASETS.emigration, "emigration-flows", iso3Params(DATASETS.emigration),
            ["period", "iso3_code", "emigration_persons"],
            (row) => ({ period: String(row.period), iso3_code: String(row.iso3_code), emigration_persons: numeric(row.emigration_persons) })).catch(() => []),
        ]);
        const arrivalsBy = new Map(arrivals.map((row) => [`${row.iso3_code}|${row.period}`, row.immigration_persons]));
        const departuresBy = new Map(departures.map((row) => [`${row.iso3_code}|${row.period}`, row.emigration_persons]));
        pending.flowCoverage = Object.fromEntries(spine.map((row) => {
          const published = arrivals.concat(departures).filter((item) => item.iso3_code === row.iso3_code);
          return [row.location_id, published.length ? yearOf(published.at(-1).period) : null];
        }));
        return spine.map((row) => ({
          ...row,
          arrivals_persons: arrivalsBy.get(`${row.iso3_code}|${row.period}`) ?? null,
          departures_persons: departuresBy.get(`${row.iso3_code}|${row.period}`) ?? null,
        }));
      },
      render: (rows, target) => {
        const periods = [...new Set(rows.map((row) => row.period))].sort();
        target.replaceChildren(renderMigrationFlows(rows, {
          width: plotWidth(target),
          selectedIndex: nearest(periods, state.year),
          seriesColours: colourMap(),
          flowCoverage: pending.flowCoverage ?? {},
        }, `${attribution(datasets[DATASETS.immigration], "immigration_persons")} · ${attribution(datasets[DATASETS.indicators], "net_migration_thousands")}`));
        wireSelection(target, periods);
      },
      retry: () => mount("migration-flows"),
    }),

    "fertility-longevity": (body) => runReportSlot({
      element: body,
      query: async () => {
        if (!state.selected.length) throw new DataClientError("empty", "Choose at least one country in the control row to draw this figure.");
        const [spine, healthy] = await Promise.all([
          query(DATASETS.indicators, "country-longevity", countryParams(DATASETS.indicators),
            ["period", "location_id", "location_name", "iso3_code", "series_kind", "total_fertility_rate", "life_expectancy_years"],
            (row) => ({
              period: String(row.period), location_id: Number(row.location_id),
              location_name: String(row.location_name),
              iso3_code: row.iso3_code === null || row.iso3_code === undefined ? null : String(row.iso3_code),
              series_kind: String(row.series_kind),
              total_fertility_rate: required(row.total_fertility_rate, "a fertility rate"),
              life_expectancy_years: required(row.life_expectancy_years, "a life expectancy"),
            })),
          query(DATASETS.healthy, "healthy-years", iso3Params(DATASETS.healthy),
            ["period", "iso3_code", "healthy_life_expectancy_years"],
            (row) => ({ period: String(row.period), iso3_code: String(row.iso3_code), healthy_life_expectancy_years: numeric(row.healthy_life_expectancy_years) })).catch(() => []),
        ]);
        const healthyBy = new Map(healthy.map((row) => [`${row.iso3_code}|${row.period}`, row.healthy_life_expectancy_years]));
        return spine.map((row) => ({
          ...row,
          healthy_life_expectancy_years: healthyBy.get(`${row.iso3_code}|${row.period}`) ?? null,
        }));
      },
      render: (rows, target) => {
        const periods = [...new Set(rows.map((row) => row.period))].sort();
        target.replaceChildren(renderFertilityLongevity(rows, {
          width: plotWidth(target),
          selectedIndex: nearest(periods, state.year),
          seriesColours: colourMap(),
        }, `${attribution(datasets[DATASETS.indicators], "life_expectancy_years")} · ${attribution(datasets[DATASETS.healthy], "healthy_life_expectancy_years")}`));
        wireSelection(target, periods);
      },
      retry: () => mount("fertility-longevity"),
    }),

    "age-structure": (body) => runReportSlot({
      element: body,
      query: async () => {
        if (!state.selected.length) throw new DataClientError("empty", "Choose at least one country in the control row to draw this figure.");
        return query(DATASETS.ageStructure, "age-bands",
          [...slots(state.selected, UNUSED_LOCATION), dateOf(state.year)],
          ["location_id", "location_name", "age_grouping", "age_group", "age_start", "age_end",
            "population_male_thousands", "population_female_thousands", "population_total_thousands", "share_of_population_pct"],
          (row) => ({
            location_id: Number(row.location_id), location_name: String(row.location_name),
            age_grouping: String(row.age_grouping), age_group: String(row.age_group),
            age_start: Number(row.age_start),
            age_end: row.age_end === null || row.age_end === undefined ? null : Number(row.age_end),
            population_male_thousands: required(row.population_male_thousands, "a male population"),
            population_female_thousands: required(row.population_female_thousands, "a female population"),
            population_total_thousands: required(row.population_total_thousands, "a band population"),
            share_of_population_pct: required(row.share_of_population_pct, "a band share"),
          }));
      },
      render: (rows, target) => {
        target.replaceChildren(renderAgeStructure(rows, {
          width: plotWidth(target),
          selectedYear: state.year,
          seriesColours: colourMap(),
        }, attribution(datasets[DATASETS.ageStructure], "population_total_thousands")));
      },
      retry: () => mount("age-structure"),
    }),
  };

  const pending = {};

  function plotWidth(target) {
    // Take the width the container actually has, down to a floor the axes
    // still fit inside; below that the figure scrolls within its own frame
    // rather than widening the page. Floored, not rounded: rounding a 925.6px
    // container up to 926 gives the figure a pixel it does not have and puts
    // a scrollbar under every chart. The floor is below the narrowest
    // container a phone produces, so that scroll is a backstop nobody meets
    // rather than what every figure does on a phone. The 1188 fallback is for
    // a detached element, which measures zero, never for a narrow one.
    const measured = Math.floor(target.getBoundingClientRect().width);
    return measured > 0 ? Math.max(240, measured) : 1188;
  }

  function nearest(periods, year) {
    if (!periods.length) return 0;
    let best = 0, distance = Infinity;
    periods.forEach((period, index) => {
      const gap = Math.abs(yearOf(period) - year);
      if (gap < distance) { distance = gap; best = index; }
    });
    return best;
  }

  /**
   * Click-to-select. The visual emits its own index; the report resolves it
   * to a year and every figure follows, whatever grain each one is at.
   */
  function wireSelection(target, periods) {
    target.addEventListener("pulse-select", (event) => {
      const period = periods[event.detail?.index ?? 0];
      if (period) setYear(yearOf(period));
    });
  }

  const renderedWidth = new Map();

  function mount(id) {
    const body = shells.get(id);
    if (!body) return Promise.resolve(null);
    renderedWidth.set(id, plotWidth(body));
    return mounts[id](body);
  }

  /**
   * Redraw a figure whose container changed width.
   *
   * A figure is drawn at the width its container had when it was drawn, so
   * without this a reader who rotates a phone, splits a window or zooms keeps
   * plots sized for the width they have left. The rows are already held, so a
   * redraw re-reads nothing: every query here is cached on its parameters,
   * and none of them takes a width.
   */
  function remeasure() {
    const changed = [...shells.keys()].filter((id) => {
      const body = shells.get(id);
      return body.dataset.state === "ready" && plotWidth(body) !== renderedWidth.get(id);
    });
    if (changed.length) mountAll(changed);
  }

  let remeasurePending = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(remeasurePending);
    remeasurePending = requestAnimationFrame(remeasure);
  });

  function mountAll(ids = FIGURES.map((definition) => definition.id)) {
    const view = captureView(root);
    return Promise.all(ids.map((id) => mount(id))).then((results) => {
      restoreView(root, view);
      return results;
    });
  }

  function setYear(year) {
    const clamped = Math.max(state.from, Math.min(state.to, Math.round(year)));
    if (clamped === state.year) return;
    state.year = clamped;
    syncYearControl();
    mountAll();
  }

  /**
   * The year control is brought up to date in place, never rebuilt.
   *
   * Every other control redraws the whole bar, which is cheap because it
   * happens once per click. The year changes on every tick of a drag, and
   * rebuilding the bar removes the element the pointer is holding: Firefox on
   * Android drops the gesture there, so the slider could not be moved at all.
   */
  function syncYearControl() {
    const slider = controls.querySelector('[data-control="observation-year"]');
    if (!slider) return void drawControls();
    if (slider.value !== String(state.year)) slider.value = String(state.year);
    slider.setAttribute("aria-valuetext", String(state.year));
    const output = controls.querySelector(".observation-control output");
    if (output) output.textContent = String(state.year);
  }

  function setWindow(from, to, { preset, explicitEnd }) {
    state.from = Math.min(from, to - 1);
    state.to = Math.max(to, from + 1);
    state.preset = preset;
    state.explicitEnd = explicitEnd;
    state.year = Math.max(state.from, Math.min(state.to, state.year));
    drawControls();
    mountAll();
  }

  function toggleCountry(id) {
    if (state.selected.includes(id)) {
      state.selected = state.selected.filter((item) => item !== id);
      state.colours.delete(id);
    } else if (state.selected.length < MAX_COUNTRIES) {
      state.selected = [...state.selected, id];
      assignColour(id);
    }
    drawControls();
    mountAll();
  }

  function drawControls() {
    const view = captureView(root);
    controls.replaceChildren();

    const periodField = element("fieldset", undefined, "period-field");
    periodField.append(element("legend", "Represented period"));
    const periodRow = element("div", undefined, "period-row");
    const presets = element("div", undefined, "segments");
    presets.setAttribute("role", "radiogroup");
    presets.setAttribute("aria-label", "Represented period presets");
    const presetDefinitions = [
      { key: "all", label: "1950–2100", from: 1950, to: 2100 },
      { key: "observed", label: "Observed only", from: 1950, to: state.boundary },
      { key: "fifty", label: "Last 50 years", from: state.boundary - 49, to: state.boundary },
      { key: "century", label: "This century", from: 2000, to: 2100 },
    ];
    for (const definition of presetDefinitions) {
      const label = element("label");
      const input = element("input");
      input.type = "radio";
      input.name = "world-demography-period";
      input.checked = state.preset === definition.key;
      input.dataset.control = `period-${definition.key}`;
      input.addEventListener("change", () => setWindow(definition.from, definition.to, { preset: definition.key, explicitEnd: definition.key !== "all" }));
      label.append(input, element("span", definition.label));
      presets.append(label);
    }
    if (state.preset === "custom") {
      const label = element("label");
      const input = element("input");
      input.type = "radio";
      input.name = "world-demography-period";
      input.checked = true;
      input.dataset.control = "period-custom";
      label.append(input, element("span", "Custom"));
      presets.append(label);
    }
    periodRow.append(presets, yearSelect("From", state.from, (value) => setWindow(value, state.to, { preset: "custom", explicitEnd: state.explicitEnd })));
    periodRow.append(yearSelect("To", state.to, (value) => setWindow(state.from, value, { preset: "custom", explicitEnd: true })));
    periodField.append(periodRow);

    // A div with its own labelled control rather than a label wrapping
    // everything: the reading is the slider's, and the output beside it
    // belongs to the slider rather than to a label that also owns it.
    const observation = element("div", undefined, "observation-control");
    const observationLabel = element("label", "Observation year — or click any point on a figure");
    observationLabel.htmlFor = "world-demography-year";
    observation.append(observationLabel);
    const slider = element("input");
    slider.type = "range";
    slider.min = String(state.from);
    slider.max = String(state.to);
    slider.step = "1";
    slider.value = String(state.year);
    slider.id = "world-demography-year";
    slider.dataset.control = "observation-year";
    slider.setAttribute("aria-label", "Observation year");
    slider.setAttribute("aria-valuetext", String(state.year));
    slider.addEventListener("input", () => setYear(Number(slider.value)));
    const output = element("output", String(state.year));
    output.htmlFor = slider.id;
    const track = element("div", undefined, "observation-track");
    track.append(slider, output);
    observation.append(track);

    const countryField = element("fieldset", undefined, "component-field");
    countryField.append(element("legend", `Countries compared — ${state.selected.length} of ${state.universe.length || "184"} selectable`));
    const countryRow = element("div", undefined, "component-row");
    for (const id of state.selected) {
      const label = element("label");
      const input = element("input");
      input.type = "checkbox";
      input.checked = true;
      input.dataset.control = `country-${id}`;
      input.addEventListener("change", () => toggleCountry(id));
      const swatch = element("span", undefined, "swatch");
      swatch.style.background = colourFor(id);
      label.append(input, swatch, element("span", state.names.get(id) ?? String(id)));
      countryRow.append(label);
    }
    if (state.selected.length < MAX_COUNTRIES && state.universe.length) {
      const label = element("label", undefined, "month-picker");
      label.append(element("span", "Add"));
      const select = element("select");
      select.dataset.control = "add-country";
      select.setAttribute("aria-label", "Add a country to the comparison");
      const placeholder = element("option", "Choose…");
      placeholder.value = "";
      select.append(placeholder);
      for (const country of state.universe) {
        if (state.selected.includes(country.location_id)) continue;
        const option = element("option", country.location_name);
        option.value = String(country.location_id);
        select.append(option);
      }
      select.addEventListener("change", () => {
        if (select.value) toggleCountry(Number(select.value));
      });
      label.append(select);
      countryRow.append(label);
    } else if (state.selected.length >= MAX_COUNTRIES) {
      countryRow.append(element("span", `Six is the most this report compares at once.`, "control-note"));
    }
    countryField.append(countryRow);

    const scenarioField = element("fieldset", undefined, "component-field");
    scenarioField.append(element("legend", "Projection shown"));
    const scenarioRow = element("div", undefined, "segments");
    scenarioRow.setAttribute("role", "radiogroup");
    scenarioRow.setAttribute("aria-label", "Projection scenarios shown");
    for (const [key, label] of [["interval95", "95% interval"], ["highlow", "High and low fertility"], ["bounds", "All published bounds"], ["medium", "Medium only"]]) {
      const item = element("label");
      const input = element("input");
      input.type = "radio";
      input.name = "world-demography-scenario";
      input.checked = state.scenarioMode === key;
      input.dataset.control = `scenario-${key}`;
      input.addEventListener("change", () => { state.scenarioMode = key; drawControls(); mountAll(["world-population-path", "country-population-paths"]); });
      item.append(input, element("span", label));
      scenarioRow.append(item);
    }
    scenarioField.append(scenarioRow);

    const unitField = element("fieldset", undefined, "component-field");
    unitField.append(element("legend", "Components measured in"));
    const unitRow = element("div", undefined, "segments");
    unitRow.setAttribute("role", "radiogroup");
    unitRow.setAttribute("aria-label", "Unit for the components of change");
    for (const [key, label] of [["people", "People"], ["per-1000", "Per 1,000 population"]]) {
      const item = element("label");
      const input = element("input");
      input.type = "radio";
      input.name = "world-demography-unit";
      input.checked = state.unit === key;
      input.dataset.control = `unit-${key}`;
      input.addEventListener("change", () => { state.unit = key; drawControls(); mountAll(["change-composition"]); });
      item.append(input, element("span", label));
      unitRow.append(item);
    }
    unitField.append(unitRow);

    controls.append(periodField, observation, countryField, scenarioField, unitField);
    restoreView(root, view);
  }

  function yearSelect(labelText, value, onChange) {
    const label = element("label", undefined, "month-picker");
    label.append(element("span", labelText));
    const select = element("select");
    select.dataset.control = `period-${labelText.toLowerCase()}`;
    select.setAttribute("aria-label", `Represented period ${labelText.toLowerCase()} year`);
    for (let year = 1950; year <= 2100; year += 1) {
      const option = element("option", String(year));
      option.value = String(year);
      select.append(option);
    }
    select.value = String(value);
    select.addEventListener("change", () => onChange(Number(select.value)));
    label.append(select);
    return label;
  }

  function drawEdges() {
    edges.replaceChildren();
    const families = [
      ["UN World Population Prospects 2024", `estimates to ${state.boundary} · projection to ${yearOf(datasets[DATASETS.indicators]?.representedPeriod?.end ?? "2100-12-31")}`],
      ["Eurostat migration flows", `to ${yearOf(datasets[DATASETS.immigration]?.representedPeriod?.end ?? "")}`],
      ["WHO healthy life expectancy", `to ${yearOf(datasets[DATASETS.healthy]?.representedPeriod?.end ?? "")}`],
    ];
    for (const [term, detail] of families) {
      const group = element("div");
      group.append(element("dt", term), element("dd", detail));
      edges.append(group);
    }
  }

  const load = () => {
    setAccessibleState(content, "loading", "Loading the report…");
    Promise.all(Object.values(DATASETS).map((id) => activeClient.getDataset(id)))
      .then(async (loaded) => {
        datasets = Object.fromEntries(Object.values(DATASETS).map((id, index) => [id, loaded[index]]));
        const world = await query(DATASETS.indicators, "world-indicators", [dateOf(1950), dateOf(2100)],
          ["period", "series_kind", "population_thousands", "population_growth_rate_pct"], mapWorld);
        const lastEstimate = world.filter((row) => row.series_kind === "estimate").at(-1);
        state.boundary = lastEstimate ? yearOf(lastEstimate.period) : state.boundary;
        state.year = state.boundary;
        const universe = await query(DATASETS.indicators, "country-universe", [dateOf(state.boundary), UNIVERSE_FLOOR],
          ["location_id", "location_name", "iso3_code", "population_thousands"],
          (row) => ({
            location_id: Number(row.location_id), location_name: String(row.location_name),
            iso3_code: row.iso3_code === null || row.iso3_code === undefined ? null : String(row.iso3_code),
            population_thousands: Number(row.population_thousands),
          }));
        state.universe = universe;
        for (const country of universe) {
          state.names.set(country.location_id, country.location_name);
          if (country.iso3_code) state.iso3.set(country.location_id, country.iso3_code);
        }
        drawEdges();
        drawControls();
        setAccessibleState(content, "ready", null);
        await mountAll();
      })
      .catch((error) => {
        setAccessibleState(content, error?.code === "wasm-startup" ? "engine-error" : "query-error",
          error?.safeMessage ?? "The report could not load.", { retry: load });
      });
  };

  load();
  observer.observe(root);
  for (const body of shells.values()) observer.observe(body);
  return root;
}

/** Deterministic scenarios for the state treatments, never a production path. */
function scenarioClient(client, scenario) {
  if (!scenario) return client;
  const dataset = {
    representedPeriod: { start: "1950-01-01", end: "2100-12-31" },
    semanticMetadata: { indicators: [] },
  };
  const fail = (code, message) => async () => { throw new DataClientError(code, message); };
  if (scenario === "loading") return { getDataset: async () => dataset, query: () => new Promise(() => {}) };
  if (scenario === "empty") return { getDataset: async () => dataset, query: async () => [] };
  if (scenario === "startup") return { getDataset: fail("wasm-startup", "Browser data access could not start."), query: fail("wasm-startup", "Browser data access could not start.") };
  if (scenario === "query") return { getDataset: async () => dataset, query: fail("query", "The report data could not be queried.") };
  if (scenario === "schema") return { getDataset: async () => dataset, query: async () => [{ period: null, population_thousands: "invalid" }] };
  if (scenario === "slot-query") {
    // One dataset fails while every other slot keeps its data. The report
    // declares slot-local failure, and this is what demonstrates it: the age
    // structure is the only figure that reads this table.
    return {
      getDataset: (id) => client.getDataset(id),
      query: (id, ...rest) => (id === DATASETS.ageStructure
        ? Promise.reject(new DataClientError("query", "The query did not complete."))
        : client.query(id, ...rest)),
    };
  }
  return client;
}
