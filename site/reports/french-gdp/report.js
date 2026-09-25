/**
 * The French GDP report.
 *
 * The report owns data access, parameter-bound SQL, row mapping, state,
 * routing and the shared client. Visuals receive validated plain rows plus
 * display and provenance inputs, and return ordinary DOM.
 *
 * Three figures draw on more than one dataset or query: the headline joins
 * the quarterly tail onto the annual accounts, the drivers join the UN
 * working-age share onto the OECD rows, and the map joins departement figures
 * onto the published boundaries. Each declares its row spine on its slot and
 * the others alongside; a query may select only from its own dataset's table,
 * so the join is the report's work and nobody else's.
 */
import { DataClientError } from "../../data/client.js";
import { getPageDataClient } from "../../data/browser-shell.js";
import { runReportSlot, setAccessibleState } from "../../data/report-runtime.js";
import { getPageStatusClient, qualificationLine, qualifyReport } from "../../data/status-client.js";
import { NS, grouped, signedGrouped } from "../../visuals/report-shared.js";
import { renderOutputGrowthTail } from "../../visuals/output-growth-tail.js";
import { renderDemandContributionBars } from "../../visuals/demand-contribution-bars.js";
import { renderBranchSharePanels } from "../../visuals/branch-share-panels.js";
import { renderIncomeSharePanels } from "../../visuals/income-share-panels.js";
import { renderDollarDecomposition } from "../../visuals/dollar-decomposition.js";
import { renderOecdStanding } from "../../visuals/oecd-standing.js";
import { renderPerCapitaDrivers } from "../../visuals/per-capita-drivers.js";
import { renderIndexChoropleth } from "../../visuals/index-choropleth.js";
import { captureView, restoreView } from "./state.js";

export const REPORT_ID = "french-gdp";

/** The first year of the annual accounts, and of the represented period. */
const FIRST_YEAR = 1949;
/**
 * How far back the quarterly tail reaches: from Q1 of the year this many
 * years before the latest quarter's year. Relative to the latest quarter, never
 * a calendar date, and wide enough that 2020 appears quarter by quarter.
 */
export const TAIL_YEARS = 7;
/** The OECD comparison starts here; the drivers' base year cannot be earlier. */
const OECD_FIRST_YEAR = 1970;

export const DEFAULT_COMPARATORS = Object.freeze(["DEU", "GBR", "USA"]);
export const FRANCE = Object.freeze({ code: "FRA", colour: "#73d6c2" });
export const AGGREGATE = Object.freeze({ code: "OECD", colour: "#abb5c5", name: "OECD total" });
const PALETTE = Object.freeze(["#b5abfc", "#f2b872", "#8fb0d1", "#e39bb5", "#9dc0ae", "#d6c77a", "#c9a3e0", "#e6a57a"]);

export const QUERIES = Object.freeze({
  "annual-output":
    "SELECT CAST(period AS VARCHAR) AS period, CAST(gdp_chained_2020_eur_mn AS DOUBLE) AS gdp_chained_2020_eur_mn, CAST(gdp_volume_growth_pct AS DOUBLE) AS gdp_volume_growth_pct, CAST(gdp_per_capita_chained_2020_eur AS DOUBLE) AS gdp_per_capita_chained_2020_eur FROM french_national_accounts_annual WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period",
  "quarterly-output":
    "SELECT CAST(period AS VARCHAR) AS period, CAST(gdp_chained_annualised_eur_mn AS DOUBLE) AS gdp_chained_annualised_eur_mn, CAST(gdp_quarterly_growth_pct AS DOUBLE) AS gdp_quarterly_growth_pct, CAST(gdp_year_on_year_growth_pct AS DOUBLE) AS gdp_year_on_year_growth_pct FROM french_gdp_quarterly WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period",
  "demand-contributions":
    "SELECT CAST(period AS VARCHAR) AS period, CAST(gdp_volume_growth_pct AS DOUBLE) AS gdp_volume_growth_pct, CAST(contribution_household_consumption_pt AS DOUBLE) AS contribution_household_consumption_pt, CAST(contribution_npish_consumption_pt AS DOUBLE) AS contribution_npish_consumption_pt, CAST(contribution_government_consumption_pt AS DOUBLE) AS contribution_government_consumption_pt, CAST(contribution_gfcf_pt AS DOUBLE) AS contribution_gfcf_pt, CAST(contribution_inventories_pt AS DOUBLE) AS contribution_inventories_pt, CAST(contribution_valuables_pt AS DOUBLE) AS contribution_valuables_pt, CAST(contribution_net_trade_pt AS DOUBLE) AS contribution_net_trade_pt FROM french_national_accounts_annual WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period",
  "branch-shares":
    "SELECT CAST(period AS VARCHAR) AS period, level, branch_code, branch_label, parent_code, is_residual, CAST(share_of_total_value_added_pct AS DOUBLE) AS share_of_total_value_added_pct FROM french_branch_value_added ORDER BY level, branch_code, period",
  "income-shares":
    "SELECT CAST(period AS VARCHAR) AS period, CAST(gdp_current_eur_mn AS DOUBLE) AS gdp_current_eur_mn, CAST(adjusted_labour_income_eur_mn AS DOUBLE) AS adjusted_labour_income_eur_mn, CAST(adjusted_capital_income_eur_mn AS DOUBLE) AS adjusted_capital_income_eur_mn, CAST(net_taxes_on_production_eur_mn AS DOUBLE) AS net_taxes_on_production_eur_mn, CAST(net_taxes_on_products_eur_mn AS DOUBLE) AS net_taxes_on_products_eur_mn, CAST(unadjusted_wage_share_pct AS DOUBLE) AS unadjusted_wage_share_pct FROM french_national_accounts_annual WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period",
  "dollar-gdp":
    "SELECT CAST(period AS VARCHAR) AS period, CAST(gdp_current_usd_mn AS DOUBLE) AS gdp_current_usd_mn, CAST(gdp_constant_usd_mn AS DOUBLE) AS gdp_constant_usd_mn, constant_usd_base_year, CAST(eur_per_usd AS DOUBLE) AS eur_per_usd, CAST(dollar_gdp_change_pct AS DOUBLE) AS dollar_gdp_change_pct, CAST(dollar_gdp_change_log_points AS DOUBLE) AS dollar_gdp_change_log_points, CAST(real_growth_log_points AS DOUBLE) AS real_growth_log_points, CAST(deflator_change_log_points AS DOUBLE) AS deflator_change_log_points, CAST(exchange_rate_change_log_points AS DOUBLE) AS exchange_rate_change_log_points FROM french_gdp_dollar_decomposition WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period",
  "oecd-standing":
    "SELECT CAST(period AS VARCHAR) AS period, reference_area_code, reference_area_name, reference_area_kind, CAST(gdp_per_capita_ppp_current_usd AS DOUBLE) AS gdp_per_capita_ppp_current_usd, CAST(gdp_per_capita_ppp_constant_2020_usd AS DOUBLE) AS gdp_per_capita_ppp_constant_2020_usd, CAST(gdp_volume_growth_pct AS DOUBLE) AS gdp_volume_growth_pct FROM oecd_productivity_comparison ORDER BY reference_area_code, period",
  "productivity-drivers":
    "SELECT CAST(period AS VARCHAR) AS period, reference_area_code, reference_area_name, reference_area_kind, CAST(gdp_per_capita_ppp_current_usd AS DOUBLE) AS gdp_per_capita_ppp_current_usd, CAST(gdp_per_capita_ppp_constant_2020_usd AS DOUBLE) AS gdp_per_capita_ppp_constant_2020_usd, CAST(gdp_per_hour_ppp_current_usd AS DOUBLE) AS gdp_per_hour_ppp_current_usd, CAST(gdp_per_hour_ppp_constant_2020_usd AS DOUBLE) AS gdp_per_hour_ppp_constant_2020_usd, CAST(hours_per_worker AS DOUBLE) AS hours_per_worker, CAST(employment_per_capita AS DOUBLE) AS employment_per_capita, labour_input_is_plausible FROM oecd_productivity_comparison WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY reference_area_code, period",
  "working-age-share":
    "SELECT CAST(period AS VARCHAR) AS period, iso3_code, series_kind, CAST(share_of_population_pct AS DOUBLE) AS share_of_population_pct FROM world_demography_age_structure WHERE location_kind = 'country' AND age_grouping = 'broad' AND age_group = '15-64' AND period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY iso3_code, period",
  "departement-geometry":
    "SELECT departement_code, departement_name, region_code, geometry_geojson, CAST(bbox_west AS DOUBLE) AS bbox_west, CAST(bbox_south AS DOUBLE) AS bbox_south, CAST(bbox_east AS DOUBLE) AS bbox_east, CAST(bbox_north AS DOUBLE) AS bbox_north FROM french_departement_geometry ORDER BY departement_code",
  "departement-gdp":
    "SELECT CAST(period AS VARCHAR) AS period, departement_code, departement_name, CAST(gdp_per_inhabitant_eur AS DOUBLE) AS gdp_per_inhabitant_eur, CAST(gdp_per_inhabitant_index_france AS DOUBLE) AS gdp_per_inhabitant_index_france, CAST(france_gdp_per_inhabitant_eur AS DOUBLE) AS france_gdp_per_inhabitant_eur, is_provisional FROM french_departement_gdp ORDER BY departement_code, period",
});

const COLUMNS = Object.freeze({
  "annual-output": ["period", "gdp_chained_2020_eur_mn", "gdp_volume_growth_pct", "gdp_per_capita_chained_2020_eur"],
  "quarterly-output": ["period", "gdp_chained_annualised_eur_mn", "gdp_quarterly_growth_pct", "gdp_year_on_year_growth_pct"],
  "demand-contributions": ["period", "gdp_volume_growth_pct", "contribution_household_consumption_pt", "contribution_npish_consumption_pt", "contribution_government_consumption_pt", "contribution_gfcf_pt", "contribution_inventories_pt", "contribution_valuables_pt", "contribution_net_trade_pt"],
  "branch-shares": ["period", "level", "branch_code", "branch_label", "parent_code", "is_residual", "share_of_total_value_added_pct"],
  "income-shares": ["period", "gdp_current_eur_mn", "adjusted_labour_income_eur_mn", "adjusted_capital_income_eur_mn", "net_taxes_on_production_eur_mn", "net_taxes_on_products_eur_mn", "unadjusted_wage_share_pct"],
  "dollar-gdp": ["period", "gdp_current_usd_mn", "gdp_constant_usd_mn", "constant_usd_base_year", "eur_per_usd", "dollar_gdp_change_pct", "dollar_gdp_change_log_points", "real_growth_log_points", "deflator_change_log_points", "exchange_rate_change_log_points"],
  "oecd-standing": ["period", "reference_area_code", "reference_area_name", "reference_area_kind", "gdp_per_capita_ppp_current_usd", "gdp_per_capita_ppp_constant_2020_usd", "gdp_volume_growth_pct"],
  "productivity-drivers": ["period", "reference_area_code", "reference_area_name", "reference_area_kind", "gdp_per_capita_ppp_current_usd", "gdp_per_capita_ppp_constant_2020_usd", "gdp_per_hour_ppp_current_usd", "gdp_per_hour_ppp_constant_2020_usd", "hours_per_worker", "employment_per_capita", "labour_input_is_plausible"],
  "working-age-share": ["period", "iso3_code", "series_kind", "share_of_population_pct"],
  "departement-geometry": ["departement_code", "departement_name", "region_code", "geometry_geojson", "bbox_west", "bbox_south", "bbox_east", "bbox_north"],
  "departement-gdp": ["period", "departement_code", "departement_name", "gdp_per_inhabitant_eur", "gdp_per_inhabitant_index_france", "france_gdp_per_inhabitant_eur", "is_provisional"],
});

const DATASETS = Object.freeze({
  annual: "french-national-accounts-annual",
  quarterly: "french-gdp-quarterly",
  branches: "french-branch-value-added",
  dollar: "french-gdp-dollar-decomposition",
  oecd: "oecd-productivity-comparison",
  ageStructure: "world-demography-age-structure",
  departements: "french-departement-gdp",
  geometry: "french-departement-geometry",
});

/** Report-owned copy. No sentence here carries a value, direction or period. */
const SECTIONS = Object.freeze([
  { id: "output-growth-tail", heading: "Output and its growth", lede: "",
    notes: [{ label: "Seam", text: "The shaded years are quarters, seasonally and working-day adjusted and annualised. The annual accounts are not working-day adjusted, so the level steps slightly where one gives way to the other; the step is a calendar effect, not growth." }],
    provenance: "Source: INSEE, comptes nationaux annuels et trimestriels, base 2020. Licence Ouverte 2.0." },
  { id: "demand-contribution-bars", heading: "Where growth came from",
    lede: "Contributions of each demand component to real GDP growth. They add up to it; imports enter with a negative sign inside net trade.",
    notes: [],
    provenance: "Source: INSEE, comptes nationaux annuels, base 2020. Households include non-profit institutions serving households; inventories include valuables. Licence Ouverte 2.0." },
  { id: "branch-share-panels", heading: "What the economy produces",
    lede: "Each branch's share of total value added at current prices, one panel per branch in alphabetical order.",
    notes: [],
    provenance: "Source: INSEE, comptes nationaux annuels, base 2020 — production accounts by branch. Shares of total value added, not of GDP. Licence Ouverte 2.0." },
  { id: "income-share-panels", heading: "How income is shared",
    lede: "GDP split into labour income, capital income and net taxes, each as a share of GDP at current market prices. Non-employees are credited with the average compensation per employee (AMECO adjustment), moved from mixed income and surplus to labour.",
    notes: [{ label: "In capital income", text: "Operating surplus includes the rent owner-occupiers are deemed to pay themselves. In years where the imputed labour income exceeds published mixed income, the difference is taken from corporate surplus." }],
    provenance: "Source: INSEE, comptes nationaux annuels, base 2020; AMECO-method adjustment computed from INSEE employment. Licence Ouverte 2.0." },
  { id: "dollar-decomposition", heading: "What French GDP is worth in dollars",
    lede: "GDP converted at the annual-average market exchange rate, and each year's change split into real growth, domestic price change (GDP deflator) and the change in the euro against the dollar, in log points, which add up exactly.",
    notes: [{ label: "Vintage", text: "These figures are the World Bank's, on its own update schedule; its euro GDP can lag the latest INSEE release. Before 1999 the franc is expressed in euros at the fixed conversion rate." }],
    provenance: "Source: World Bank, World Development Indicators (CC BY 4.0). Changes: francs converted to euros at 6.55957; decomposition computed by Pulse." },
  { id: "oecd-standing", heading: "France among OECD economies",
    lede: "GDP per inhabitant at purchasing power parity: at current parities to compare levels within a year, at constant 2020 parities to follow each economy over time.",
    notes: [],
    provenance: "Source: OECD Productivity Database. This is an adaptation of an original work by the OECD (CC BY 4.0)." },
  { id: "per-capita-drivers", heading: "What drives GDP per inhabitant",
    lede: "GDP per inhabitant is the product of output per hour worked, hours per worker, the employment rate of people aged 15 to 64 and their share of the population. In logs the four add up.",
    notes: [{ label: "Projection", text: "The working-age share is the UN's: estimates to {lastEstimate}, medium-variant projections after, drawn dotted over time. It is applied to the OECD population so the four terms still multiply to GDP per inhabitant; the UN publishes no share for the OECD, euro-area or EU aggregates, whose employment is therefore not split." }],
    provenance: "Sources: OECD Productivity Database — this is an adaptation of an original work by the OECD (CC BY 4.0); United Nations, Department of Economic and Social Affairs, Population Division, World Population Prospects 2024 (CC BY 3.0 IGO)." },
  { id: "index-choropleth", heading: "GDP across the departements",
    lede: "GDP per inhabitant relative to France as a whole in the same year. GDP is counted where people work and population where they live, so commuter hubs sit far above their neighbours.",
    notes: [],
    provenance: "Source: Eurostat, gross domestic product at current market prices by NUTS 3 region (nama_10r_3gdp), recent years provisional; boundaries © IGN, simplified for display." },
]);

const element = (name, text, className) => {
  const item = document.createElement(name);
  if (text !== undefined) item.textContent = String(text);
  if (className) item.className = className;
  return item;
};

const yearOf = (period) => Number(String(period).slice(0, 4));
const quarterOf = (period) => Math.floor((Number(String(period).slice(5, 7)) - 1) / 3) + 1;
const dateOf = (year) => `${year}-01-01`;
const endOf = (year) => `${year}-12-31`;

const numeric = (value) => (value === null || value === undefined ? null : Number(value));
const required = (value, field) => {
  const number = Number(value);
  if (value === null || value === undefined || !Number.isFinite(number)) {
    throw new DataClientError("schema", `The report data is missing ${field}.`);
  }
  return number;
};
const text = (value, field) => {
  if (typeof value !== "string" || !value) throw new DataClientError("schema", `The report data is missing ${field}.`);
  return value;
};
const flag = (value) => (value === null || value === undefined ? null : Boolean(value));
/** A sum of published parts, null when the principal part is not published. */
const merged = (principal, extra) => (principal === null ? null : principal + (extra ?? 0));

// ---- Row mapping. Decimal columns arrive cast to DOUBLE; nulls stay null. ----

const mapAnnual = (row) => ({
  period: text(row.period, "a period"),
  gdp_chained_2020_eur_mn: required(row.gdp_chained_2020_eur_mn, "a GDP volume"),
  gdp_volume_growth_pct: numeric(row.gdp_volume_growth_pct),
  gdp_per_capita_chained_2020_eur: required(row.gdp_per_capita_chained_2020_eur, "a GDP per inhabitant"),
});
const mapQuarterly = (row) => ({
  period: text(row.period, "a quarter"),
  gdp_chained_annualised_eur_mn: required(row.gdp_chained_annualised_eur_mn, "a quarterly GDP volume"),
  gdp_quarterly_growth_pct: numeric(row.gdp_quarterly_growth_pct),
  gdp_year_on_year_growth_pct: numeric(row.gdp_year_on_year_growth_pct),
});
const mapDemand = (row) => ({
  period: text(row.period, "a period"),
  gdp_volume_growth_pct: numeric(row.gdp_volume_growth_pct),
  contribution_household_consumption_pt: numeric(row.contribution_household_consumption_pt),
  contribution_npish_consumption_pt: numeric(row.contribution_npish_consumption_pt),
  contribution_government_consumption_pt: numeric(row.contribution_government_consumption_pt),
  contribution_gfcf_pt: numeric(row.contribution_gfcf_pt),
  contribution_inventories_pt: numeric(row.contribution_inventories_pt),
  contribution_valuables_pt: numeric(row.contribution_valuables_pt),
  contribution_net_trade_pt: numeric(row.contribution_net_trade_pt),
});
const mapBranch = (row) => ({
  period: text(row.period, "a period"),
  level: text(row.level, "a branch level"),
  branch_code: text(row.branch_code, "a branch code"),
  branch_label: text(row.branch_label, "a branch name"),
  parent_code: row.parent_code === null || row.parent_code === undefined ? null : String(row.parent_code),
  is_residual: Boolean(row.is_residual),
  share_of_total_value_added_pct: required(row.share_of_total_value_added_pct, "a branch share"),
});
const mapIncome = (row) => ({
  period: text(row.period, "a period"),
  gdp_current_eur_mn: required(row.gdp_current_eur_mn, "a GDP at current prices"),
  adjusted_labour_income_eur_mn: required(row.adjusted_labour_income_eur_mn, "an adjusted labour income"),
  adjusted_capital_income_eur_mn: required(row.adjusted_capital_income_eur_mn, "an adjusted capital income"),
  net_taxes_on_production_eur_mn: required(row.net_taxes_on_production_eur_mn, "net taxes on production"),
  net_taxes_on_products_eur_mn: required(row.net_taxes_on_products_eur_mn, "net taxes on products"),
  unadjusted_wage_share_pct: required(row.unadjusted_wage_share_pct, "an unadjusted wage share"),
});
const mapDollar = (row) => ({
  period: text(row.period, "a period"),
  gdp_current_usd_mn: required(row.gdp_current_usd_mn, "a dollar GDP"),
  gdp_constant_usd_mn: required(row.gdp_constant_usd_mn, "a constant-dollar GDP"),
  constant_usd_base_year: required(row.constant_usd_base_year, "a constant-dollar base year"),
  eur_per_usd: required(row.eur_per_usd, "an exchange rate"),
  dollar_gdp_change_pct: numeric(row.dollar_gdp_change_pct),
  dollar_gdp_change_log_points: numeric(row.dollar_gdp_change_log_points),
  real_growth_log_points: numeric(row.real_growth_log_points),
  deflator_change_log_points: numeric(row.deflator_change_log_points),
  exchange_rate_change_log_points: numeric(row.exchange_rate_change_log_points),
});
const mapOecd = (row) => ({
  period: text(row.period, "a period"),
  reference_area_code: text(row.reference_area_code, "an area code"),
  reference_area_name: text(row.reference_area_name, "an area name"),
  reference_area_kind: text(row.reference_area_kind, "an area kind"),
  gdp_per_capita_ppp_current_usd: numeric(row.gdp_per_capita_ppp_current_usd),
  gdp_per_capita_ppp_constant_2020_usd: numeric(row.gdp_per_capita_ppp_constant_2020_usd),
  gdp_volume_growth_pct: numeric(row.gdp_volume_growth_pct),
});
const mapDrivers = (row) => ({
  period: text(row.period, "a period"),
  reference_area_code: text(row.reference_area_code, "an area code"),
  reference_area_name: text(row.reference_area_name, "an area name"),
  reference_area_kind: text(row.reference_area_kind, "an area kind"),
  gdp_per_capita_ppp_current_usd: numeric(row.gdp_per_capita_ppp_current_usd),
  gdp_per_capita_ppp_constant_2020_usd: numeric(row.gdp_per_capita_ppp_constant_2020_usd),
  gdp_per_hour_ppp_current_usd: numeric(row.gdp_per_hour_ppp_current_usd),
  gdp_per_hour_ppp_constant_2020_usd: numeric(row.gdp_per_hour_ppp_constant_2020_usd),
  hours_per_worker: numeric(row.hours_per_worker),
  employment_per_capita: numeric(row.employment_per_capita),
  labour_input_is_plausible: flag(row.labour_input_is_plausible),
});
const mapShare = (row) => ({
  period: text(row.period, "a period"),
  iso3_code: text(row.iso3_code, "an ISO3 code"),
  series_kind: text(row.series_kind, "a series kind"),
  share_of_population_pct: required(row.share_of_population_pct, "a working-age share"),
});
const mapGeometry = (row) => ({
  departement_code: text(row.departement_code, "a departement code"),
  departement_name: text(row.departement_name, "a departement name"),
  region_code: text(row.region_code, "a region code"),
  geometry_geojson: text(row.geometry_geojson, "a boundary"),
  bbox_west: required(row.bbox_west, "a bounding box"),
  bbox_south: required(row.bbox_south, "a bounding box"),
  bbox_east: required(row.bbox_east, "a bounding box"),
  bbox_north: required(row.bbox_north, "a bounding box"),
});
const mapDepartement = (row) => ({
  period: text(row.period, "a period"),
  departement_code: text(row.departement_code, "a departement code"),
  departement_name: text(row.departement_name, "a departement name"),
  gdp_per_inhabitant_eur: numeric(row.gdp_per_inhabitant_eur),
  gdp_per_inhabitant_index_france: numeric(row.gdp_per_inhabitant_index_france),
  france_gdp_per_inhabitant_eur: required(row.france_gdp_per_inhabitant_eur, "France's GDP per inhabitant"),
  is_provisional: Boolean(row.is_provisional),
});

// ---- Boundary simplification (a design decision, applied in row mapping). ----

/**
 * Douglas–Peucker at 0.45 px of a 560 px metropolitan map, rings under
 * 1.2 px dropped. The tolerance is expressed in degrees from the metropolitan
 * extent the rows themselves carry, so it follows the geometry rather than a
 * constant. Insets are drawn several times larger than the main map, so their
 * shapes keep a fifth of the tolerance.
 */
const MAP_SIZE = 560;
const SIMPLIFY_PX = 0.45;
const MIN_RING_PX = 1.2;
const INSET_FACTOR = 5;
// The inner ring drawn as an inset beside the map: Paris, Hauts-de-Seine,
// Seine-Saint-Denis and Val-de-Marne. Overseas departements carry INSEE codes
// of three digits beginning 97.
export const INNER_RING = Object.freeze(["75", "92", "93", "94"]);
const isOverseas = (code) => /^97\d$/.test(code);

function simplifyLine(points, tolerance) {
  if (points.length < 4) return points;
  const [x1, y1] = points[0], [x2, y2] = points.at(-1);
  const dx = x2 - x1, dy = y2 - y1, norm = Math.hypot(dx, dy);
  let best = 0, index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i];
    const distance = norm > 1e-12 ? Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm : Math.hypot(px - x1, py - y1);
    if (distance > best) { best = distance; index = i; }
  }
  if (best > tolerance) {
    return simplifyLine(points.slice(0, index + 1), tolerance).slice(0, -1).concat(simplifyLine(points.slice(index), tolerance));
  }
  return [points[0], points.at(-1)];
}

export function simplifyBoundaries(rows) {
  const metro = rows.filter((row) => !isOverseas(row.departement_code));
  const aspect = Math.cos((46.5 * Math.PI) / 180);
  const west = Math.min(...metro.map((row) => row.bbox_west)), east = Math.max(...metro.map((row) => row.bbox_east));
  const south = Math.min(...metro.map((row) => row.bbox_south)), north = Math.max(...metro.map((row) => row.bbox_north));
  // Degrees per pixel on the metropolitan frame, in longitude scaled by the
  // cosine of the mean latitude, which is how the map projects.
  const degreesPerPixel = Math.max((east - west) * aspect, north - south) / (MAP_SIZE - 20);
  return rows.map((row) => {
    const factor = INNER_RING.includes(row.departement_code) || isOverseas(row.departement_code) ? INSET_FACTOR : 1;
    const tolerance = (SIMPLIFY_PX * degreesPerPixel) / factor;
    const minimum = (MIN_RING_PX * degreesPerPixel) / factor;
    let geometry;
    try {
      geometry = JSON.parse(row.geometry_geojson);
    } catch (error) {
      throw new DataClientError("schema", "A departement boundary is not valid GeoJSON.", error);
    }
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : null;
    if (!polygons) throw new DataClientError("schema", "A departement boundary is not a polygon.");
    const kept = [];
    for (const polygon of polygons) {
      const outer = polygon[0].map(([lon, lat]) => [lon * aspect, lat]);
      const xs = outer.map((point) => point[0]), ys = outer.map((point) => point[1]);
      if (Math.max(...xs) - Math.min(...xs) < minimum && Math.max(...ys) - Math.min(...ys) < minimum) continue;
      const simple = simplifyLine(outer, tolerance);
      if (simple.length >= 3) kept.push([simple.map(([x, lat]) => [x / aspect, lat])]);
    }
    return { ...row, geometry: { type: "MultiPolygon", coordinates: kept } };
  });
}

// ---- The report. ----

export function renderFrenchGdpReport({ client = getPageDataClient(), statusClient = getPageStatusClient(), scenario, now = () => new Date() } = {}) {
  const activeClient = scenarioClient(client, scenario);
  const activeStatus = scenarioStatus(statusClient, scenario);
  const root = element("div", undefined, "pulse-report gdp-report");
  const header = element("header");
  header.append(element("p", "Pulse standing report", "eyebrow"), element("h1", "French GDP"));
  const edges = element("dl");
  header.append(edges);

  const controls = element("section", undefined, "exploration");
  controls.setAttribute("aria-label", "Report controls");
  const content = element("div", undefined, "report-content");
  const footer = element("footer", undefined, "gdp-footer");
  footer.append(element("span", "Figures render from the published datasets; no value on this page is written into its text."));
  root.append(header, controls, content, footer);

  const state = {
    preset: "all",
    from: FIRST_YEAR,
    to: FIRST_YEAR + 1,
    year: FIRST_YEAR,
    lastAnnual: FIRST_YEAR,
    lastQuarterYear: FIRST_YEAR,
    mode: "total",
    scale: "linear",
    path: [],
    comparators: [...DEFAULT_COMPARATORS],
    showAggregate: true,
    departement: "75",
    controlsOpen: false,
    members: [],
    lastEstimate: null,
  };

  const shells = new Map();
  const headControls = element("div", undefined, "fig-controls");
  for (const definition of SECTIONS) {
    const section = element("section", undefined, "fig");
    const heading = element("h2", definition.heading);
    heading.id = `h-${definition.id}`;
    section.setAttribute("aria-labelledby", heading.id);
    section.dataset.figure = definition.id;
    if (definition.id === "output-growth-tail") {
      const head = element("div", undefined, "fig-head");
      head.append(heading, headControls);
      section.append(head);
    } else {
      section.append(heading);
    }
    if (definition.lede) section.append(element("p", definition.lede, "lede"));
    const body = element("div", undefined, "figure-body");
    body.dataset.slot = definition.id;
    section.append(body);
    shells.set(definition.id, body);
    content.append(section);
  }

  let datasets = {};

  // Each query is keyed on the parameters it was given; only a query whose
  // parameters changed reaches the client. Moving the selected year re-reads
  // nothing: it changes which point is marked, not which rows were asked for.
  const rowCache = new Map();
  const query = (datasetId, key, params, mapRow) => {
    const cacheKey = JSON.stringify([datasetId, key, params]);
    const cached = rowCache.get(cacheKey);
    if (cached) return cached;
    const pendingRows = activeClient
      .query(datasetId, QUERIES[key], { params, expectedColumns: COLUMNS[key], mapRow })
      // A failed query is not cached: retry has to be able to reach the engine.
      .catch((error) => { rowCache.delete(cacheKey); throw error; });
    rowCache.set(cacheKey, pendingRows);
    return pendingRows;
  };
  const windowParams = (first = FIRST_YEAR) => [dateOf(Math.max(first, state.from)), endOf(state.to)];

  const common = (target) => ({ width: plotWidth(target), from: state.from, to: state.to, selectedYear: state.year });
  const sectionOf = (id) => SECTIONS.find((definition) => definition.id === id);
  const seamYear = () => state.lastQuarterYear - TAIL_YEARS;

  const comparatorSeries = () => state.comparators.map((code, index) => ({ code, colour: PALETTE[index % PALETTE.length] }));

  const mounts = {
    "output-growth-tail": (body) => runReportSlot({
      element: body,
      query: async () => {
        const [annual, quarters] = await Promise.all([
          query(DATASETS.annual, "annual-output", windowParams(), mapAnnual),
          query(DATASETS.quarterly, "quarterly-output", windowParams(), mapQuarterly),
        ]);
        pending.quarters = quarters;
        return annual;
      },
      render: (annual, target) => {
        if (scenario === "render") throw new Error("A deliberate render failure for the state treatment.");
        const quarters = pending.quarters ?? [];
        const tail = quarters.filter((row) => yearOf(row.period) >= seamYear());
        const rows = annual.map((row) => ({
          kind: "annual",
          period: row.period,
          gdp_volume_eur_bn: row.gdp_chained_2020_eur_mn / 1000,
          growth_pct: row.gdp_volume_growth_pct,
          quarter_on_quarter_pct: null,
          gdp_per_capita_chained_eur: row.gdp_per_capita_chained_2020_eur,
        })).concat(tail.map((row) => ({
          kind: "quarter",
          period: row.period,
          gdp_volume_eur_bn: row.gdp_chained_annualised_eur_mn / 1000,
          growth_pct: row.gdp_year_on_year_growth_pct,
          quarter_on_quarter_pct: row.gdp_quarterly_growth_pct,
          gdp_per_capita_chained_eur: null,
        })));
        const definition = sectionOf("output-growth-tail");
        target.replaceChildren(
          headlineTiles(annual, quarters),
          renderOutputGrowthTail(rows, {
            ...common(target), mode: state.mode, scale: state.scale, seamStart: dateOf(seamYear()), notes: definition.notes,
          }, definition.provenance),
        );
      },
      retry: () => mount("output-growth-tail"),
    }),

    "demand-contribution-bars": (body) => runReportSlot({
      element: body,
      query: () => query(DATASETS.annual, "demand-contributions", windowParams(), mapDemand),
      render: (rows, target) => {
        // Households are merged with the institutions serving them, and
        // inventories with valuables: the stack stays additive and loses two
        // slivers too thin to read. The first year has no growth to explain.
        const mapped = rows.filter((row) => row.gdp_volume_growth_pct !== null).map((row) => ({
          period: row.period,
          households_pt: merged(row.contribution_household_consumption_pt, row.contribution_npish_consumption_pt),
          government_pt: row.contribution_government_consumption_pt,
          investment_pt: row.contribution_gfcf_pt,
          inventories_pt: merged(row.contribution_inventories_pt, row.contribution_valuables_pt),
          net_trade_pt: row.contribution_net_trade_pt,
          gdp_growth_pct: row.gdp_volume_growth_pct,
        }));
        if (!mapped.length) throw new DataClientError("empty", "No contributions are published in the represented period.");
        const definition = sectionOf("demand-contribution-bars");
        target.replaceChildren(renderDemandContributionBars(mapped, { ...common(target), notes: definition.notes }, definition.provenance));
      },
      retry: () => mount("demand-contribution-bars"),
    }),

    "branch-share-panels": (body) => runReportSlot({
      element: body,
      query: () => query(DATASETS.branches, "branch-shares", [], mapBranch),
      render: (rows, target) => {
        const definition = sectionOf("branch-share-panels");
        target.replaceChildren(renderBranchSharePanels(rows, { ...common(target), path: state.path, notes: definition.notes }, definition.provenance));
      },
      retry: () => mount("branch-share-panels"),
    }),

    "income-share-panels": (body) => runReportSlot({
      element: body,
      query: () => query(DATASETS.annual, "income-shares", windowParams(), mapIncome),
      render: (rows, target) => {
        const share = (value, row) => (100 * value) / row.gdp_current_eur_mn;
        const mapped = rows.map((row) => ({
          period: row.period,
          labour_share_pct: share(row.adjusted_labour_income_eur_mn, row),
          capital_share_pct: share(row.adjusted_capital_income_eur_mn, row),
          taxes_on_production_share_pct: share(row.net_taxes_on_production_eur_mn, row),
          taxes_on_products_share_pct: share(row.net_taxes_on_products_eur_mn, row),
          compensation_share_pct: row.unadjusted_wage_share_pct,
        }));
        const definition = sectionOf("income-share-panels");
        target.replaceChildren(renderIncomeSharePanels(mapped, { ...common(target), notes: definition.notes }, definition.provenance));
      },
      retry: () => mount("income-share-panels"),
    }),

    "dollar-decomposition": (body) => runReportSlot({
      element: body,
      query: () => query(DATASETS.dollar, "dollar-gdp", windowParams(), mapDollar),
      render: (rows, target) => {
        const mapped = rows.map((row) => ({
          period: row.period,
          gdp_current_usd_bn: row.gdp_current_usd_mn / 1000,
          gdp_constant_usd_bn: row.gdp_constant_usd_mn / 1000,
          constant_usd_base_year: row.constant_usd_base_year,
          eur_per_usd: row.eur_per_usd,
          dollar_change_pct: row.dollar_gdp_change_pct,
          dollar_change_log_points: row.dollar_gdp_change_log_points,
          real_growth_log_points: row.real_growth_log_points,
          deflator_change_log_points: row.deflator_change_log_points,
          exchange_rate_change_log_points: row.exchange_rate_change_log_points,
        }));
        const definition = sectionOf("dollar-decomposition");
        target.replaceChildren(renderDollarDecomposition(mapped, { ...common(target), notes: definition.notes }, definition.provenance));
      },
      retry: () => mount("dollar-decomposition"),
    }),

    "oecd-standing": (body) => runReportSlot({
      element: body,
      query: () => query(DATASETS.oecd, "oecd-standing", [], mapOecd),
      render: (rows, target) => {
        const definition = sectionOf("oecd-standing");
        target.replaceChildren(renderOecdStanding(rows, {
          ...common(target), france: FRANCE, comparators: comparatorSeries(),
          aggregate: state.showAggregate ? AGGREGATE : null, notes: definition.notes,
        }, definition.provenance));
      },
      retry: () => mount("oecd-standing"),
    }),

    "per-capita-drivers": (body) => runReportSlot({
      element: body,
      query: async () => {
        const params = windowParams(OECD_FIRST_YEAR);
        const [spine, shares] = await Promise.all([
          query(DATASETS.oecd, "productivity-drivers", params, mapDrivers),
          query(DATASETS.ageStructure, "working-age-share", params, mapShare),
        ]);
        // The UN share joins by ISO3 code and year; an aggregate has none.
        const shareBy = new Map(shares.map((row) => [`${row.iso3_code}|${yearOf(row.period)}`, row]));
        return spine.map((row) => {
          const share = shareBy.get(`${row.reference_area_code}|${yearOf(row.period)}`);
          return {
            ...row,
            working_age_share: share ? share.share_of_population_pct / 100 : null,
            working_age_share_is_projection: share ? share.series_kind === "projection" : null,
          };
        });
      },
      render: (rows, target) => {
        const definition = sectionOf("per-capita-drivers");
        target.replaceChildren(renderPerCapitaDrivers(rows, {
          ...common(target), france: FRANCE, comparators: comparatorSeries(),
          aggregate: state.showAggregate ? AGGREGATE : null,
          baseYear: Math.max(state.from, OECD_FIRST_YEAR),
          notes: definition.notes.map((note) => ({ ...note, text: note.text.replace("{lastEstimate}", String(state.lastEstimate ?? "the last estimated year")) })),
        }, definition.provenance));
      },
      retry: () => mount("per-capita-drivers"),
    }),

    "index-choropleth": (body) => runReportSlot({
      element: body,
      query: async () => {
        const [boundaries, figures] = await Promise.all([
          query(DATASETS.geometry, "departement-geometry", [], mapGeometry),
          query(DATASETS.departements, "departement-gdp", [], mapDepartement),
        ]);
        pending.simplified ??= new WeakMap();
        let simplified = pending.simplified.get(boundaries);
        if (!simplified) {
          simplified = simplifyBoundaries(boundaries);
          pending.simplified.set(boundaries, simplified);
        }
        // The boundaries are the spine: a departement with no figure still
        // renders, as not published.
        const byCode = new Map();
        for (const row of figures) {
          const list = byCode.get(row.departement_code) ?? [];
          list.push({
            period: row.period,
            gdp_per_inhabitant_eur: row.gdp_per_inhabitant_eur,
            gdp_per_inhabitant_index_france: row.gdp_per_inhabitant_index_france,
            france_gdp_per_inhabitant_eur: row.france_gdp_per_inhabitant_eur,
            is_provisional: row.is_provisional,
          });
          byCode.set(row.departement_code, list);
        }
        return simplified.map((row) => ({
          departement_code: row.departement_code,
          departement_name: figures.find((item) => item.departement_code === row.departement_code)?.departement_name ?? row.departement_name,
          geometry: row.geometry,
          inset: INNER_RING.includes(row.departement_code) ? "inner-ring" : isOverseas(row.departement_code) ? "overseas" : null,
          series: byCode.get(row.departement_code) ?? [],
        }));
      },
      render: (rows, target) => {
        const definition = sectionOf("index-choropleth");
        target.replaceChildren(renderIndexChoropleth(rows, {
          ...common(target), selectedDepartement: state.departement, notes: definition.notes,
        }, definition.provenance));
      },
      retry: () => mount("index-choropleth"),
    }),
  };

  const pending = {};

  /** The five headline tiles follow the selected year. */
  function headlineTiles(annual, quarters) {
    const year = state.year;
    const row = annual.find((item) => yearOf(item.period) === year);
    const inYear = quarters.filter((item) => yearOf(item.period) === year);
    const last = inYear.at(-1) ?? null;
    const noAnnual = `annual accounts end in ${state.lastAnnual}`;
    const quarterName = (item) => `${yearOf(item.period)}-Q${quarterOf(item.period)}`;
    const tiles = [
      ["GDP at constant 2020 prices", row ? `${grouped(row.gdp_chained_2020_eur_mn / 1000, 0)} bn €` : "—", row ? `${year}, chained volume` : noAnnual],
      ["Real GDP growth", row && row.gdp_volume_growth_pct !== null ? signedGrouped(row.gdp_volume_growth_pct, 1, " %") : "—",
        row ? (row.gdp_volume_growth_pct === null ? "first year of the series" : `${year} on ${year - 1}`) : noAnnual],
      ["GDP per inhabitant at constant 2020 prices", row ? `${grouped(row.gdp_per_capita_chained_2020_eur, 0)} €` : "—", row ? `${year}, chained volume` : noAnnual],
      ["Last quarter of the year, on the previous quarter", last && last.gdp_quarterly_growth_pct !== null ? signedGrouped(last.gdp_quarterly_growth_pct, 1, " %") : "—",
        last ? quarterName(last) : `no quarter published for ${year}`],
      ["Last quarter of the year, on a year earlier", last && last.gdp_year_on_year_growth_pct !== null ? signedGrouped(last.gdp_year_on_year_growth_pct, 1, " %") : "—",
        last ? quarterName(last) : `no quarter published for ${year}`],
    ];
    const grid = element("div", undefined, "tiles");
    for (const [key, value, period] of tiles) {
      const tile = element("div", undefined, "tile");
      tile.append(element("span", key, "k"), element("span", value, "val"), element("span", period, "per"));
      grid.append(tile);
    }
    return grid;
  }

  function plotWidth(target) {
    // The width the container actually has, floored: rounding up gives the
    // figure a pixel it does not have and a scrollbar under every chart. The
    // fallback is for a detached element, which measures zero.
    const measured = Math.floor(target.getBoundingClientRect().width);
    return measured > 0 ? Math.max(280, measured) : 1188;
  }

  /**
   * Every figure emits the same events; the report decides what they select.
   * `pulse-select` carries a year, `pulse-branch-path` the open branches and
   * `pulse-select-area` a departement code.
   */
  for (const [id, body] of shells) {
    body.addEventListener("pulse-select", (event) => {
      const year = Number(event.detail?.year);
      if (Number.isFinite(year)) setYear(year);
    });
    if (id === "branch-share-panels") {
      body.addEventListener("pulse-branch-path", (event) => {
        if (!Array.isArray(event.detail?.path)) return;
        state.path = event.detail.path.map(String);
        mountAll(["branch-share-panels"]);
      });
    }
    if (id === "index-choropleth") {
      body.addEventListener("pulse-select-area", (event) => {
        const code = event.detail?.code;
        if (typeof code !== "string" || code === state.departement) return;
        state.departement = code;
        mountAll(["index-choropleth"]);
      });
    }
  }

  const renderedWidth = new Map();

  function mount(id) {
    const body = shells.get(id);
    if (!body) return Promise.resolve(null);
    renderedWidth.set(id, plotWidth(body));
    return mounts[id](body);
  }

  /** Redraw a figure whose container changed width; its rows are cached. */
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

  function mountAll(ids = SECTIONS.map((definition) => definition.id)) {
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
    drawControls();
    mountAll();
  }

  function setWindow(from, to, preset) {
    state.from = Math.max(FIRST_YEAR, Math.min(from, to));
    state.to = Math.min(state.lastQuarterYear, Math.max(to, from));
    state.preset = preset;
    state.year = Math.max(state.from, Math.min(state.to, state.year));
    drawControls();
    mountAll();
  }

  function setComparators(next) {
    state.comparators = next;
    drawControls();
    mountAll(["oecd-standing", "per-capita-drivers"]);
  }

  function segmented(name, label, options, current, onPick) {
    const group = element("div", undefined, "seg-group");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", label);
    for (const [key, text] of options) {
      const item = element("label", undefined, current === key ? "seg on" : "seg");
      const input = element("input");
      input.type = "radio";
      input.name = `french-gdp-${name}`;
      input.checked = current === key;
      input.dataset.control = `${name}-${key}`;
      input.addEventListener("change", () => onPick(key));
      item.append(input, element("span", text));
      group.append(item);
    }
    return group;
  }

  function yearSelect(label, value, years, control, onChange) {
    const select = element("select");
    select.dataset.control = control;
    select.setAttribute("aria-label", label);
    for (const year of years) {
      const option = element("option", String(year));
      option.value = String(year);
      select.append(option);
    }
    select.value = String(value);
    select.addEventListener("change", () => onChange(Number(select.value)));
    return select;
  }

  function range(from, to) {
    const years = [];
    for (let year = from; year <= to; year += 1) years.push(year);
    return years;
  }

  function drawControls() {
    const view = captureView(root);
    controls.replaceChildren();
    controls.classList.toggle("collapsed", !state.controlsOpen);

    // Below 780px the row folds into a disclosure that stays sticky when open.
    const toggle = element("button", "Period, selected year and comparison", "controls-toggle");
    toggle.type = "button";
    toggle.dataset.control = "controls-toggle";
    toggle.setAttribute("aria-expanded", String(state.controlsOpen));
    toggle.addEventListener("click", () => { state.controlsOpen = !state.controlsOpen; drawControls(); });

    const periodField = element("fieldset");
    periodField.append(element("legend", "Represented period"));
    const periodLine = element("div", undefined, "control-line");
    const last = state.lastQuarterYear;
    const presets = [["all", "Since 1949", FIRST_YEAR], ["since-1970", "Since 1970", 1970], ["twenty-five", "25 years", last - 24], ["ten", "10 years", last - 9]];
    periodLine.append(segmented("period", "Represented period presets", presets.map(([key, label]) => [key, label]), state.preset,
      (key) => setWindow(presets.find((item) => item[0] === key)[2], last, key)));
    const fromLabel = element("label");
    fromLabel.append(element("span", "From"), yearSelect("Represented period start year", state.from, range(FIRST_YEAR, state.to), "period-from",
      (value) => setWindow(value, state.to, "custom")));
    const toLabel = element("label");
    toLabel.append(element("span", "To"), yearSelect("Represented period end year", state.to, range(state.from, last), "period-to",
      (value) => setWindow(state.from, value, "custom")));
    periodLine.append(fromLabel, toLabel);
    periodField.append(periodLine);

    const yearField = element("fieldset");
    yearField.append(element("legend", "Selected year — or click any figure"));
    const yearLine = element("div", undefined, "control-line year-line");
    const previous = element("button", "‹", "b");
    previous.type = "button";
    previous.dataset.control = "year-previous";
    previous.setAttribute("aria-label", "Previous year");
    previous.addEventListener("click", () => setYear(state.year - 1));
    const next = element("button", "›", "b");
    next.type = "button";
    next.dataset.control = "year-next";
    next.setAttribute("aria-label", "Next year");
    next.addEventListener("click", () => setYear(state.year + 1));
    yearLine.append(previous, yearSelect("Selected year", state.year, range(state.from, state.to), "observation-year", setYear), next);
    yearField.append(yearLine);

    const compareField = element("fieldset", undefined, "compare-field");
    compareField.append(element("legend", "Compared with"));
    const compareLine = element("div", undefined, "control-line compare-line");
    const france = element("span", undefined, "chip fixed");
    france.title = "France";
    const franceSwatch = element("i");
    franceSwatch.style.background = FRANCE.colour;
    france.append(franceSwatch, document.createTextNode(FRANCE.code));
    compareLine.append(france);
    const names = new Map(state.members.map((member) => [member.code, member.name]));
    comparatorSeries().forEach(({ code, colour }) => {
      const chip = element("span", undefined, "chip");
      chip.title = names.get(code) ?? code;
      const swatch = element("i");
      swatch.style.background = colour;
      const remove = element("button", "✕");
      remove.type = "button";
      remove.dataset.control = `remove-${code}`;
      remove.setAttribute("aria-label", `Remove ${names.get(code) ?? code}`);
      remove.addEventListener("click", () => setComparators(state.comparators.filter((item) => item !== code)));
      chip.append(swatch, document.createTextNode(code), remove);
      compareLine.append(chip);
    });
    const add = element("select", undefined, "add");
    add.dataset.control = "add-comparator";
    add.setAttribute("aria-label", "Add an OECD member to the comparison");
    const placeholder = element("option", "+ Add…");
    placeholder.value = "";
    add.append(placeholder);
    for (const member of state.members) {
      if (member.code === FRANCE.code || state.comparators.includes(member.code)) continue;
      const option = element("option", member.name);
      option.value = member.code;
      add.append(option);
    }
    add.addEventListener("change", () => { if (add.value) setComparators([...state.comparators, add.value]); });
    compareLine.append(add);
    const reference = element("label", undefined, state.showAggregate ? "chip ref on" : "chip ref");
    reference.title = "OECD total as reference";
    const referenceInput = element("input");
    referenceInput.type = "checkbox";
    referenceInput.checked = state.showAggregate;
    referenceInput.dataset.control = "oecd-reference";
    referenceInput.setAttribute("aria-label", "OECD total as reference");
    referenceInput.addEventListener("change", () => {
      state.showAggregate = referenceInput.checked;
      drawControls();
      mountAll(["oecd-standing", "per-capita-drivers"]);
    });
    reference.append(referenceInput, element("i"), document.createTextNode("OECD"));
    compareLine.append(reference);
    compareField.append(compareLine);

    controls.append(toggle, periodField, yearField, compareField);

    headControls.replaceChildren(
      segmented("measure", "Headline measure", [["total", "Total"], ["capita", "Per inhabitant"]], state.mode,
        (key) => { state.mode = key; drawControls(); mountAll(["output-growth-tail"]); }),
      segmented("scale", "Level scale", [["linear", "Linear scale"], ["log", "Log scale"]], state.scale,
        (key) => { state.scale = key; drawControls(); mountAll(["output-growth-tail"]); }),
    );
    restoreView(root, view);
  }

  function drawEdges(branchRows) {
    // The qualification line is health, not an edition: it survives a redraw.
    const qualification = [...edges.querySelectorAll("[data-qualification]")];
    edges.replaceChildren();
    const end = (id) => datasets[id]?.representedPeriod?.end ?? "";
    const quarter = (period) => `${yearOf(period)}-Q${quarterOf(period)}`;
    const levelEnd = (level) => {
      const years = branchRows.filter((row) => row.level === level).map((row) => yearOf(row.period));
      return years.length ? Math.max(...years) : null;
    };
    const broadEnd = levelEnd("A10") === null || levelEnd("A38") === null ? null : Math.min(levelEnd("A10"), levelEnd("A38"));
    const detailEnd = levelEnd("A88");
    const lag = broadEnd === null || detailEnd === null ? null : broadEnd - detailEnd;
    const detail = lag === 0 ? "A88 to the same year" : lag === 1 ? "A88 a year earlier" : `A88 to ${detailEnd ?? "—"}`;
    const families = [
      ["INSEE annual accounts", String(yearOf(end(DATASETS.annual)))],
      ["INSEE quarterly accounts", quarter(end(DATASETS.quarterly))],
      ["Branch detail", broadEnd === null ? "—" : `A10/A38 to ${broadEnd} · ${detail}`],
      ["World Bank", String(yearOf(end(DATASETS.dollar)))],
      ["OECD productivity", String(yearOf(end(DATASETS.oecd)))],
      ["UN population by age", state.lastEstimate === null ? "—" : `estimates to ${state.lastEstimate}, projections after`],
      ["Eurostat regions", String(yearOf(end(DATASETS.departements)))],
    ];
    for (const [term, detailText] of families) {
      const group = element("div");
      group.append(element("dt", term), element("dd", detailText));
      edges.append(group);
    }
    edges.append(...qualification);
  }

  /**
   * Suspect, stale or failed lineage qualifies the figures it reaches: each
   * affected figure carries a named cue above its body, and the header carries
   * the qualification line. Health that cannot be read leaves the page exactly
   * as published. Staleness resolves against the reader's clock.
   */
  const QUALIFICATION_CUES = Object.freeze({
    suspect: ["Suspect", "Drawn, but the source failed a plausibility check."],
    stale: ["Stale", "Past its expected release: a newer observation was due."],
    failed: ["Failed", "The latest run failed; the retained publication is shown."],
  });
  async function loadQualification() {
    let qualification = null;
    try {
      const [status, reports] = await Promise.all([activeStatus.status(), activeStatus.reports()]);
      qualification = qualifyReport({ status, reports, reportId: REPORT_ID, now: now() });
    } catch {
      qualification = null;
    }
    for (const previous of root.querySelectorAll("[data-qualification]")) previous.remove();
    if (!qualification) return;
    const line = element("div");
    line.dataset.qualification = qualification.state;
    line.append(element("dt", "Data qualification"), element("dd", qualificationLine(qualification)));
    edges.append(line);
    const [label, text] = QUALIFICATION_CUES[qualification.state] ?? ["Qualified", "The source's latest run needs attention."];
    for (const figure of qualification.figures) {
      const definition = SECTIONS[figure - 1];
      const body = definition && shells.get(definition.id);
      if (!body) continue;
      const cue = element("p", undefined, "warn qualification");
      cue.dataset.qualification = qualification.state;
      cue.setAttribute("role", "status");
      // A shape cue beside the named one, never colour alone: a triangle for
      // a qualified reading, a cross for a failed run.
      const icon = document.createElementNS(NS, "svg");
      icon.setAttribute("width", "14");
      icon.setAttribute("height", "14");
      icon.setAttribute("viewBox", "0 0 14 14");
      icon.setAttribute("aria-hidden", "true");
      const shape = document.createElementNS(NS, "path");
      shape.setAttribute("d", qualification.state === "failed" ? "M2 2 L12 12 M12 2 L2 12" : "M7 1 L13 13 L1 13 Z");
      shape.setAttribute("fill", "none");
      shape.setAttribute("stroke", "currentColor");
      shape.setAttribute("stroke-width", "2");
      icon.append(shape);
      const name = element("b");
      name.append(icon, document.createTextNode(` ${label}`));
      cue.append(name, element("span", text));
      body.before(cue);
    }
  }

  const load = () => {
    setAccessibleState(content, "loading", "Loading the report…");
    Promise.all(Object.values(DATASETS).map((id) => activeClient.getDataset(id)))
      .then(async (loaded) => {
        datasets = Object.fromEntries(Object.values(DATASETS).map((id, index) => [id, loaded[index]]));
        state.lastAnnual = yearOf(datasets[DATASETS.annual].representedPeriod.end);
        state.lastQuarterYear = yearOf(datasets[DATASETS.quarterly].representedPeriod.end);
        state.to = state.lastQuarterYear;
        state.year = state.lastAnnual;
        drawEdges([]);
        drawControls();
        setAccessibleState(content, "ready", null);
        // The header, the member list and the projection note read rows the
        // figures read too, so the cache serves them to both. They never hold
        // a figure back: each figure mounts at once and states its own load.
        const context = Promise.all([
          query(DATASETS.branches, "branch-shares", [], mapBranch).catch(() => []),
          query(DATASETS.ageStructure, "working-age-share", windowParams(OECD_FIRST_YEAR), mapShare).catch(() => []),
          query(DATASETS.oecd, "oecd-standing", [], mapOecd).catch(() => []),
        ]).then(([branchRows, shareRows, areas]) => {
          const members = new Map();
          for (const row of areas) {
            if (row.reference_area_kind === "member") members.set(row.reference_area_code, row.reference_area_name);
          }
          state.members = [...members].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, "en"));
          const estimates = shareRows.filter((row) => row.series_kind === "estimate").map((row) => yearOf(row.period));
          state.lastEstimate = estimates.length ? Math.max(...estimates) : null;
          drawEdges(branchRows);
          drawControls();
          if (state.lastEstimate !== null) mountAll(["per-capita-drivers"]);
        });
        await Promise.all([mountAll(), context, loadQualification()]);
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

/**
 * Pipeline-status scenarios for this report's own datasets. Degraded states
 * only: a shared link must never be able to claim healthy data it does not
 * have. The report catalog stays the published one, because mapping an
 * assertion's columns to figures is what these scenarios exercise.
 */
function scenarioStatus(client, scenario) {
  const annual = { period: "annual", expectedWithinDays: 150, graceDays: 30 };
  const entry = (datasetId, state, end, assertions = []) => ({
    pipelineId: `dataset:${datasetId}`, kind: "dataset", name: datasetId, state, stages: [],
    representedPeriod: { start: "1949-01-01", end }, schedule: annual, assertions,
    latestUsableOutput: { artifactKind: "dataset", identity: "scenario", representedPeriod: { start: "1949-01-01", end } },
  });
  const catalog = (pipelines) => ({ schemaId: "pulse.status", schemaVersion: "1.0.0", pipelines: Object.fromEntries(pipelines.map((item) => [item.pipelineId, item])) });
  if (scenario === "status-suspect") {
    return { status: async () => catalog([entry("french-branch-value-added", "suspect", "2025-12-31",
      [{ check: "plausibility", affectedColumns: ["share_of_total_value_added_pct"] }])]), reports: () => client.reports() };
  }
  // A represented period long past its declared release: the reader's clock,
  // not the artifact, is what makes it stale.
  if (scenario === "status-stale") {
    return { status: async () => catalog([entry("french-gdp-dollar-decomposition", "succeeded", "2019-12-31")]), reports: () => client.reports() };
  }
  return client;
}

/** Deterministic scenarios for the state treatments, never a production path. */
function scenarioClient(client, scenario) {
  if (!scenario) return client;
  const dataset = {
    representedPeriod: { start: "1949-01-01", end: "2025-12-31" },
    semanticMetadata: { indicators: [] },
  };
  const fail = (code, message) => async () => { throw new DataClientError(code, message); };
  if (scenario === "loading") return { getDataset: async () => dataset, query: () => new Promise(() => {}) };
  if (scenario === "empty") return { getDataset: async () => dataset, query: async () => [] };
  if (scenario === "startup") return { getDataset: fail("wasm-startup", "Browser data access could not start."), query: fail("wasm-startup", "Browser data access could not start.") };
  if (scenario === "query") return { getDataset: async () => dataset, query: fail("query", "The report data could not be queried.") };
  // Rows of the wrong shape pass through the report's own row mapping, which
  // is where an incompatible table is caught.
  if (scenario === "schema") return { getDataset: async () => dataset, query: async (id, sql, { mapRow } = {}) => [{ period: null, gdp_chained_2020_eur_mn: "invalid" }].map(mapRow ?? ((row) => row)) };
  if (scenario === "slot-query") {
    // One dataset fails while every other slot keeps its data: the branch
    // figure is the only one that reads this table.
    return {
      getDataset: (id) => client.getDataset(id),
      query: (id, ...rest) => (id === DATASETS.branches
        ? Promise.reject(new DataClientError("query", "The query did not complete."))
        : client.query(id, ...rest)),
    };
  }
  return client;
}
