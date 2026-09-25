/** Application-owned Visual Contract v1 declaration for index-choropleth.
 *
 * Hand-authored SVG map on the boundary rows (the row spine: a departement with no figure for the shown year still renders, in the not-published grey), eight index bins with a neutral 90-110 class, blue below and orange above, an inset for Paris and the inner ring (whose departements are also drawn on the main map) and one per overseas departement, a selected departement's path over time against the France = 100 line, and highest and lowest lists. The visual projects the outer rings itself (equirectangular at 46.5° N); the report has already simplified them. The map's span is the published span of the series, not the represented period: a selected year outside it draws the nearest published year and says so in the strip and a banner, whose button selects that year across the report (revised after review: an all-grey map read as broken). Boundary rows: Paris and Hauts-de-Seine (index ~314 and ~281), Creuse, Guyane, Mayotte before and from 2014, Corsica.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases, grouped into one row per departement.
 * Their outlines are the published IGN rings, outer rings only, simplified
 * (Douglas–Peucker) and rounded to 0.001° to keep the fixture small.
 * Source: Eurostat, nama_10r_3gdp; boundaries IGN.
 */

export const INDEX_CHOROPLETH_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "index-choropleth",
  question: "How unevenly is GDP per inhabitant spread across the French departements?",
  consumerSchema: Object.freeze({
    departement_code: "string",
    departement_name: "string",
    geometry: "object",  // GeoJSON MultiPolygon, [lon, lat], outer rings only
    inset: "string|null",  // 'inner-ring' (also on the main map) | 'overseas' (inset only) | null
    series: Object.freeze([Object.freeze({  // every published year, ascending
      period: "string",  // YYYY-01-01
      gdp_per_inhabitant_eur: "number|null",
      gdp_per_inhabitant_index_france: "number|null",
      france_gdp_per_inhabitant_eur: "number",
      is_provisional: "boolean",
    })]),
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",
    from: "number",  // represented period, first year; the map keeps its own published span
    to: "number",  // represented period, last year
    selectedYear: "number",
    selectedDepartement: "string",  // departement code
    notes: "array",  // report-owned named warnings, {label, text}
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
      departement_code: "23",
      departement_name: "Creuse",
      inset: null,
      geometry: { type: "MultiPolygon", coordinates: [[[[1.706,45.843],[1.602,45.857],[1.637,45.926],[1.514,45.931],[1.577,45.978],[1.538,45.997],[1.543,46.077],[1.373,46.216],[1.438,46.272],[1.411,46.345],[1.525,46.427],[1.638,46.386],[1.726,46.391],[1.798,46.455],[2.281,46.42],[2.338,46.364],[2.301,46.342],[2.516,46.24],[2.603,46.033],[2.558,45.913],[2.388,45.828],[2.492,45.738],[2.326,45.672],[2.047,45.764],[1.899,45.698],[1.881,45.798],[1.771,45.869],[1.706,45.843]]]] },
      series: [
        {"period": "2000-01-01", "gdp_per_inhabitant_eur": 15200.0, "gdp_per_inhabitant_index_france": 62.6, "france_gdp_per_inhabitant_eur": 24300.0, "is_provisional": false},
        {"period": "2013-01-01", "gdp_per_inhabitant_eur": 19500.0, "gdp_per_inhabitant_index_france": 60.4, "france_gdp_per_inhabitant_eur": 32300.0, "is_provisional": false},
        {"period": "2014-01-01", "gdp_per_inhabitant_eur": 20000.0, "gdp_per_inhabitant_index_france": 61.3, "france_gdp_per_inhabitant_eur": 32600.0, "is_provisional": false},
        {"period": "2024-01-01", "gdp_per_inhabitant_eur": 25900.0, "gdp_per_inhabitant_index_france": 60.8, "france_gdp_per_inhabitant_eur": 42600.0, "is_provisional": true},
      ],
    },
    {
      departement_code: "2A",
      departement_name: "Corse-du-Sud",
      inset: null,
      geometry: { type: "MultiPolygon", coordinates: [[[[8.777,41.741],[8.659,41.742],[8.772,41.812],[8.751,41.845],[8.804,41.894],[8.753,41.933],[8.613,41.901],[8.592,41.961],[8.747,42.05],[8.702,42.111],[8.558,42.146],[8.593,42.169],[8.54,42.237],[8.694,42.266],[8.603,42.31],[8.613,42.349],[8.555,42.334],[8.548,42.379],[8.862,42.33],[8.905,42.254],[9.046,42.208],[9.16,42.027],[9.221,42.027],[9.227,41.855],[9.405,41.858],[9.386,41.656],[9.28,41.597],[9.36,41.59],[9.223,41.442],[9.216,41.408],[9.265,41.428],[9.219,41.368],[9.096,41.392],[9.123,41.443],[9.07,41.445],[9.081,41.482],[9.043,41.458],[8.789,41.558],[8.798,41.633],[8.916,41.687],[8.777,41.741]]]] },
      series: [
        {"period": "2000-01-01", "gdp_per_inhabitant_eur": 21400.0, "gdp_per_inhabitant_index_france": 88.1, "france_gdp_per_inhabitant_eur": 24300.0, "is_provisional": false},
        {"period": "2013-01-01", "gdp_per_inhabitant_eur": 30000.0, "gdp_per_inhabitant_index_france": 92.9, "france_gdp_per_inhabitant_eur": 32300.0, "is_provisional": false},
        {"period": "2014-01-01", "gdp_per_inhabitant_eur": 30000.0, "gdp_per_inhabitant_index_france": 92.0, "france_gdp_per_inhabitant_eur": 32600.0, "is_provisional": false},
        {"period": "2024-01-01", "gdp_per_inhabitant_eur": 41800.0, "gdp_per_inhabitant_index_france": 98.1, "france_gdp_per_inhabitant_eur": 42600.0, "is_provisional": true},
      ],
    },
    {
      departement_code: "2B",
      departement_name: "Haute-Corse",
      inset: null,
      geometry: { type: "MultiPolygon", coordinates: [[[[9.077,42.129],[9.046,42.208],[8.905,42.254],[8.862,42.33],[8.573,42.382],[8.66,42.421],[8.721,42.581],[8.788,42.558],[8.801,42.602],[9.018,42.642],[9.164,42.736],[9.299,42.676],[9.345,42.737],[9.31,42.834],[9.36,42.923],[9.341,42.994],[9.429,43.008],[9.492,42.803],[9.447,42.672],[9.533,42.545],[9.549,42.104],[9.416,41.958],[9.402,41.86],[9.309,41.832],[9.227,41.855],[9.221,42.027],[9.16,42.027],[9.077,42.129]]]] },
      series: [
        {"period": "2000-01-01", "gdp_per_inhabitant_eur": 17100.0, "gdp_per_inhabitant_index_france": 70.4, "france_gdp_per_inhabitant_eur": 24300.0, "is_provisional": false},
        {"period": "2013-01-01", "gdp_per_inhabitant_eur": 24800.0, "gdp_per_inhabitant_index_france": 76.8, "france_gdp_per_inhabitant_eur": 32300.0, "is_provisional": false},
        {"period": "2014-01-01", "gdp_per_inhabitant_eur": 25300.0, "gdp_per_inhabitant_index_france": 77.6, "france_gdp_per_inhabitant_eur": 32600.0, "is_provisional": false},
        {"period": "2024-01-01", "gdp_per_inhabitant_eur": 33600.0, "gdp_per_inhabitant_index_france": 78.9, "france_gdp_per_inhabitant_eur": 42600.0, "is_provisional": true},
      ],
    },
    {
      departement_code: "69",
      departement_name: "Rhône",
      inset: null,
      geometry: { type: "MultiPolygon", coordinates: [[[[4.454,45.604],[4.366,45.671],[4.403,45.744],[4.348,45.769],[4.396,45.86],[4.248,45.987],[4.313,46.007],[4.254,46.052],[4.322,46.13],[4.433,46.157],[4.386,46.226],[4.406,46.296],[4.618,46.265],[4.694,46.302],[4.725,46.184],[4.803,46.157],[4.748,46.092],[4.731,45.941],[4.881,45.898],[4.924,45.804],[5.101,45.814],[5.06,45.782],[5.159,45.707],[5.033,45.614],[4.777,45.588],[4.872,45.528],[4.776,45.454],[4.651,45.494],[4.68,45.568],[4.645,45.541],[4.454,45.604]]]] },
      series: [
        {"period": "2000-01-01", "gdp_per_inhabitant_eur": 31300.0, "gdp_per_inhabitant_index_france": 128.8, "france_gdp_per_inhabitant_eur": 24300.0, "is_provisional": false},
        {"period": "2013-01-01", "gdp_per_inhabitant_eur": 42100.0, "gdp_per_inhabitant_index_france": 130.3, "france_gdp_per_inhabitant_eur": 32300.0, "is_provisional": false},
        {"period": "2014-01-01", "gdp_per_inhabitant_eur": 42500.0, "gdp_per_inhabitant_index_france": 130.4, "france_gdp_per_inhabitant_eur": 32600.0, "is_provisional": false},
        {"period": "2024-01-01", "gdp_per_inhabitant_eur": 57600.0, "gdp_per_inhabitant_index_france": 135.2, "france_gdp_per_inhabitant_eur": 42600.0, "is_provisional": true},
      ],
    },
    {
      departement_code: "75",
      departement_name: "Paris",
      inset: "inner-ring",
      geometry: { type: "MultiPolygon", coordinates: [[[[2.267,48.832],[2.255,48.835],[2.252,48.845],[2.224,48.854],[2.226,48.859],[2.23,48.867],[2.246,48.876],[2.246,48.876],[2.255,48.874],[2.256,48.876],[2.258,48.88],[2.28,48.879],[2.291,48.889],[2.326,48.901],[2.391,48.901],[2.413,48.873],[2.416,48.849],[2.411,48.834],[2.422,48.836],[2.422,48.844],[2.437,48.841],[2.441,48.846],[2.47,48.837],[2.459,48.817],[2.402,48.829],[2.344,48.816],[2.267,48.832]]]] },
      series: [
        {"period": "2000-01-01", "gdp_per_inhabitant_eur": 70800.0, "gdp_per_inhabitant_index_france": 291.4, "france_gdp_per_inhabitant_eur": 24300.0, "is_provisional": false},
        {"period": "2013-01-01", "gdp_per_inhabitant_eur": 90900.0, "gdp_per_inhabitant_index_france": 281.4, "france_gdp_per_inhabitant_eur": 32300.0, "is_provisional": false},
        {"period": "2014-01-01", "gdp_per_inhabitant_eur": 92500.0, "gdp_per_inhabitant_index_france": 283.7, "france_gdp_per_inhabitant_eur": 32600.0, "is_provisional": false},
        {"period": "2024-01-01", "gdp_per_inhabitant_eur": 133700.0, "gdp_per_inhabitant_index_france": 313.8, "france_gdp_per_inhabitant_eur": 42600.0, "is_provisional": true},
      ],
    },
    {
      departement_code: "92",
      departement_name: "Hauts-de-Seine",
      inset: "inner-ring",
      geometry: { type: "MultiPolygon", coordinates: [[[[2.227,48.776],[2.223,48.786],[2.207,48.785],[2.212,48.791],[2.21,48.794],[2.203,48.798],[2.183,48.797],[2.187,48.801],[2.175,48.815],[2.152,48.817],[2.147,48.843],[2.16,48.848],[2.15,48.86],[2.157,48.87],[2.148,48.869],[2.174,48.899],[2.269,48.947],[2.291,48.951],[2.333,48.943],[2.334,48.928],[2.314,48.914],[2.32,48.9],[2.287,48.887],[2.28,48.879],[2.246,48.876],[2.23,48.867],[2.226,48.859],[2.224,48.854],[2.252,48.845],[2.255,48.835],[2.268,48.835],[2.268,48.828],[2.279,48.832],[2.332,48.818],[2.318,48.808],[2.326,48.808],[2.319,48.788],[2.327,48.779],[2.309,48.755],[2.321,48.749],[2.314,48.743],[2.314,48.73],[2.308,48.729],[2.304,48.729],[2.302,48.741],[2.279,48.733],[2.277,48.736],[2.275,48.741],[2.285,48.748],[2.275,48.755],[2.276,48.757],[2.233,48.766],[2.227,48.776]]]] },
      series: [
        {"period": "2000-01-01", "gdp_per_inhabitant_eur": 65000.0, "gdp_per_inhabitant_index_france": 267.5, "france_gdp_per_inhabitant_eur": 24300.0, "is_provisional": false},
        {"period": "2013-01-01", "gdp_per_inhabitant_eur": 94700.0, "gdp_per_inhabitant_index_france": 293.2, "france_gdp_per_inhabitant_eur": 32300.0, "is_provisional": false},
        {"period": "2014-01-01", "gdp_per_inhabitant_eur": 94900.0, "gdp_per_inhabitant_index_france": 291.1, "france_gdp_per_inhabitant_eur": 32600.0, "is_provisional": false},
        {"period": "2024-01-01", "gdp_per_inhabitant_eur": 119700.0, "gdp_per_inhabitant_index_france": 281.0, "france_gdp_per_inhabitant_eur": 42600.0, "is_provisional": true},
      ],
    },
    {
      departement_code: "973",
      departement_name: "Guyane",
      inset: "overseas",
      geometry: { type: "MultiPolygon", coordinates: [[[[-53.319,2.343],[-53.533,2.251],[-53.74,2.306],[-53.723,2.351],[-53.762,2.375],[-53.813,2.311],[-53.935,2.279],[-53.947,2.216],[-54.066,2.193],[-54.108,2.113],[-54.185,2.171],[-54.341,2.152],[-54.36,2.21],[-54.469,2.212],[-54.541,2.266],[-54.539,2.324],[-54.602,2.334],[-54.51,2.337],[-54.475,2.432],[-54.413,2.445],[-54.208,2.778],[-54.16,2.968],[-54.214,3.153],[-54.013,3.425],[-53.994,3.629],[-54.051,3.635],[-54.122,3.793],[-54.195,3.803],[-54.358,4.05],[-54.323,4.146],[-54.396,4.203],[-54.386,4.351],[-54.427,4.373],[-54.449,4.526],[-54.419,4.706],[-54.466,4.742],[-54.479,4.902],[-54.416,5.083],[-54.02,5.522],[-54.027,5.624],[-53.968,5.745],[-53.866,5.743],[-53.909,5.74],[-53.776,5.659],[-53.806,5.731],[-53.61,5.612],[-52.892,5.371],[-52.364,4.902],[-52.284,4.936],[-52.244,4.879],[-52.299,4.825],[-52.214,4.839],[-52.068,4.651],[-52.022,4.671],[-51.949,4.411],[-51.922,4.681],[-51.824,4.64],[-51.754,4.421],[-51.691,4.393],[-51.718,4.34],[-51.669,4.197],[-51.619,4.201],[-51.656,4.054],[-51.778,3.975],[-52.193,3.299],[-52.352,3.13],[-52.326,3.078],[-52.377,2.916],[-52.663,2.374],[-52.98,2.168],[-53.106,2.224],[-53.276,2.19],[-53.228,2.262],[-53.319,2.343]]]] },
      series: [
        {"period": "2000-01-01", "gdp_per_inhabitant_eur": 12800.0, "gdp_per_inhabitant_index_france": 52.7, "france_gdp_per_inhabitant_eur": 24300.0, "is_provisional": false},
        {"period": "2013-01-01", "gdp_per_inhabitant_eur": 16700.0, "gdp_per_inhabitant_index_france": 51.7, "france_gdp_per_inhabitant_eur": 32300.0, "is_provisional": false},
        {"period": "2014-01-01", "gdp_per_inhabitant_eur": 16700.0, "gdp_per_inhabitant_index_france": 51.2, "france_gdp_per_inhabitant_eur": 32600.0, "is_provisional": false},
        {"period": "2024-01-01", "gdp_per_inhabitant_eur": 17700.0, "gdp_per_inhabitant_index_france": 41.5, "france_gdp_per_inhabitant_eur": 42600.0, "is_provisional": true},
      ],
    },
    {
      departement_code: "976",
      departement_name: "Mayotte",
      inset: "overseas",
      geometry: { type: "MultiPolygon", coordinates: [[[[45.138,-12.991],[45.079,-12.962],[45.072,-12.899],[45.154,-12.925],[45.096,-12.855],[45.102,-12.766],[45.043,-12.748],[45.104,-12.654],[45.126,-12.727],[45.238,-12.76],[45.185,-12.839],[45.222,-12.871],[45.169,-12.949],[45.204,-12.975],[45.138,-12.991]]]] },
      series: [
        {"period": "2000-01-01", "gdp_per_inhabitant_eur": null, "gdp_per_inhabitant_index_france": null, "france_gdp_per_inhabitant_eur": 24300.0, "is_provisional": false},
        {"period": "2013-01-01", "gdp_per_inhabitant_eur": null, "gdp_per_inhabitant_index_france": null, "france_gdp_per_inhabitant_eur": 32300.0, "is_provisional": false},
        {"period": "2014-01-01", "gdp_per_inhabitant_eur": 7600.0, "gdp_per_inhabitant_index_france": 23.3, "france_gdp_per_inhabitant_eur": 32600.0, "is_provisional": false},
        {"period": "2024-01-01", "gdp_per_inhabitant_eur": 13100.0, "gdp_per_inhabitant_index_france": 30.8, "france_gdp_per_inhabitant_eur": 42600.0, "is_provisional": true},
      ],
    },
  ]),
  cleanup: "none",
});

const INSETS = ["inner-ring", "overseas", null];
const nullableNumber = (value) => value === null || Number.isFinite(value);
const isPoint = (point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);
const isRing = (ring) => Array.isArray(ring) && ring.length >= 3 && ring.every(isPoint);
const isMultiPolygon = (geometry) => geometry?.type === "MultiPolygon" && Array.isArray(geometry.coordinates)
  && geometry.coordinates.length > 0 && geometry.coordinates.every((polygon) => Array.isArray(polygon) && isRing(polygon[0]));
const isEntry = (entry) => typeof entry?.period === "string" && /^\d{4}-01-01$/.test(entry.period)
  && nullableNumber(entry.gdp_per_inhabitant_eur)
  && nullableNumber(entry.gdp_per_inhabitant_index_france)
  && Number.isFinite(entry.france_gdp_per_inhabitant_eur) && entry.france_gdp_per_inhabitant_eur > 0
  && typeof entry.is_provisional === "boolean";

/**
 * Rejects rows that do not match the consumer schema: one row per departement
 * code, a MultiPolygon of [lon, lat] rings, a known inset, and a series of
 * annual entries in strictly ascending order with nullable figures.
 */
export function validateIndexChoroplethRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  const codes = new Set();
  return rows.map((row) => {
    if (
      typeof row?.departement_code !== "string" || !row.departement_code || codes.has(row.departement_code)
      || typeof row.departement_name !== "string" || !row.departement_name
      || !isMultiPolygon(row.geometry) || !INSETS.includes(row.inset)
      || !Array.isArray(row.series) || !row.series.every(isEntry)
      || row.series.some((entry, index) => index > 0 && entry.period <= row.series[index - 1].period)
    ) {
      throw new TypeError("index-choropleth rows do not match the consumer schema.");
    }
    codes.add(row.departement_code);
    return Object.freeze({
      ...row,
      geometry: Object.freeze({ type: row.geometry.type, coordinates: row.geometry.coordinates }),
      series: Object.freeze(row.series.map((entry) => Object.freeze({ ...entry }))),
    });
  });
}
