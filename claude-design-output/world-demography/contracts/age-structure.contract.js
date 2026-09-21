/** Application-owned Visual Contract v1 declaration for age-structure.
 *
 * The only figure not on a time axis: it renders one year, the one selected anywhere on the page. Rows arrive in two groupings of the same people and the visual must never add across them. Bands are ordered by age_start, not by label, because as text 100+ sorts before 10-14. The boundary rows are the first band, the open-ended top band whose age_end is null, and all three broad bands.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024, Online Edition. CC BY 3.0 IGO.
 */

export const AGE_STRUCTURE_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "age-structure",
  question: "For each selected country at a selected year, what is the population by five-year age group and sex, and what share of the population is young, working age, or old?",
  consumerSchema: Object.freeze({
    location_id: "number",  // the panel key
    location_name: "string",  // panel title
    age_grouping: "string",  // "five-year" or "broad"; rows from the two must never be summed together
    age_group: "string",  // the band label as the provider writes it
    age_start: "number",  // first year of age; the order the bands are read in
    age_end: "number|null",  // last year of age, or null where the band is open at the top
    population_male_thousands: "number",  // thousands
    population_female_thousands: "number",  // thousands
    population_total_thousands: "number",  // thousands
    share_of_population_pct: "number",  // per cent within the row's own grouping
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px
    selectedYear: "number",  // the observation year, from the report's shared selection
    seriesColours: "object",  // location_id to hex, for the panel title only
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
        {
              "period": "2023-01-01",
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "age_grouping": "broad",
              "age_group": "0-14",
              "age_start": 0,
              "age_end": 14,
              "population_male_thousands": 5707.611,
              "population_female_thousands": 5443.998,
              "population_total_thousands": 11151.61,
              "share_of_population_pct": 16.7848
        },
        {
              "period": "2023-01-01",
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "age_grouping": "broad",
              "age_group": "15-64",
              "age_start": 15,
              "age_end": 64,
              "population_male_thousands": 20241.616,
              "population_female_thousands": 20595.726,
              "population_total_thousands": 40837.341,
              "share_of_population_pct": 61.4661
        },
        {
              "period": "2023-01-01",
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "age_grouping": "broad",
              "age_group": "65+",
              "age_start": 65,
              "age_end": null,
              "population_male_thousands": 6253.062,
              "population_female_thousands": 8196.813,
              "population_total_thousands": 14449.873,
              "share_of_population_pct": 21.7491
        },
        {
              "period": "2023-01-01",
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "age_grouping": "five-year",
              "age_group": "0-4",
              "age_start": 0,
              "age_end": 4,
              "population_male_thousands": 1737.8,
              "population_female_thousands": 1659.103,
              "population_total_thousands": 3396.903,
              "share_of_population_pct": 5.1128
        },
        {
              "period": "2023-01-01",
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "age_grouping": "five-year",
              "age_group": "100+",
              "age_start": 100,
              "age_end": null,
              "population_male_thousands": 4.277,
              "population_female_thousands": 25.198,
              "population_total_thousands": 29.475,
              "share_of_population_pct": 0.0444
        }
  ]),
  cleanup: "none",
});

export function validateAgeStructureRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const population_male_thousands = Number(row?.population_male_thousands);
    if (!Number.isFinite(population_male_thousands)) throw new TypeError("age-structure: population_male_thousands must be a finite number.");
    const population_female_thousands = Number(row?.population_female_thousands);
    if (!Number.isFinite(population_female_thousands)) throw new TypeError("age-structure: population_female_thousands must be a finite number.");
    const population_total_thousands = Number(row?.population_total_thousands);
    if (!Number.isFinite(population_total_thousands)) throw new TypeError("age-structure: population_total_thousands must be a finite number.");
    return Object.freeze({ ...row });
  });
}
