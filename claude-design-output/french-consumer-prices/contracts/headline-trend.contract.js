/** Application-owned Visual Contract v1 conformance declaration for headline-trend.js.
 *  Q1 - Where does headline inflation stand, and is it accelerating?
 *  Fixture rows are real published observations, kept at provider precision.
 *  Source: INSEE, Indice des prix à la consommation (IPC), Base 2025.
 *  Licence Ouverte / Open Licence 2.0.
 */

export const HEADLINE_TREND_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "headline-trend",
  question: "Where does headline inflation stand, and is it accelerating or decelerating?",
  consumerSchema: Object.freeze({
    period: "string",              // "YYYY-MM", ascending, one row per month, no gaps
    annual_change_pct: "number",   // percent, 1 decimal as published (011814058)
    monthly_change_pct: "number",  // percent, 1 decimal as published (011814057)
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",               // px; the report measures, the visual does not
    selectedIndex: "number",       // index into rows, from the report's month control
    unit: "string",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    { period: "2023-02", annual_change_pct: 6.4, monthly_change_pct: 1.1 },
    { period: "2026-01", annual_change_pct: 0.3, monthly_change_pct: -0.4 },
    { period: "2026-06", annual_change_pct: 1.7, monthly_change_pct: -0.3 },
    { period: "2026-07", annual_change_pct: 2.1, monthly_change_pct: 0.6 },
  ]),
  cleanup: "none",
});

export function validateHeadlineTrendRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const annual = Number(row?.annual_change_pct);
    const monthly = Number(row?.monthly_change_pct);
    if (typeof row?.period !== "string" || !Number.isFinite(annual) || !Number.isFinite(monthly)) {
      throw new TypeError("headline-trend rows require string period and finite annual_change_pct and monthly_change_pct.");
    }
    return { period: row.period, annual_change_pct: annual, monthly_change_pct: monthly };
  });
}
