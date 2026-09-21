/** Application-owned Visual Contract v1 declaration for change-composition.
 *
 * Two filled areas from zero and a line, never a stack. The provider's population change is accounted for by its two components but is not their sum: the residual reaches about 4,862 people for a country and 7,322 for the world aggregate, so a stack drawn as if it closed would be wrong. The boundary rows include Germany in 2023, where a natural change of -314,891 sits beside a net migration of +609,553, and the country-year with the largest residual in the table.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024, Online Edition. CC BY 3.0 IGO.
 */

export const CHANGE_COMPOSITION_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "change-composition",
  question: "For each selected country, how much of a year's population change is natural change and how much is net migration, both as people and relative to the population?",
  consumerSchema: Object.freeze({
    period: "string",  // "YYYY-MM-DD"
    location_id: "number",  // the row key
    location_name: "string",  // panel title
    series_kind: "string",  // "estimate" or "projection"
    population_change_thousands: "number",  // thousands a year; may be negative
    natural_change_thousands: "number",  // thousands a year; may be negative
    natural_change_rate_per_1000: "number",  // per 1,000 population; may be negative
    net_migration_thousands: "number",  // thousands a year; may be negative
    net_migration_rate_per_1000: "number",  // per 1,000 population; may be negative
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px
    selectedIndex: "number",  // index into the period axis
    unit: "string",  // "people" or "per-1000"; a figure-local control the report owns
    seriesColours: "object",  // location_id to hex
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
        {
              "period": "1950-01-01",
              "location_id": 276,
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "estimate",
              "population_change_thousands": -139.502,
              "natural_change_thousands": 488.901,
              "natural_change_rate_per_1000": 7.0,
              "net_migration_thousands": -628.404,
              "net_migration_rate_per_1000": -8.997
        },
        {
              "period": "2023-01-01",
              "location_id": 276,
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "estimate",
              "population_change_thousands": 294.664,
              "natural_change_thousands": -314.891,
              "natural_change_rate_per_1000": -3.724,
              "net_migration_thousands": 609.553,
              "net_migration_rate_per_1000": 7.21
        },
        {
              "period": "2100-01-01",
              "location_id": 276,
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "projection",
              "population_change_thousands": -34.584,
              "natural_change_thousands": -175.963,
              "natural_change_rate_per_1000": -2.482,
              "net_migration_thousands": 141.38,
              "net_migration_rate_per_1000": 1.994
        },
        {
              "period": "1950-01-01",
              "location_id": 250,
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "population_change_thousands": 463.046,
              "natural_change_thousands": 332.515,
              "natural_change_rate_per_1000": 7.939,
              "net_migration_thousands": 130.529,
              "net_migration_rate_per_1000": 3.117
        },
        {
              "period": "2023-01-01",
              "location_id": 250,
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "population_change_thousands": 114.674,
              "natural_change_thousands": 22.796,
              "natural_change_rate_per_1000": 0.343,
              "net_migration_thousands": 91.862,
              "net_migration_rate_per_1000": 1.383
        },
        {
              "period": "2100-01-01",
              "location_id": 250,
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "projection",
              "population_change_thousands": -22.301,
              "natural_change_thousands": -115.6,
              "natural_change_rate_per_1000": -1.688,
              "net_migration_thousands": 93.308,
              "net_migration_rate_per_1000": 1.362
        },
        {
              "period": "1950-01-01",
              "location_id": 826,
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "estimate",
              "population_change_thousands": 379.95,
              "natural_change_thousands": 228.299,
              "natural_change_rate_per_1000": 4.555,
              "net_migration_thousands": 151.663,
              "net_migration_rate_per_1000": 3.026
        },
        {
              "period": "2023-01-01",
              "location_id": 826,
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "estimate",
              "population_change_thousands": 480.161,
              "natural_change_thousands": 34.641,
              "natural_change_rate_per_1000": 0.505,
              "net_migration_thousands": 445.523,
              "net_migration_rate_per_1000": 6.487
        },
        {
              "period": "2100-01-01",
              "location_id": 826,
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "projection",
              "population_change_thousands": -136.518,
              "natural_change_thousands": -233.85,
              "natural_change_rate_per_1000": -3.147,
              "net_migration_thousands": 97.329,
              "net_migration_rate_per_1000": 1.31
        },
        {
              "period": "1989-01-01",
              "location_id": 804,
              "iso3_code": "UKR",
              "location_name": "Ukraine",
              "series_kind": "estimate",
              "population_change_thousands": 148.285,
              "natural_change_thousands": 106.445,
              "natural_change_rate_per_1000": 2.05,
              "net_migration_thousands": 36.978,
              "net_migration_rate_per_1000": 0.712
        }
  ]),
  cleanup: "none",
});

export function validateChangeCompositionRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const population_change_thousands = Number(row?.population_change_thousands);
    if (!Number.isFinite(population_change_thousands)) throw new TypeError("change-composition: population_change_thousands must be a finite number.");
    const natural_change_thousands = Number(row?.natural_change_thousands);
    if (!Number.isFinite(natural_change_thousands)) throw new TypeError("change-composition: natural_change_thousands must be a finite number.");
    const net_migration_thousands = Number(row?.net_migration_thousands);
    if (!Number.isFinite(net_migration_thousands)) throw new TypeError("change-composition: net_migration_thousands must be a finite number.");
    return Object.freeze({ ...row });
  });
}
