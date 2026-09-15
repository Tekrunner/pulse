/** Application-owned Visual Contract v1 declaration for headline-trend-pair.
 *
 * TWO plots on one x-axis, never one plot on two y-axes. The rate and the headcount are independently published and can move in opposite directions when the labour force itself changes; a shared axis would invent an alignment between a percentage and a headcount. Boundary rows include the series minimum (7.2%), the maximum (10.5%) and the two most recent quarters.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: INSEE, enquête Emploi, indicateurs trimestriels au sens du BIT. Licence Ouverte / Open Licence 2.0.
 */

export const HEADLINE_TREND_PAIR_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "headline-trend-pair",
  question: "How many people in France are unemployed on the ILO definition, and what share of the labour force is that?",
  consumerSchema: Object.freeze({
    period: "string",  // "YYYY-MM-DD", first day of the quarter, ascending, no gaps
    unemployment_rate_pct: "number",  // percent, 1 decimal as published
    unemployed_thousands: "number",  // thousands of people, as published
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px; the report measures, the visual does not
    selectedIndex: "number",  // index into rows, from the report's quarter control
    representedPeriod: "string",  // human label, e.g. "Q2 2026"
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "2003-01-01",
        "unemployment_rate_pct": 8.4,
        "unemployed_thousands": 2327.0
    },
    {
        "period": "2013-04-01",
        "unemployment_rate_pct": 10.5,
        "unemployed_thousands": 3102.0
    },
    {
        "period": "2023-01-01",
        "unemployment_rate_pct": 7.2,
        "unemployed_thousands": 2225.0
    },
    {
        "period": "2026-01-01",
        "unemployment_rate_pct": 8.1,
        "unemployed_thousands": 2615.0
    },
    {
        "period": "2026-04-01",
        "unemployment_rate_pct": 8.3,
        "unemployed_thousands": 2677.0
    }
]),
  cleanup: "none",
});

export function validateHeadlineTrendPairRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const rate = Number(row?.unemployment_rate_pct);
    const people = Number(row?.unemployed_thousands);
    if (typeof row?.period !== "string" || !Number.isFinite(rate) || !Number.isFinite(people)) {
      throw new TypeError(
        "headline-trend-pair rows require a string period and finite unemployment_rate_pct and unemployed_thousands.",
      );
    }
    return { period: row.period, unemployment_rate_pct: rate, unemployed_thousands: people };
  });
}
