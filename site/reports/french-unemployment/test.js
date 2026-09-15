import { stateForError } from "../../data/report-runtime.js";
import { classOf, classLabels, validateChoroplethRows } from "../../visuals/departement-choropleth.js";

/**
 * Distinct numeric conversion paths this report actually takes. Every stored
 * value arrives as DECIMAL(10,1) cast to DOUBLE, except the localised rate,
 * which is nullable: a null means the provider publishes none and must never
 * be read as zero.
 */
export const numericBoundaryCases = Object.freeze([
  { stored: "8.3", expected: 8.3 },
  { stored: "19.3", expected: 19.3 },
  { stored: "4.7", expected: 4.7 },
  { stored: "0.0", expected: 0 },
  { stored: null, expected: null },
]);

/** The break points of the map's five classes, at and either side of each. */
export const classBoundaryCases = Object.freeze([
  { rate: 5.9, expected: 0 },
  { rate: 6, expected: 1 },
  { rate: 6.9, expected: 1 },
  { rate: 7, expected: 2 },
  { rate: 8, expected: 3 },
  { rate: 9.9, expected: 3 },
  { rate: 10, expected: 4 },
  { rate: 19.3, expected: 4 },
  { rate: null, expected: null },
]);

export const MAP_CLASS_BREAKS = Object.freeze([6, 7, 8, 10]);

export function exerciseInfrastructure() {
  const absent = validateChoroplethRows([
    {
      departement_code: "976",
      departement_name: "Mayotte",
      region_code: "06",
      period: null,
      unemployment_rate_pct: null,
      geometry_geojson: '{"type":"Polygon","coordinates":[[[45,-13],[45.3,-13],[45.3,-12.6],[45,-13]]]}',
      bbox_west: 45.022008,
      bbox_south: -12.999953,
      bbox_east: 45.298044,
      bbox_north: -12.63659,
    },
  ]);
  return {
    absent,
    classes: classBoundaryCases.map((item) => classOf(item.rate, MAP_CLASS_BREAKS)),
    labels: classLabels(MAP_CLASS_BREAKS),
    conversions: numericBoundaryCases.map((item) =>
      item.stored === null ? null : Number(item.stored),
    ),
    schemaState: stateForError({ code: "schema-incompatibility" }),
    engineState: stateForError({ code: "shared-engine-failure" }),
    renderState: stateForError({ code: "render" }, "slot"),
  };
}
