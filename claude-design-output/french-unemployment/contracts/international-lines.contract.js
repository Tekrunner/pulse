/** Application-owned Visual Contract v1 declaration for international-lines.
 *
 * The panel is RAGGED: each area is drawn to its own latest published month and direct-labelled with it, never cut back to the slowest reporter. The fixture shows this directly - the United Kingdom's latest month is two months behind the others, because its rolling-quarter survey publishes later. Colour follows the entity and must stay stable when another area is removed. Aggregates are available and useful but must never be ranked among member countries. Areas the reader selects that this monthly series does not carry (Switzerland and New Zealand) arrive in display.unavailable and render an explicit not-published state rather than disappearing.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: OECD. CC BY 4.0. This is an adaptation of an original work by the OECD.
 */

export const INTERNATIONAL_LINES_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "international-lines",
  question: "How does France's unemployment rate compare with those of other OECD economies?",
  consumerSchema: Object.freeze({
    period: "string",  // "YYYY-MM-DD", first day of the month
    reference_area_code: "string",  // ISO-3166 alpha-3, or an aggregate code
    reference_area_name: "string",  // the OECD's own area name; never re-invent it
    reference_area_kind: "string",  // "member" | "aggregate" | "non-member"
    unemployment_rate_pct: "number",  // percent, harmonised
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px
    seriesColours: "object",  // area code to hex; assigned by the report and STABLE per entity
    emphasisCode: "string",  // the area drawn thicker, always "FRA" here
    unavailable: "array",  // area codes the reader selected that this series does not carry
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "2026-07-01",
        "reference_area_code": "DEU",
        "reference_area_name": "Germany",
        "reference_area_kind": "member",
        "unemployment_rate_pct": 4.0
    },
    {
        "period": "2026-07-01",
        "reference_area_code": "ESP",
        "reference_area_name": "Spain",
        "reference_area_kind": "member",
        "unemployment_rate_pct": 10.0
    },
    {
        "period": "2026-07-01",
        "reference_area_code": "FRA",
        "reference_area_name": "France",
        "reference_area_kind": "member",
        "unemployment_rate_pct": 8.3
    },
    {
        "period": "2026-05-01",
        "reference_area_code": "GBR",
        "reference_area_name": "United Kingdom",
        "reference_area_kind": "member",
        "unemployment_rate_pct": 4.9
    },
    {
        "period": "2026-07-01",
        "reference_area_code": "ITA",
        "reference_area_name": "Italy",
        "reference_area_kind": "member",
        "unemployment_rate_pct": 5.8
    },
    {
        "period": "2026-07-01",
        "reference_area_code": "OECD",
        "reference_area_name": "OECD",
        "reference_area_kind": "aggregate",
        "unemployment_rate_pct": 4.9
    }
]),
  cleanup: "none",
});

export function validateInternationalRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  const kinds = new Set(["member", "aggregate", "non-member"]);
  return rows.map((row) => {
    const rate = Number(row?.unemployment_rate_pct);
    if (
      typeof row?.period !== "string" ||
      typeof row?.reference_area_code !== "string" ||
      typeof row?.reference_area_name !== "string" ||
      !kinds.has(row?.reference_area_kind) ||
      !Number.isFinite(rate)
    ) {
      throw new TypeError(
        "international-lines rows require string period, reference_area_code, reference_area_name, a known reference_area_kind and a finite unemployment_rate_pct.",
      );
    }
    return {
      period: row.period,
      reference_area_code: row.reference_area_code,
      reference_area_name: row.reference_area_name,
      reference_area_kind: row.reference_area_kind,
      unemployment_rate_pct: rate,
    };
  });
}
