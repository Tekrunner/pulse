/** Application-owned Visual Contract v1 declaration for age-band-lines.
 *
 * Three lines, one per published band. The bands partition the labour force, so their counts reconstruct the national total - the dataset tests that. Each line is direct-labelled at its end, so identity never rests on hue alone. An ordinal single-hue ramp was tried and rejected: its darkest step reached only 1.87:1 against this report's surface.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: INSEE, enquête Emploi, indicateurs trimestriels au sens du BIT. Licence Ouverte / Open Licence 2.0.
 */

export const AGE_BAND_LINES_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "age-band-lines",
  question: "How far apart are the unemployment rates of under-25s, 25-to-49-year-olds and people aged 50 or over, and is the gap widening?",
  consumerSchema: Object.freeze({
    period: "string",  // "YYYY-MM-DD", first day of the quarter
    unemployment_rate_under_25_pct: "number",  // percent of the under-25 labour force
    unemployment_rate_25_to_49_pct: "number",  // percent of the 25-49 labour force
    unemployment_rate_50_and_over_pct: "number",  // percent of the 50+ labour force
    unemployed_under_25_thousands: "number",  // thousands
    unemployed_25_to_49_thousands: "number",  // thousands
    unemployed_50_and_over_thousands: "number",  // thousands
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px
    selectedIndex: "number",  // index into rows
    seriesColours: "object",  // band key to hex; the report owns the assignment
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "2003-01-01",
        "unemployment_rate_under_25_pct": 19.1,
        "unemployment_rate_25_to_49_pct": 7.8,
        "unemployment_rate_50_and_over_pct": 4.8,
        "unemployed_under_25_thousands": 572.0,
        "unemployed_25_to_49_thousands": 1462.0,
        "unemployed_50_and_over_thousands": 293.0
    },
    {
        "period": "2015-04-01",
        "unemployment_rate_under_25_pct": 26.1,
        "unemployment_rate_25_to_49_pct": 9.6,
        "unemployment_rate_50_and_over_pct": 7.3,
        "unemployed_under_25_thousands": 737.0,
        "unemployed_25_to_49_thousands": 1764.0,
        "unemployed_50_and_over_thousands": 621.0
    },
    {
        "period": "2026-01-01",
        "unemployment_rate_under_25_pct": 21.2,
        "unemployment_rate_25_to_49_pct": 7.3,
        "unemployment_rate_50_and_over_pct": 5.2,
        "unemployed_under_25_thousands": 730.0,
        "unemployed_25_to_49_thousands": 1355.0,
        "unemployed_50_and_over_thousands": 530.0
    },
    {
        "period": "2026-04-01",
        "unemployment_rate_under_25_pct": 21.6,
        "unemployment_rate_25_to_49_pct": 7.5,
        "unemployment_rate_50_and_over_pct": 5.5,
        "unemployed_under_25_thousands": 740.0,
        "unemployed_25_to_49_thousands": 1381.0,
        "unemployed_50_and_over_thousands": 555.0
    }
]),
  cleanup: "none",
});

export function validateAgeBandRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  const fields = [
    "unemployment_rate_under_25_pct",
    "unemployment_rate_25_to_49_pct",
    "unemployment_rate_50_and_over_pct",
    "unemployed_under_25_thousands",
    "unemployed_25_to_49_thousands",
    "unemployed_50_and_over_thousands",
  ];
  return rows.map((row) => {
    if (typeof row?.period !== "string") throw new TypeError("age-band-lines rows require a string period.");
    const out = { period: row.period };
    for (const field of fields) {
      const value = Number(row?.[field]);
      if (!Number.isFinite(value)) throw new TypeError(`age-band-lines rows require a finite ${field}.`);
      out[field] = value;
    }
    return out;
  });
}
