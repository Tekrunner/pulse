/** Application-owned Visual Contract v1 declaration for oecd-standing.
 *
 * Ranked bars at current PPP for the selected year (aggregates as dashed reference, never ranked), lines at constant 2020 PPP over time, and growth lines. France is always drawn; comparators come from the report's selection. Boundary rows: default comparators, the OECD total, Australia stopping at 2024, Luxembourg at the top, New Zealand.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: OECD Productivity Database. This is an adaptation of an original work by the OECD (CC BY 4.0).
 */

export const OECD_STANDING_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "oecd-standing",
  question: "How do French GDP volume growth and GDP per inhabitant at purchasing power parity compare with those of other OECD economies?",
  consumerSchema: Object.freeze({
    period: "string",
    reference_area_code: "string",
    reference_area_name: "string",
    reference_area_kind: "string",  // member | aggregate | non-member
    gdp_per_capita_ppp_current_usd: "number|null",
    gdp_per_capita_ppp_constant_2020_usd: "number|null",
    gdp_volume_growth_pct: "number|null",
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",
    selectedYear: "number",
    comparators: "string[]",  // France always first
    showAggregate: "boolean",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "1970-01-01",
        "reference_area_code": "AUS",
        "reference_area_name": "Australia",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": null,
        "gdp_per_capita_ppp_constant_2020_usd": null,
        "gdp_volume_growth_pct": null
    },
    {
        "period": "2024-01-01",
        "reference_area_code": "AUS",
        "reference_area_name": "Australia",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 74627.5,
        "gdp_per_capita_ppp_constant_2020_usd": 59490.1,
        "gdp_volume_growth_pct": 1.35
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "AUS",
        "reference_area_name": "Australia",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": null,
        "gdp_per_capita_ppp_constant_2020_usd": null,
        "gdp_volume_growth_pct": 1.986
    },
    {
        "period": "1970-01-01",
        "reference_area_code": "DEU",
        "reference_area_name": "Germany",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 4045.8,
        "gdp_per_capita_ppp_constant_2020_usd": 25172.9,
        "gdp_volume_growth_pct": null
    },
    {
        "period": "2024-01-01",
        "reference_area_code": "DEU",
        "reference_area_name": "Germany",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 73956.6,
        "gdp_per_capita_ppp_constant_2020_usd": 60997.0,
        "gdp_volume_growth_pct": -0.496
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "DEU",
        "reference_area_name": "Germany",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 75385.3,
        "gdp_per_capita_ppp_constant_2020_usd": 61134.4,
        "gdp_volume_growth_pct": 0.22
    },
    {
        "period": "1970-01-01",
        "reference_area_code": "FRA",
        "reference_area_name": "France",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 3642.7,
        "gdp_per_capita_ppp_constant_2020_usd": 23752.5,
        "gdp_volume_growth_pct": null
    },
    {
        "period": "2024-01-01",
        "reference_area_code": "FRA",
        "reference_area_name": "France",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 62647.9,
        "gdp_per_capita_ppp_constant_2020_usd": 55084.5,
        "gdp_volume_growth_pct": 1.504
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "FRA",
        "reference_area_name": "France",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 63973.9,
        "gdp_per_capita_ppp_constant_2020_usd": 55349.0,
        "gdp_volume_growth_pct": 0.805
    },
    {
        "period": "1970-01-01",
        "reference_area_code": "GBR",
        "reference_area_name": "United Kingdom",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 3650.2,
        "gdp_per_capita_ppp_constant_2020_usd": 22142.0,
        "gdp_volume_growth_pct": null
    },
    {
        "period": "2024-01-01",
        "reference_area_code": "GBR",
        "reference_area_name": "United Kingdom",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 62813.6,
        "gdp_per_capita_ppp_constant_2020_usd": 54271.3,
        "gdp_volume_growth_pct": 1.042
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "GBR",
        "reference_area_name": "United Kingdom",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 64465.2,
        "gdp_per_capita_ppp_constant_2020_usd": 54810.0,
        "gdp_volume_growth_pct": 1.315
    },
    {
        "period": "1970-01-01",
        "reference_area_code": "LUX",
        "reference_area_name": "Luxembourg",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 5483.1,
        "gdp_per_capita_ppp_constant_2020_usd": 41176.2,
        "gdp_volume_growth_pct": null
    },
    {
        "period": "2024-01-01",
        "reference_area_code": "LUX",
        "reference_area_name": "Luxembourg",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 155750.1,
        "gdp_per_capita_ppp_constant_2020_usd": 120505.2,
        "gdp_volume_growth_pct": 0.359
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "LUX",
        "reference_area_name": "Luxembourg",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 156526.6,
        "gdp_per_capita_ppp_constant_2020_usd": 119756.7,
        "gdp_volume_growth_pct": 0.638
    },
    {
        "period": "1970-01-01",
        "reference_area_code": "NZL",
        "reference_area_name": "New Zealand",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": null,
        "gdp_per_capita_ppp_constant_2020_usd": null,
        "gdp_volume_growth_pct": null
    },
    {
        "period": "2024-01-01",
        "reference_area_code": "NZL",
        "reference_area_name": "New Zealand",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 55796.1,
        "gdp_per_capita_ppp_constant_2020_usd": 47816.7,
        "gdp_volume_growth_pct": -0.697
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "NZL",
        "reference_area_name": "New Zealand",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 57364.4,
        "gdp_per_capita_ppp_constant_2020_usd": 47734.8,
        "gdp_volume_growth_pct": 0.463
    },
    {
        "period": "1970-01-01",
        "reference_area_code": "OECD",
        "reference_area_name": "OECD",
        "reference_area_kind": "aggregate",
        "gdp_per_capita_ppp_current_usd": 3522.7,
        "gdp_per_capita_ppp_constant_2020_usd": 19809.5,
        "gdp_volume_growth_pct": null
    },
    {
        "period": "2024-01-01",
        "reference_area_code": "OECD",
        "reference_area_name": "OECD",
        "reference_area_kind": "aggregate",
        "gdp_per_capita_ppp_current_usd": 62303.3,
        "gdp_per_capita_ppp_constant_2020_usd": 52067.4,
        "gdp_volume_growth_pct": null
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "OECD",
        "reference_area_name": "OECD",
        "reference_area_kind": "aggregate",
        "gdp_per_capita_ppp_current_usd": 64169.6,
        "gdp_per_capita_ppp_constant_2020_usd": 52817.5,
        "gdp_volume_growth_pct": null
    },
    {
        "period": "1970-01-01",
        "reference_area_code": "USA",
        "reference_area_name": "United States",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 5233.4,
        "gdp_per_capita_ppp_constant_2020_usd": 27316.3,
        "gdp_volume_growth_pct": null
    },
    {
        "period": "2024-01-01",
        "reference_area_code": "USA",
        "reference_area_name": "United States",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 86146.4,
        "gdp_per_capita_ppp_constant_2020_usd": 72375.3,
        "gdp_volume_growth_pct": 2.793
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "USA",
        "reference_area_name": "United States",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 89984.5,
        "gdp_per_capita_ppp_constant_2020_usd": 73539.8,
        "gdp_volume_growth_pct": 2.161
    }
]),
  cleanup: "none",
});

/** Rejects rows that do not match the consumer schema (area code string, kind in the three values). */
export function validateOecdStandingRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (!(typeof row?.period === "string" && typeof row?.reference_area_code === "string" && typeof row?.reference_area_name === "string" && typeof row?.reference_area_kind === "string")) {
      throw new TypeError("oecd-standing rows do not match the consumer schema.");
    }
    return { ...row };
  });
}
