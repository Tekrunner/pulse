/** Application-owned Visual Contract v1 declaration for migration-flows.
 *
 * Rows come from three datasets and are joined by the report, never by the visual. The spine is the United Nations indicator table, because a country Eurostat does not cover must still produce a panel and render the not-published treatment. arrivals and departures are nullable and a null is drawn as an absence on the mark, never as zero and never as a gap. The boundary rows are the United Kingdom's last published year, 2019, and a later year where both flows are absent.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: Eurostat, immigration and emigration by age group, sex and citizenship (migr_imm1ctz, migr_emi1ctz). Reuse authorised with acknowledgement of the source. United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024, Online Edition. CC BY 3.0 IGO.
 */

export const MIGRATION_FLOWS_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "migration-flows",
  question: "Where a provider publishes them, how large are the gross immigration and emigration counts behind a country's net migration?",
  consumerSchema: Object.freeze({
    period: "string",  // "YYYY-MM-DD"
    location_id: "number",  // the row key, from the spine
    location_name: "string",  // panel title
    net_migration_thousands: "number",  // thousands a year, United Nations; may be negative
    arrivals_persons: "number|null",  // people a year, Eurostat; null where it publishes none
    departures_persons: "number|null",  // people a year, Eurostat; null where it publishes none
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px
    selectedIndex: "number",  // index into the period axis
    seriesColours: "object",  // location_id to hex
    flowCoverage: "object",  // location_id to the last year the flow provider published, or null
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
        {
              "period": "1998-01-01",
              "iso3_code": "DEU",
              "geo_code": "DE",
              "immigration_persons": 802456,
              "emigration_persons": 755358
        },
        {
              "period": "2006-01-01",
              "iso3_code": "DEU",
              "geo_code": "DE",
              "immigration_persons": 661855,
              "emigration_persons": 639064
        },
        {
              "period": "2015-01-01",
              "iso3_code": "DEU",
              "geo_code": "DE",
              "immigration_persons": 1595865,
              "emigration_persons": 321915
        },
        {
              "period": "2019-01-01",
              "iso3_code": "DEU",
              "geo_code": "DE",
              "immigration_persons": 834338,
              "emigration_persons": 496613
        },
        {
              "period": "2024-01-01",
              "iso3_code": "DEU",
              "geo_code": "DE",
              "immigration_persons": 1078504,
              "emigration_persons": 584230
        },
        {
              "period": "2006-01-01",
              "iso3_code": "FRA",
              "geo_code": "FR",
              "immigration_persons": 301544,
              "emigration_persons": 189403
        },
        {
              "period": "2015-01-01",
              "iso3_code": "FRA",
              "geo_code": "FR",
              "immigration_persons": 364221,
              "emigration_persons": 324517
        },
        {
              "period": "2019-01-01",
              "iso3_code": "FRA",
              "geo_code": "FR",
              "immigration_persons": 385596,
              "emigration_persons": 259143
        },
        {
              "period": "2024-01-01",
              "iso3_code": "FRA",
              "geo_code": "FR",
              "immigration_persons": 438626,
              "emigration_persons": 263233
        },
        {
              "period": "1998-01-01",
              "iso3_code": "GBR",
              "geo_code": "UK",
              "immigration_persons": 332390,
              "emigration_persons": 198934
        },
        {
              "period": "2006-01-01",
              "iso3_code": "GBR",
              "geo_code": "UK",
              "immigration_persons": 529008,
              "emigration_persons": 369470
        },
        {
              "period": "2015-01-01",
              "iso3_code": "GBR",
              "geo_code": "UK",
              "immigration_persons": 631452,
              "emigration_persons": 299183
        },
        {
              "period": "2019-01-01",
              "iso3_code": "GBR",
              "geo_code": "UK",
              "immigration_persons": 680906,
              "emigration_persons": 368385
        }
  ]),
  cleanup: "none",
});

export function validateMigrationFlowsRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const net_migration_thousands = Number(row?.net_migration_thousands);
    if (!Number.isFinite(net_migration_thousands)) throw new TypeError("migration-flows: net_migration_thousands must be a finite number.");
    return Object.freeze({ ...row });
  });
}
