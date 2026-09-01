/** Application-owned Visual Contract v1 conformance declaration for line.js. */

export const LINE_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  fixtureRows: Object.freeze([
    { period: "2024-Q1", value: 101.2 },
    { period: "2024-Q4", value: 104.4 },
  ]),
  consumerSchema: Object.freeze({ period: "string", value: "number" }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  cleanup: "none",
});

export function validateLineConsumerRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const value = Number(row?.value);
    if (typeof row?.period !== "string" || !Number.isFinite(value)) {
      throw new TypeError("Visual rows require string period and finite number value fields.");
    }
    return { period: row.period, value };
  });
}
