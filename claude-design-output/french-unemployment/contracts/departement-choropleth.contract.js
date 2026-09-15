/** Application-owned Visual Contract v1 declaration for departement-choropleth.
 *
 * A NULL rate means the provider publishes none, and must render in the not-published treatment - a distinct fill plus a dashed edge plus a named legend class - never as zero and never as an absent shape. Two real cases produce NULL: Mayotte, which has a boundary but no localised rate at any date, and the four overseas départements in any quarter before 2014-Q1. Every shape keeps a hairline border so a territory is legible whether or not its class is. The fixture carries the highest département (Guyane), the lowest (Cantal), a Corsican code that is not numeric (2A), a metropolitan control (75) and the Mayotte NULL case. The geometry_geojson_excerpt field in this fixture is TRUNCATED FOR REVIEW: the real rows carry the full published geometry.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: INSEE, taux de chômage localisés. Licence Ouverte / Open Licence 2.0. Source: IGN, ADMIN EXPRESS COG CARTO, edition 2026. Licence Ouverte / Open Licence 2.0.
 */

export const DEPARTEMENT_CHOROPLETH_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "departement-choropleth",
  question: "How unevenly is unemployment spread across the French départements, and where are the extremes?",
  consumerSchema: Object.freeze({
    departement_code: "string",  // bare INSEE code; the join key, e.g. "75", "2A", "973"
    departement_name: "string",  // official IGN name
    region_code: "string",  // INSEE region code
    period: "string|null",  // quarter of the rate; NULL when no rate is published
    unemployment_rate_pct: "number|null",  // percent; NULL means NOT PUBLISHED, never zero
    geometry_geojson: "string",  // GeoJSON geometry object, EPSG:4326, as published
    bbox_west: "number",  // degrees
    bbox_south: "number",  // degrees
    bbox_east: "number",  // degrees
    bbox_north: "number",  // degrees
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px
    classBreaks: "array",  // ascending numeric breaks; the report owns them
    classColours: "array",  // hex per class, low to high
    noDataColour: "string",  // hex for the not-published treatment
    selectedCode: "string|null",  // the département the report has selected
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "departement_code": "973",
        "departement_name": "Guyane",
        "period": "2026-01-01",
        "unemployment_rate_pct": 19.3,
        "region_code": "03",
        "bbox_west": -54.602361,
        "bbox_south": 2.112678,
        "bbox_east": -51.619066,
        "bbox_north": 5.748682,
        "geometry_geojson_excerpt": "{\"type\":\"MultiPolygon\",\"coordinates\":[[[[-53.318…"
    },
    {
        "departement_code": "2A",
        "departement_name": "Corse-du-Sud",
        "period": "2026-01-01",
        "unemployment_rate_pct": 6.6,
        "region_code": "94",
        "bbox_west": 8.540151,
        "bbox_south": 41.366165,
        "bbox_east": 9.406959,
        "bbox_north": 42.381567,
        "geometry_geojson_excerpt": "{\"type\":\"MultiPolygon\",\"coordinates\":[[[[8.77660…"
    },
    {
        "departement_code": "75",
        "departement_name": "Paris",
        "period": "2026-01-01",
        "unemployment_rate_pct": 6.3,
        "region_code": "11",
        "bbox_west": 2.224219,
        "bbox_south": 48.815604,
        "bbox_east": 2.469803,
        "bbox_north": 48.902077,
        "geometry_geojson_excerpt": "{\"type\":\"MultiPolygon\",\"coordinates\":[[[[2.26733…"
    },
    {
        "departement_code": "15",
        "departement_name": "Cantal",
        "period": "2026-01-01",
        "unemployment_rate_pct": 4.7,
        "region_code": "84",
        "bbox_west": 2.062878,
        "bbox_south": 44.615766,
        "bbox_east": 3.37145,
        "bbox_north": 45.482191,
        "geometry_geojson_excerpt": "{\"type\":\"MultiPolygon\",\"coordinates\":[[[[2.17667…"
    },
    {
        "departement_code": "976",
        "departement_name": "Mayotte",
        "period": null,
        "unemployment_rate_pct": null,
        "region_code": "06",
        "bbox_west": 45.022008,
        "bbox_south": -12.999953,
        "bbox_east": 45.298044,
        "bbox_north": -12.63659,
        "geometry_geojson_excerpt": "{\"type\":\"MultiPolygon\",\"coordinates\":[[[[45.1382…"
    }
]),
  cleanup: "focused callback only \u2014 releases the resize observer the map registers",
});

export function validateChoroplethRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (typeof row?.departement_code !== "string" || !row.departement_code) {
      throw new TypeError("departement-choropleth rows require a string departement_code.");
    }
    if (typeof row?.geometry_geojson !== "string" || !row.geometry_geojson) {
      throw new TypeError("departement-choropleth rows require a geometry_geojson string.");
    }
    // A null rate is VALID and means "not published". Coercing it to 0 would
    // paint an unpublished territory as the best-performing one on the map.
    const rate = row.unemployment_rate_pct;
    const published = rate !== null && rate !== undefined && Number.isFinite(Number(rate));
    for (const field of ["bbox_west", "bbox_south", "bbox_east", "bbox_north"]) {
      if (!Number.isFinite(Number(row?.[field]))) {
        throw new TypeError(`departement-choropleth rows require a finite ${field}.`);
      }
    }
    return {
      departement_code: row.departement_code,
      departement_name: String(row.departement_name ?? ""),
      region_code: String(row.region_code ?? ""),
      period: published ? String(row.period) : null,
      unemployment_rate_pct: published ? Number(rate) : null,
      geometry_geojson: row.geometry_geojson,
      bbox_west: Number(row.bbox_west),
      bbox_south: Number(row.bbox_south),
      bbox_east: Number(row.bbox_east),
      bbox_north: Number(row.bbox_north),
    };
  });
}
