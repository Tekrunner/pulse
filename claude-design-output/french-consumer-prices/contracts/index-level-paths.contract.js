/** Application-owned Visual Contract v1 conformance declaration for index-level-paths.js.
 *  Q4 - What has the price level done cumulatively since Base 2025 = 100?
 *  Fixture rows are real published observations, kept at provider precision.
 *  Source: INSEE, Indice des prix à la consommation (IPC), Base 2025.
 *  Licence Ouverte / Open Licence 2.0.
 */

export const INDEX_LEVEL_PATHS_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "index-level-paths",
  question: "What has the price level actually done since the 2025 base year?",
  consumerSchema: Object.freeze({
    period: "string",         // "YYYY-MM", ascending
    series: "string",         // "headline" | "food" | "energy" | "rent"
    index: "number",          // Base 2025 = 100, 2 decimals as published
  }),
  displaySchema: Object.freeze({
    width: "number",
    selectedIndex: "number",
    referenceValue: "number", // 100 - drawn as the base-year rule
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    { period: "2025-07", series: "headline", index: 100.56 },
    { period: "2026-07", series: "headline", index: 102.67 },
    { period: "2026-07", series: "food",     index: 101.29 },
    { period: "2026-07", series: "energy",   index: 111.75 },
    { period: "2026-07", series: "rent",     index: 101.60 },
  ]),
  cleanup: "none",
});

const SERIES = new Set(["headline", "food", "energy", "rent"]);

export function validateIndexLevelRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const index = Number(row?.index);
    if (typeof row?.period !== "string" || !SERIES.has(row?.series) || !Number.isFinite(index)) {
      throw new TypeError("index-level-paths rows require a string period, a known series and a finite index.");
    }
    return { period: row.period, series: row.series, index };
  });
}
