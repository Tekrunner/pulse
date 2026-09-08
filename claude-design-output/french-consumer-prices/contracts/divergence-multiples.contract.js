/** Application-owned Visual Contract v1 conformance declaration for divergence-multiples.js.
 *  Q3 - Which components diverge from headline, and how much of the basket are they?
 *  Fixture rows are real published observations, kept at provider precision.
 *  Source: INSEE, Indice des prix à la consommation (IPC), Base 2025.
 *  Licence Ouverte / Open Licence 2.0.
 */

export const DIVERGENCE_MULTIPLES_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "divergence-multiples",
  question: "Which components diverge from headline inflation, and by how much?",
  // Long format: one row per period per selected category. The report decides
  // which categories are present; the visual draws one panel per distinct category.
  consumerSchema: Object.freeze({
    period: "string",                      // "YYYY-MM", ascending within category
    category: "string",                    // "food" | "energy" | "rent"
    annual_change_pct: "number",           // percent, 1 dp
    headline_annual_change_pct: "number",  // percent, 1 dp (011814058)
    weight_per_10k: "number",              // annual basket weight, 0 dp
    weight_reference_year: "number",       // integer; annual, not a monthly observation
    is_pulse_calculation: "boolean",        // true for "rent" - marks the label and the table
  }),
  displaySchema: Object.freeze({
    width: "number",
    selectedIndex: "number",
    sharedDomain: "boolean",               // panels share the vertical scale (default true)
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    { period: "2026-07", category: "food",   annual_change_pct: 1.0,  headline_annual_change_pct: 2.1, weight_per_10k: 1485, weight_reference_year: 2026, is_pulse_calculation: false },
    { period: "2026-07", category: "energy", annual_change_pct: 12.6, headline_annual_change_pct: 2.1, weight_per_10k: 764,  weight_reference_year: 2026, is_pulse_calculation: false },
    { period: "2026-07", category: "rent",   annual_change_pct: 1.6,  headline_annual_change_pct: 2.1, weight_per_10k: 672,  weight_reference_year: 2026, is_pulse_calculation: true },
    { period: "2025-07", category: "energy", annual_change_pct: -7.2, headline_annual_change_pct: 0.9, weight_per_10k: 807,  weight_reference_year: 2025, is_pulse_calculation: false },
  ]),
  cleanup: "none",
});

const CATEGORIES = new Set(["food", "energy", "rent"]);

export function validateDivergenceRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const value = Number(row?.annual_change_pct);
    const headline = Number(row?.headline_annual_change_pct);
    const weight = Number(row?.weight_per_10k);
    const year = Number(row?.weight_reference_year);
    if (typeof row?.period !== "string" || !CATEGORIES.has(row?.category)) {
      throw new TypeError("divergence-multiples rows require a string period and a known category.");
    }
    if (![value, headline, weight, year].every(Number.isFinite)) {
      throw new TypeError("divergence-multiples rows require finite change, headline, weight and reference-year fields.");
    }
    return {
      period: row.period, category: row.category, annual_change_pct: value,
      headline_annual_change_pct: headline, weight_per_10k: weight,
      weight_reference_year: year, is_pulse_calculation: row.is_pulse_calculation === true,
    };
  });
}
