/** Application-owned Visual Contract v1 declaration for world-population-path.
 *
 * One plot of a stock over a plot of its rate, sharing an x-axis, never two y-axes on one plot. The shaded range is the 95% prediction interval, the only band on offer carrying a stated likelihood; named scenarios are thin dashed lines because they carry none. Boundary rows are the series start, the last estimated year, the first projected year, the year the medium path peaks, and the horizon.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024, Online Edition. CC BY 3.0 IGO.
 */

export const WORLD_POPULATION_PATH_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "world-population-path",
  question: "How large is the world's population each year, how fast is it changing, and where do the published projection scenarios take it?",
  consumerSchema: Object.freeze({
    period: "string",  // "YYYY-MM-DD", first day of the calendar year, ascending, no gaps
    series_kind: "string",  // "estimate" or "projection"; the report never infers the boundary from a literal year
    population_thousands: "number",  // thousands of people on 1 July
    population_growth_rate_pct: "number",  // per cent a year; negative past the peak
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px; the report measures, the visual does not
    selectedIndex: "number",  // index into rows, from the report's observation-year control
    scenarioMode: "string",  // "interval95" | "highlow" | "bounds" | "medium"
    bandRows: "array",  // scenario rows the report joined in; empty when scenarioMode is "medium"
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
        {
              "period": "1950-01-01",
              "series_kind": "estimate",
              "population_thousands": 2493092.848,
              "population_growth_rate_pct": 1.738
        },
        {
              "period": "2023-01-01",
              "series_kind": "estimate",
              "population_thousands": 8091734.93,
              "population_growth_rate_pct": 0.871
        },
        {
              "period": "2024-01-01",
              "series_kind": "projection",
              "population_thousands": 8161972.572,
              "population_growth_rate_pct": 0.858
        },
        {
              "period": "2084-01-01",
              "series_kind": "projection",
              "population_thousands": 10289315.244,
              "population_growth_rate_pct": -0.004
        },
        {
              "period": "2100-01-01",
              "series_kind": "projection",
              "population_thousands": 10180160.751,
              "population_growth_rate_pct": -0.127
        }
  ]),
  cleanup: "none",
});

export function validateWorldPopulationPathRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const population_thousands = Number(row?.population_thousands);
    if (!Number.isFinite(population_thousands)) throw new TypeError("world-population-path: population_thousands must be a finite number.");
    const population_growth_rate_pct = Number(row?.population_growth_rate_pct);
    if (!Number.isFinite(population_growth_rate_pct)) throw new TypeError("world-population-path: population_growth_rate_pct must be a finite number.");
    return Object.freeze({ ...row });
  });
}
