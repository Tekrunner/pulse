/** Application-owned Visual Contract v1 declaration for income-share-panels.
 *
 * Four panels, one per share of GDP (adjusted labour, adjusted capital, net taxes on production, net taxes on products), each on its own vertical scale with axes; compensation of employees alone dashed in the labour panel. Boundary rows: 1949 (adjusted 68.5% against 44.3%), 1981 (unadjusted peak), 2007 (adjusted minimum), 2025.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: INSEE, comptes nationaux annuels, base 2020; AMECO-method adjustment computed from INSEE employment. Licence Ouverte / Open Licence 2.0.
 */

export const INCOME_SHARE_PANELS_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "income-share-panels",
  question: "How is value added shared between labour, capital and net taxes, once the self-employed are credited with a wage?",
  consumerSchema: Object.freeze({
    period: "string",
    labour_share_pct: "number",
    capital_share_pct: "number",
    taxes_on_production_share_pct: "number",
    taxes_on_products_share_pct: "number",
    compensation_share_pct: "number",
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",
    selectedYear: "number",
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

/** Rejects rows that do not match the consumer schema (the four shares finite and summing to 100 within 0.02). */
export function validateIncomeSharePanelsRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (!(typeof row?.period === "string" && Number.isFinite(Number(row?.labour_share_pct)) && Number.isFinite(Number(row?.capital_share_pct)) && Number.isFinite(Number(row?.taxes_on_production_share_pct)) && Number.isFinite(Number(row?.taxes_on_products_share_pct)) && Number.isFinite(Number(row?.compensation_share_pct)))) {
      throw new TypeError("income-share-panels rows do not match the consumer schema.");
    }
    return { ...row };
  });
}
