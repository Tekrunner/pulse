/** Application-owned Visual Contract v1 declaration for country-population-paths.
 *
 * One line per selected country, solid through the estimated period and dashed after it, with a direct label at each line's end rather than a legend. Dash is reserved for the estimate/projection distinction, so country identity is colour plus label and never a dash pattern. The boundary row is Kuwait in 1990, whose population fell 71 per cent in a year; a visual that clipped it would be clipping the provider's record of a mass departure.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024, Online Edition. CC BY 3.0 IGO.
 */

export const COUNTRY_POPULATION_PATHS_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "country-population-paths",
  question: "How large is each selected country's population each year, how fast is it changing, and where does the published projection take it?",
  consumerSchema: Object.freeze({
    period: "string",  // "YYYY-MM-DD", first day of the calendar year
    location_id: "number",  // the provider's numeric location code; the row key
    location_name: "string",  // the provider's name, drawn at the line's end
    series_kind: "string",  // "estimate" or "projection"
    population_thousands: "number",  // thousands of people on 1 July
    population_growth_rate_pct: "number",  // per cent a year
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px
    selectedIndex: "number",  // index into the period axis, shared across the report
    seriesColours: "object",  // location_id to hex; a presentation constant owned by the report
    bandRows: "array",  // scenario rows the report joined in, keyed by location_id
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
        {
              "period": "1950-01-01",
              "location_id": 276,
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "estimate",
              "population_thousands": 69847.782,
              "population_growth_rate_pct": -0.2
        },
        {
              "period": "2023-01-01",
              "location_id": 276,
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "estimate",
              "population_thousands": 84548.231,
              "population_growth_rate_pct": 0.349
        },
        {
              "period": "2024-01-01",
              "location_id": 276,
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "projection",
              "population_thousands": 84552.242,
              "population_growth_rate_pct": -0.339
        },
        {
              "period": "2100-01-01",
              "location_id": 276,
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "projection",
              "population_thousands": 70899.863,
              "population_growth_rate_pct": -0.049
        },
        {
              "period": "1950-01-01",
              "location_id": 250,
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "population_thousands": 41883.119,
              "population_growth_rate_pct": 1.106
        },
        {
              "period": "2023-01-01",
              "location_id": 250,
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "population_thousands": 66438.822,
              "population_growth_rate_pct": 0.173
        },
        {
              "period": "2024-01-01",
              "location_id": 250,
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "projection",
              "population_thousands": 66548.53,
              "population_growth_rate_pct": 0.157
        },
        {
              "period": "2100-01-01",
              "location_id": 250,
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "projection",
              "population_thousands": 68484.558,
              "population_growth_rate_pct": -0.033
        },
        {
              "period": "1950-01-01",
              "location_id": 826,
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "estimate",
              "population_thousands": 50121.017,
              "population_growth_rate_pct": 0.758
        },
        {
              "period": "2023-01-01",
              "location_id": 826,
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "estimate",
              "population_thousands": 68682.962,
              "population_growth_rate_pct": 0.699
        },
        {
              "period": "2024-01-01",
              "location_id": 826,
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "projection",
              "population_thousands": 69138.192,
              "population_growth_rate_pct": 0.622
        },
        {
              "period": "2100-01-01",
              "location_id": 826,
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "projection",
              "population_thousands": 74305.411,
              "population_growth_rate_pct": -0.184
        },
        {
              "period": "1990-01-01",
              "location_id": 414,
              "iso3_code": "KWT",
              "location_name": "Kuwait",
              "series_kind": "estimate",
              "population_thousands": 1684.819,
              "population_growth_rate_pct": -71.064
        }
  ]),
  cleanup: "none",
});

export function validateCountryPopulationPathsRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const population_thousands = Number(row?.population_thousands);
    if (!Number.isFinite(population_thousands)) throw new TypeError("country-population-paths: population_thousands must be a finite number.");
    const population_growth_rate_pct = Number(row?.population_growth_rate_pct);
    if (!Number.isFinite(population_growth_rate_pct)) throw new TypeError("country-population-paths: population_growth_rate_pct must be a finite number.");
    return Object.freeze({ ...row });
  });
}
