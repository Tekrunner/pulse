/** Application-owned Visual Contract v1 declaration for fertility-longevity.
 *
 * Three panels, not three lines on one axis: a rate in births per woman and two quantities in years are different measures, and the two in years come from different providers on different bases. Healthy life expectancy is published only for 2000 to 2021, so its line ends with a dot and a direct label saying where, and its chip past that year reads not published. The boundary rows are the first and last healthy-life-expectancy years and the year after the last.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024, Online Edition. CC BY 3.0 IGO. WHO, Global Health Observatory: healthy life expectancy (HALE) at birth (WHOSIS_000002), 2024. Used under WHO's terms for data: public health purposes, with attribution, no commercial use, and prior written authorization required for modification.
 */

export const FERTILITY_LONGEVITY_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "fertility-longevity",
  question: "For each selected country, what is the total fertility rate, life expectancy at birth, and healthy life expectancy at birth?",
  consumerSchema: Object.freeze({
    period: "string",  // "YYYY-MM-DD"
    location_id: "number",  // the row key
    location_name: "string",  // series label
    series_kind: "string",  // "estimate" or "projection"
    total_fertility_rate: "number",  // live births per woman
    life_expectancy_years: "number",  // years
    healthy_life_expectancy_years: "number|null",  // years, WHO; null outside its published period
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px
    selectedIndex: "number",  // index into the period axis
    seriesColours: "object",  // location_id to hex
    replacementRate: "number",  // the reference line on the fertility panel, about 2.1
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
        {
              "period": "1950-01-01",
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "estimate",
              "total_fertility_rate": 2.1938,
              "life_expectancy_years": 66.8112
        },
        {
              "period": "2000-01-01",
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "estimate",
              "total_fertility_rate": 1.3862,
              "life_expectancy_years": 78.0563
        },
        {
              "period": "2021-01-01",
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "estimate",
              "total_fertility_rate": 1.5767,
              "life_expectancy_years": 81.1059
        },
        {
              "period": "2022-01-01",
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "estimate",
              "total_fertility_rate": 1.46,
              "life_expectancy_years": 80.5796
        },
        {
              "period": "2100-01-01",
              "iso3_code": "DEU",
              "location_name": "Germany",
              "series_kind": "projection",
              "total_fertility_rate": 1.597,
              "life_expectancy_years": 90.7835
        },
        {
              "period": "1950-01-01",
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "total_fertility_rate": 2.9648,
              "life_expectancy_years": 66.3819
        },
        {
              "period": "2000-01-01",
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "total_fertility_rate": 1.8757,
              "life_expectancy_years": 79.0438
        },
        {
              "period": "2021-01-01",
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "total_fertility_rate": 1.7994,
              "life_expectancy_years": 82.3216
        },
        {
              "period": "2022-01-01",
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "estimate",
              "total_fertility_rate": 1.76,
              "life_expectancy_years": 82.4753
        },
        {
              "period": "2100-01-01",
              "iso3_code": "FRA",
              "location_name": "France",
              "series_kind": "projection",
              "total_fertility_rate": 1.6463,
              "life_expectancy_years": 92.1419
        },
        {
              "period": "1950-01-01",
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "estimate",
              "total_fertility_rate": 2.224,
              "life_expectancy_years": 68.631
        },
        {
              "period": "2000-01-01",
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "estimate",
              "total_fertility_rate": 1.641,
              "life_expectancy_years": 77.8491
        },
        {
              "period": "2021-01-01",
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "estimate",
              "total_fertility_rate": 1.5834,
              "life_expectancy_years": 80.708
        },
        {
              "period": "2022-01-01",
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "estimate",
              "total_fertility_rate": 1.56,
              "life_expectancy_years": 81.0744
        },
        {
              "period": "2100-01-01",
              "iso3_code": "GBR",
              "location_name": "United Kingdom",
              "series_kind": "projection",
              "total_fertility_rate": 1.5953,
              "life_expectancy_years": 90.5874
        }
  ]),
  cleanup: "none",
});

export function validateFertilityLongevityRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    const total_fertility_rate = Number(row?.total_fertility_rate);
    if (!Number.isFinite(total_fertility_rate)) throw new TypeError("fertility-longevity: total_fertility_rate must be a finite number.");
    const life_expectancy_years = Number(row?.life_expectancy_years);
    if (!Number.isFinite(life_expectancy_years)) throw new TypeError("fertility-longevity: life_expectancy_years must be a finite number.");
    return Object.freeze({ ...row });
  });
}
