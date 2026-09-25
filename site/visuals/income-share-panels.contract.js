/** Application-owned Visual Contract v1 declaration for income-share-panels.
 *
 * Four panels, one per share of GDP at current prices (adjusted labour, adjusted capital, net taxes on production, net taxes on products), each on its own vertical scale with axes (revised after review: slow-moving shares were invisible in a 100 % stack); compensation of employees alone, unadjusted, is dashed in the labour panel only and named in a legend line beneath it. Two panels per row, one when the width cannot hold two readable panels. The report computes the shares from the annual accounts and passes one row per year; the x-axis is the represented period intersected with the rows' own span. A data table of every year in the window follows the plots. Boundary rows: 1949 (adjusted 68.5 % against 44.3 % unadjusted, the widest gap), 1975, 2007 (lowest adjusted share among the fixtures), 2020, 2025.
 *
 * Fixture rows are real published observations, shares computed from the
 * published amounts and rounded to 2 decimals, chosen to include this visual's
 * boundary cases. Source: INSEE, comptes nationaux annuels, base 2020; AMECO-method adjustment computed from INSEE employment. Licence Ouverte / Open Licence 2.0.
 */

export const INCOME_SHARE_PANELS_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "income-share-panels",
  question: "How is GDP shared between labour, capital and net taxes, once the self-employed are credited with a wage?",
  consumerSchema: Object.freeze({
    period: "string",  // YYYY-01-01, one row per year
    labour_share_pct: "number",  // adjusted labour income, % of GDP at current prices
    capital_share_pct: "number",  // adjusted capital income, % of GDP
    taxes_on_production_share_pct: "number",  // net taxes on production, % of GDP
    taxes_on_products_share_pct: "number",  // net taxes on products, % of GDP
    compensation_share_pct: "number",  // compensation of employees alone, unadjusted, % of GDP
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
        "period": "1949-01-01",
        "labour_share_pct": 68.49,
        "capital_share_pct": 18.84,
        "taxes_on_production_share_pct": 1.35,
        "taxes_on_products_share_pct": 11.32,
        "compensation_share_pct": 44.34
    },
    {
        "period": "1975-01-01",
        "labour_share_pct": 65.62,
        "capital_share_pct": 22.13,
        "taxes_on_production_share_pct": 1.29,
        "taxes_on_products_share_pct": 10.95,
        "compensation_share_pct": 54.21
    },
    {
        "period": "2007-01-01",
        "labour_share_pct": 55.08,
        "capital_share_pct": 31.72,
        "taxes_on_production_share_pct": 2.79,
        "taxes_on_products_share_pct": 10.41,
        "compensation_share_pct": 50.28
    },
    {
        "period": "2020-01-01",
        "labour_share_pct": 57.66,
        "capital_share_pct": 28.67,
        "taxes_on_production_share_pct": 2.39,
        "taxes_on_products_share_pct": 11.29,
        "compensation_share_pct": 51.55
    },
    {
        "period": "2025-01-01",
        "labour_share_pct": 57.99,
        "capital_share_pct": 28.34,
        "taxes_on_production_share_pct": 2.76,
        "taxes_on_products_share_pct": 10.9,
        "compensation_share_pct": 51.36
    }
]),
  cleanup: "none",
});

const SHARES = ["labour_share_pct", "capital_share_pct", "taxes_on_production_share_pct", "taxes_on_products_share_pct"];

/**
 * Rejects rows that do not match the consumer schema: a first-of-year period,
 * five finite numbers, labour, capital and compensation shares between 0 and
 * 100, and the four shares summing to 100 within 0.05 (they partition GDP, so
 * only rounding separates them from it).
 */
export function validateIncomeSharePanelsRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const numbers = [...SHARES, "compensation_share_pct"].every((key) => typeof row?.[key] === "number" && Number.isFinite(row[key]));
    if (
      typeof row?.period !== "string" || !/^\d{4}-01-01$/.test(row.period) || !numbers
      || !["labour_share_pct", "capital_share_pct", "compensation_share_pct"].every((key) => row[key] > 0 && row[key] < 100)
      || Math.abs(SHARES.reduce((sum, key) => sum + row[key], 0) - 100) > 0.05
    ) {
      throw new TypeError("income-share-panels rows do not match the consumer schema.");
    }
    return Object.freeze({ ...row });
  });
}
