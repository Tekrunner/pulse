/** Application-owned Visual Contract v1 conformance declaration for contribution-stack.js.
 *  Q2 - What is carrying the headline annual rate, by component?
 *  Fixture rows are real published observations, kept at provider precision.
 *  Source: INSEE, Indice des prix à la consommation (IPC), Base 2025.
 *  Licence Ouverte / Open Licence 2.0.
 */

export const CONTRIBUTION_STACK_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "contribution-stack",
  question: "What is carrying the headline annual rate, and how large are rents beside it?",
  consumerSchema: Object.freeze({
    period: "string",               // "YYYY-MM", ascending
    food_pp: "number",              // percentage points, published 1 dp (011813664)
    services_pp: "number",          // (011813665)
    manufactured_pp: "number",      // (011813666)
    energy_pp: "number",            // (011813668)
    headline_pct: "number",         // percent, 1 dp (011814058) - drawn as the reference line
    rent_pulse_pp: "number",        // PULSE CALCULATION, 3 dp; separate lane, never stacked
    rent_weight_per_10k: "number",  // annual basket weight, 0 dp (011815638)
  }),
  displaySchema: Object.freeze({
    width: "number",
    selectedIndex: "number",
    showRentLane: "boolean",        // report-level toggle
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  // The four official contributions stack; rent_pulse_pp is drawn on its own
  // scale and is NOT additive with them (rents sit inside services).
  nonAdditiveFields: Object.freeze(["rent_pulse_pp"]),
  fixtureRows: Object.freeze([
    { period: "2025-07", food_pp: 0.2, services_pp: 1.3, manufactured_pp: -0.1, energy_pp: -0.6, headline_pct: 0.9, rent_pulse_pp: 0.142, rent_weight_per_10k: 645 },
    { period: "2026-02", food_pp: 0.3, services_pp: 0.8, manufactured_pp: 0.0, energy_pp: -0.2, headline_pct: 0.9, rent_pulse_pp: 0.114, rent_weight_per_10k: 672 },
    { period: "2026-07", food_pp: 0.1, services_pp: 1.1, manufactured_pp: -0.2, energy_pp: 1.0, headline_pct: 2.1, rent_pulse_pp: 0.108, rent_weight_per_10k: 672 },
  ]),
  cleanup: "none",
});

const FIELDS = ["food_pp", "services_pp", "manufactured_pp", "energy_pp", "headline_pct", "rent_pulse_pp", "rent_weight_per_10k"];

export function validateContributionStackRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (typeof row?.period !== "string") throw new TypeError("contribution-stack rows require a string period.");
    const out = { period: row.period };
    for (const field of FIELDS) {
      const value = Number(row?.[field]);
      if (!Number.isFinite(value)) throw new TypeError(`contribution-stack rows require a finite ${field}.`);
      out[field] = value;
    }
    return out;
  });
}
