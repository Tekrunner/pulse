/** Application-owned Visual Contract v1 declaration for per-capita-drivers.
 *
 * France over time as cumulative log-point changes of four factors and their total; across economies one diverging stacked bar per selected economy giving its log-point gap to France in GDP per inhabitant split into the four factors, with the total as a tick (aggregates without a UN share show employment per inhabitant unsplit; economies with screened hours are listed, not split). The report joins the UN 15-64 share (secondary input) to the OECD rows (row spine) by ISO3 and year and applies it to the OECD population; projection years are flagged. Boundary rows: France 1970 and 2025, UN projection years, New Zealand (screened hours), the OECD aggregate (no UN share).
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Sources: OECD Productivity Database — this is an adaptation of an original work by the OECD (CC BY 4.0); United Nations, World Population Prospects 2024 (CC BY 3.0 IGO).
 */

export const PER_CAPITA_DRIVERS_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "per-capita-drivers",
  question: "How much of the level and evolution of GDP per inhabitant comes from productivity per hour, hours per worker, the employment rate of the working-age population and the working-age share?",
  consumerSchema: Object.freeze({
    period: "string",
    reference_area_code: "string",
    reference_area_kind: "string",
    gdp_per_capita_ppp_current_usd: "number|null",
    gdp_per_capita_ppp_constant_2020_usd: "number|null",
    gdp_per_hour_ppp_current_usd: "number|null",
    gdp_per_hour_ppp_constant_2020_usd: "number|null",
    hours_per_worker: "number|null",
    employment_per_capita: "number|null",
    labour_input_is_plausible: "boolean|null",
    working_age_share: "number|null",  // UN, joined by the report
    working_age_share_is_projection: "boolean|null",
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",
    selectedYear: "number",
    comparators: "string[]",
    baseYear: "number",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "1970-01-01",
        "reference_area_code": "FRA",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 3642.7,
        "gdp_per_capita_ppp_constant_2020_usd": 23752.5,
        "gdp_per_hour_ppp_current_usd": 4.546,
        "gdp_per_hour_ppp_constant_2020_usd": 29.6423,
        "hours_per_worker": 1957.3,
        "employment_per_capita": 0.40939,
        "labour_input_is_plausible": true,
        "working_age_share": 0.62309,
        "working_age_share_is_projection": false
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "FRA",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 63973.9,
        "gdp_per_capita_ppp_constant_2020_usd": 55349.0,
        "gdp_per_hour_ppp_current_usd": 96.0523,
        "gdp_per_hour_ppp_constant_2020_usd": 83.1026,
        "hours_per_worker": 1499.9,
        "employment_per_capita": 0.44404,
        "labour_input_is_plausible": true,
        "working_age_share": 0.61233,
        "working_age_share_is_projection": true
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "DEU",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 75385.3,
        "gdp_per_capita_ppp_constant_2020_usd": 61134.4,
        "gdp_per_hour_ppp_current_usd": 102.6871,
        "gdp_per_hour_ppp_constant_2020_usd": 83.275,
        "hours_per_worker": 1336.4,
        "employment_per_capita": 0.54935,
        "labour_input_is_plausible": true,
        "working_age_share": 0.62411,
        "working_age_share_is_projection": true
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "USA",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 89984.5,
        "gdp_per_capita_ppp_constant_2020_usd": 73539.8,
        "gdp_per_hour_ppp_current_usd": 104.7444,
        "gdp_per_hour_ppp_constant_2020_usd": 85.6024,
        "hours_per_worker": 1773.0,
        "employment_per_capita": 0.48453,
        "labour_input_is_plausible": true,
        "working_age_share": 0.64514,
        "working_age_share_is_projection": true
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "NZL",
        "reference_area_kind": "member",
        "gdp_per_capita_ppp_current_usd": 57364.4,
        "gdp_per_capita_ppp_constant_2020_usd": 47734.8,
        "gdp_per_hour_ppp_current_usd": null,
        "gdp_per_hour_ppp_constant_2020_usd": null,
        "hours_per_worker": null,
        "employment_per_capita": null,
        "labour_input_is_plausible": false,
        "working_age_share": 0.64513,
        "working_age_share_is_projection": true
    },
    {
        "period": "2025-01-01",
        "reference_area_code": "OECD",
        "reference_area_kind": "aggregate",
        "gdp_per_capita_ppp_current_usd": 64169.6,
        "gdp_per_capita_ppp_constant_2020_usd": 52817.5,
        "gdp_per_hour_ppp_current_usd": 71.0532,
        "gdp_per_hour_ppp_constant_2020_usd": 58.4834,
        "hours_per_worker": 1579.1,
        "employment_per_capita": 0.57191,
        "labour_input_is_plausible": true,
        "working_age_share": null,
        "working_age_share_is_projection": null
    }
]),
  cleanup: "none",
});

/** Rejects rows that do not match the consumer schema (ratios finite where published; screened rows carry null ratios). */
export function validatePerCapitaDriversRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (!(typeof row?.period === "string" && typeof row?.reference_area_code === "string" && typeof row?.reference_area_kind === "string")) {
      throw new TypeError("per-capita-drivers rows do not match the consumer schema.");
    }
    return { ...row };
  });
}
