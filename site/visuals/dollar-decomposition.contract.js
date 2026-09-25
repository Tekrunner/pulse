/** Application-owned Visual Contract v1 declaration for dollar-decomposition.
 *
 * Two plots on one time axis: French GDP in current US dollars and in constant dollars at the provider's base year (teal), on one linear axis, then each year's change in log points as a stacked bar of its three terms (real growth, GDP deflator change, the euro against the dollar), with the net change in dollar GDP as a white tick so the sum is read without arithmetic. Each axis is the represented period intersected with the published span. The first published year has no change and draws no bar. Boundary rows: 1960 (no change), 1981 and 1986 (exchange rate −25 and +26 lp), 1998–1999 (converted franc rate), 2015, 2025. A data table below gives every year in the window, newest first; the approved artboard had none, and it is added as the accessible data equivalent.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases; the level is the published million-dollar amount divided by 1000. Source: World Bank, World Development Indicators (CC BY 4.0). Changes: francs converted at 6.55957 per euro; decomposition computed by Pulse.
 */

export const DOLLAR_DECOMPOSITION_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "dollar-decomposition",
  question: "How has French GDP measured in US dollars at market exchange rates evolved, and how much of each year's change comes from real growth, domestic price change and the euro-dollar exchange rate?",
  consumerSchema: Object.freeze({
    period: "string",  // YYYY-01-01
    gdp_current_usd_bn: "number",  // current US dollars, billions
    gdp_constant_usd_bn: "number",  // constant US dollars at the provider's base year, billions
    constant_usd_base_year: "number",  // that base year, the same in every row
    eur_per_usd: "number",  // annual-average market rate, francs converted at 6.55957
    dollar_change_pct: "number|null",  // null in the first published year
    dollar_change_log_points: "number|null",  // null in the first published year
    real_growth_log_points: "number|null",
    deflator_change_log_points: "number|null",
    exchange_rate_change_log_points: "number|null",
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",
    from: "number",  // represented period, first year
    to: "number",  // represented period, last year
    selectedYear: "number",
    notes: "array",  // report-owned named warnings, {label, text}
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "1960-01-01",
        "gdp_current_usd_bn": 61.9591,
        "gdp_constant_usd_bn": 510.9279,
        "constant_usd_base_year": 2015,
        "eur_per_usd": 0.75265,
        "dollar_change_pct": null,
        "dollar_change_log_points": null,
        "real_growth_log_points": null,
        "deflator_change_log_points": null,
        "exchange_rate_change_log_points": null
    },
    {
        "period": "1961-01-01",
        "gdp_current_usd_bn": 67.1581,
        "gdp_constant_usd_bn": 536.2006,
        "constant_usd_base_year": 2015,
        "eur_per_usd": 0.75265,
        "dollar_change_pct": 8.391,
        "dollar_change_log_points": 8.057,
        "real_growth_log_points": 4.828,
        "deflator_change_log_points": 3.229,
        "exchange_rate_change_log_points": 0.0
    },
    {
        "period": "1975-01-01",
        "gdp_current_usd_bn": 357.3243,
        "gdp_constant_usd_bn": 1075.9729,
        "constant_usd_base_year": 2015,
        "eur_per_usd": 0.653671,
        "dollar_change_pct": 26.379,
        "dollar_change_log_points": 23.412,
        "real_growth_log_points": -0.95,
        "deflator_change_log_points": 12.885,
        "exchange_rate_change_log_points": 11.484
    },
    {
        "period": "1981-01-01",
        "gdp_current_usd_bn": 609.1848,
        "gdp_constant_usd_bn": 1289.2617,
        "constant_usd_base_year": 2015,
        "eur_per_usd": 0.828501,
        "dollar_change_pct": -12.288,
        "dollar_change_log_points": -13.111,
        "real_growth_log_points": 1.181,
        "deflator_change_log_points": 10.868,
        "exchange_rate_change_log_points": -25.163
    },
    {
        "period": "1986-01-01",
        "gdp_current_usd_bn": 764.9466,
        "gdp_constant_usd_bn": 1413.251,
        "constant_usd_base_year": 2015,
        "eur_per_usd": 1.055876,
        "dollar_change_pct": 39.788,
        "dollar_change_log_points": 33.495,
        "real_growth_log_points": 2.361,
        "deflator_change_log_points": 5.107,
        "exchange_rate_change_log_points": 26.029
    },
    {
        "period": "1998-01-01",
        "gdp_current_usd_bn": 1496.9064,
        "gdp_constant_usd_bn": 1881.3506,
        "constant_usd_base_year": 2015,
        "eur_per_usd": 0.899375,
        "dollar_change_pct": 3.278,
        "dollar_change_log_points": 3.226,
        "real_growth_log_points": 3.394,
        "deflator_change_log_points": 0.904,
        "exchange_rate_change_log_points": -1.071
    },
    {
        "period": "1999-01-01",
        "gdp_current_usd_bn": 1486.9159,
        "gdp_constant_usd_bn": 1945.3035,
        "constant_usd_base_year": 2015,
        "eur_per_usd": 0.938283,
        "dollar_change_pct": -0.667,
        "dollar_change_log_points": -0.67,
        "real_growth_log_points": 3.343,
        "deflator_change_log_points": 0.22,
        "exchange_rate_change_log_points": -4.235
    },
    {
        "period": "2015-01-01",
        "gdp_current_usd_bn": 2442.4835,
        "gdp_constant_usd_bn": 2442.4835,
        "constant_usd_base_year": 2015,
        "eur_per_usd": 0.901296,
        "dollar_change_pct": -14.635,
        "dollar_change_log_points": -15.824,
        "real_growth_log_points": 1.061,
        "deflator_change_log_points": 1.128,
        "exchange_rate_change_log_points": -18.013
    },
    {
        "period": "2024-01-01",
        "gdp_current_usd_bn": 3160.4426,
        "gdp_constant_usd_bn": 2720.3623,
        "constant_usd_base_year": 2015,
        "eur_per_usd": 0.92389,
        "dollar_change_pct": 3.409,
        "dollar_change_log_points": 3.352,
        "real_growth_log_points": 1.183,
        "deflator_change_log_points": 2.066,
        "exchange_rate_change_log_points": 0.103
    },
    {
        "period": "2025-01-01",
        "gdp_current_usd_bn": 3366.3159,
        "gdp_constant_usd_bn": 2743.2392,
        "constant_usd_base_year": 2015,
        "eur_per_usd": 0.884969,
        "dollar_change_pct": 6.514,
        "dollar_change_log_points": 6.311,
        "real_growth_log_points": 0.837,
        "deflator_change_log_points": 1.169,
        "exchange_rate_change_log_points": 4.304
    }
]),
  cleanup: "none",
});

const CHANGES = Object.freeze(["dollar_change_pct", "dollar_change_log_points", "real_growth_log_points",
  "deflator_change_log_points", "exchange_rate_change_log_points"]);
const positive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const nullableNumber = (value) => value === null || (typeof value === "number" && Number.isFinite(value));

/**
 * Rejects rows that do not match the consumer schema: a first-of-year period,
 * positive current and constant levels, an integer base year, a positive rate, and either no change at all or all five change
 * values with the three terms adding up to the dollar change within 0.1 lp,
 * since the tick is drawn where the stacked terms end.
 */
export function validateDollarDecompositionRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const changes = CHANGES.map((key) => row?.[key] ?? null);
    const present = changes.filter((value) => value !== null).length;
    if (
      typeof row?.period !== "string" || !/^\d{4}-01-01$/.test(row.period)
      || !positive(row?.gdp_current_usd_bn) || !positive(row?.gdp_constant_usd_bn) || !positive(row?.eur_per_usd)
      || !Number.isInteger(row?.constant_usd_base_year)
      || !changes.every(nullableNumber) || (present !== 0 && present !== CHANGES.length)
      || (present && Math.abs(row.dollar_change_log_points
        - (row.real_growth_log_points + row.deflator_change_log_points + row.exchange_rate_change_log_points)) > 0.1)
    ) {
      throw new TypeError("dollar-decomposition rows do not match the consumer schema.");
    }
    const copy = {
      period: row.period, gdp_current_usd_bn: row.gdp_current_usd_bn, gdp_constant_usd_bn: row.gdp_constant_usd_bn,
      constant_usd_base_year: row.constant_usd_base_year, eur_per_usd: row.eur_per_usd,
    };
    CHANGES.forEach((key, index) => { copy[key] = changes[index]; });
    return Object.freeze(copy);
  });
}
