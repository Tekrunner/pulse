/** Application-owned Visual Contract v1 declaration for departement-choropleth.
 *
 * Hand-authored SVG map on the geometry rows (the row spine: a departement with no figure still renders, in the not-published hatch), eight index bins with a neutral 90-110 class, an inset for Paris and the inner ring and one per overseas departement, a selected departement's path over time, and highest and lowest lists. A selected year outside the published span shows the not-published state and a button selecting the latest year. Boundary rows: Paris and Hauts-de-Seine (index ~314 and ~281), Creuse, Guyane, Mayotte before and from 2014, Corsica.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: Eurostat, nama_10r_3gdp; boundaries IGN.
 */

export const DEPARTEMENT_CHOROPLETH_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "departement-choropleth",
  question: "How unevenly is GDP per inhabitant spread across the French departements?",
  consumerSchema: Object.freeze({
    departement_code: "string",
    departement_name: "string",
    geometry: "object",  // GeoJSON from french-departement-geometry
    period: "string|null",
    gdp_per_inhabitant_eur: "number|null",
    gdp_per_inhabitant_pps: "number|null",
    gdp_per_inhabitant_index_france: "number|null",
    is_provisional: "boolean|null",
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",
    selectedYear: "number",
    selectedDepartement: "string",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "departement_code": "23",
        "departement_name": "Creuse",
        "period": "2000-01-01",
        "gdp_per_inhabitant_eur": 15200.0,
        "gdp_per_inhabitant_pps": 13600.0,
        "gdp_per_inhabitant_index_france": 62.6,
        "is_provisional": false
    },
    {
        "departement_code": "23",
        "departement_name": "Creuse",
        "period": "2013-01-01",
        "gdp_per_inhabitant_eur": 19500.0,
        "gdp_per_inhabitant_pps": 17300.0,
        "gdp_per_inhabitant_index_france": 60.4,
        "is_provisional": false
    },
    {
        "departement_code": "23",
        "departement_name": "Creuse",
        "period": "2014-01-01",
        "gdp_per_inhabitant_eur": 20000.0,
        "gdp_per_inhabitant_pps": 17800.0,
        "gdp_per_inhabitant_index_france": 61.3,
        "is_provisional": false
    },
    {
        "departement_code": "23",
        "departement_name": "Creuse",
        "period": "2024-01-01",
        "gdp_per_inhabitant_eur": 25900.0,
        "gdp_per_inhabitant_pps": 23800.0,
        "gdp_per_inhabitant_index_france": 60.8,
        "is_provisional": true
    },
    {
        "departement_code": "2A",
        "departement_name": "Corse-du-Sud",
        "period": "2000-01-01",
        "gdp_per_inhabitant_eur": 21400.0,
        "gdp_per_inhabitant_pps": 19100.0,
        "gdp_per_inhabitant_index_france": 88.1,
        "is_provisional": false
    },
    {
        "departement_code": "2A",
        "departement_name": "Corse-du-Sud",
        "period": "2013-01-01",
        "gdp_per_inhabitant_eur": 30000.0,
        "gdp_per_inhabitant_pps": 26700.0,
        "gdp_per_inhabitant_index_france": 92.9,
        "is_provisional": false
    },
    {
        "departement_code": "2A",
        "departement_name": "Corse-du-Sud",
        "period": "2014-01-01",
        "gdp_per_inhabitant_eur": 30000.0,
        "gdp_per_inhabitant_pps": 26600.0,
        "gdp_per_inhabitant_index_france": 92.0,
        "is_provisional": false
    },
    {
        "departement_code": "2A",
        "departement_name": "Corse-du-Sud",
        "period": "2024-01-01",
        "gdp_per_inhabitant_eur": 41800.0,
        "gdp_per_inhabitant_pps": 38500.0,
        "gdp_per_inhabitant_index_france": 98.1,
        "is_provisional": true
    },
    {
        "departement_code": "2B",
        "departement_name": "Haute-Corse",
        "period": "2000-01-01",
        "gdp_per_inhabitant_eur": 17100.0,
        "gdp_per_inhabitant_pps": 15300.0,
        "gdp_per_inhabitant_index_france": 70.4,
        "is_provisional": false
    },
    {
        "departement_code": "2B",
        "departement_name": "Haute-Corse",
        "period": "2013-01-01",
        "gdp_per_inhabitant_eur": 24800.0,
        "gdp_per_inhabitant_pps": 22000.0,
        "gdp_per_inhabitant_index_france": 76.8,
        "is_provisional": false
    },
    {
        "departement_code": "2B",
        "departement_name": "Haute-Corse",
        "period": "2014-01-01",
        "gdp_per_inhabitant_eur": 25300.0,
        "gdp_per_inhabitant_pps": 22400.0,
        "gdp_per_inhabitant_index_france": 77.6,
        "is_provisional": false
    },
    {
        "departement_code": "2B",
        "departement_name": "Haute-Corse",
        "period": "2024-01-01",
        "gdp_per_inhabitant_eur": 33600.0,
        "gdp_per_inhabitant_pps": 30900.0,
        "gdp_per_inhabitant_index_france": 78.9,
        "is_provisional": true
    },
    {
        "departement_code": "69",
        "departement_name": "Rhône",
        "period": "2000-01-01",
        "gdp_per_inhabitant_eur": 31300.0,
        "gdp_per_inhabitant_pps": 28000.0,
        "gdp_per_inhabitant_index_france": 128.8,
        "is_provisional": false
    },
    {
        "departement_code": "69",
        "departement_name": "Rhône",
        "period": "2013-01-01",
        "gdp_per_inhabitant_eur": 42100.0,
        "gdp_per_inhabitant_pps": 37400.0,
        "gdp_per_inhabitant_index_france": 130.3,
        "is_provisional": false
    },
    {
        "departement_code": "69",
        "departement_name": "Rhône",
        "period": "2014-01-01",
        "gdp_per_inhabitant_eur": 42500.0,
        "gdp_per_inhabitant_pps": 37700.0,
        "gdp_per_inhabitant_index_france": 130.4,
        "is_provisional": false
    },
    {
        "departement_code": "69",
        "departement_name": "Rhône",
        "period": "2024-01-01",
        "gdp_per_inhabitant_eur": 57600.0,
        "gdp_per_inhabitant_pps": 53100.0,
        "gdp_per_inhabitant_index_france": 135.2,
        "is_provisional": true
    },
    {
        "departement_code": "75",
        "departement_name": "Paris",
        "period": "2000-01-01",
        "gdp_per_inhabitant_eur": 70800.0,
        "gdp_per_inhabitant_pps": 63200.0,
        "gdp_per_inhabitant_index_france": 291.4,
        "is_provisional": false
    },
    {
        "departement_code": "75",
        "departement_name": "Paris",
        "period": "2013-01-01",
        "gdp_per_inhabitant_eur": 90900.0,
        "gdp_per_inhabitant_pps": 80800.0,
        "gdp_per_inhabitant_index_france": 281.4,
        "is_provisional": false
    },
    {
        "departement_code": "75",
        "departement_name": "Paris",
        "period": "2014-01-01",
        "gdp_per_inhabitant_eur": 92500.0,
        "gdp_per_inhabitant_pps": 82100.0,
        "gdp_per_inhabitant_index_france": 283.7,
        "is_provisional": false
    },
    {
        "departement_code": "75",
        "departement_name": "Paris",
        "period": "2024-01-01",
        "gdp_per_inhabitant_eur": 133700.0,
        "gdp_per_inhabitant_pps": 123100.0,
        "gdp_per_inhabitant_index_france": 313.8,
        "is_provisional": true
    },
    {
        "departement_code": "92",
        "departement_name": "Hauts-de-Seine",
        "period": "2000-01-01",
        "gdp_per_inhabitant_eur": 65000.0,
        "gdp_per_inhabitant_pps": 58000.0,
        "gdp_per_inhabitant_index_france": 267.5,
        "is_provisional": false
    },
    {
        "departement_code": "92",
        "departement_name": "Hauts-de-Seine",
        "period": "2013-01-01",
        "gdp_per_inhabitant_eur": 94700.0,
        "gdp_per_inhabitant_pps": 84200.0,
        "gdp_per_inhabitant_index_france": 293.2,
        "is_provisional": false
    },
    {
        "departement_code": "92",
        "departement_name": "Hauts-de-Seine",
        "period": "2014-01-01",
        "gdp_per_inhabitant_eur": 94900.0,
        "gdp_per_inhabitant_pps": 84200.0,
        "gdp_per_inhabitant_index_france": 291.1,
        "is_provisional": false
    },
    {
        "departement_code": "92",
        "departement_name": "Hauts-de-Seine",
        "period": "2024-01-01",
        "gdp_per_inhabitant_eur": 119700.0,
        "gdp_per_inhabitant_pps": 110200.0,
        "gdp_per_inhabitant_index_france": 281.0,
        "is_provisional": true
    },
    {
        "departement_code": "973",
        "departement_name": "Guyane",
        "period": "2000-01-01",
        "gdp_per_inhabitant_eur": 12800.0,
        "gdp_per_inhabitant_pps": 11400.0,
        "gdp_per_inhabitant_index_france": 52.7,
        "is_provisional": false
    },
    {
        "departement_code": "973",
        "departement_name": "Guyane",
        "period": "2013-01-01",
        "gdp_per_inhabitant_eur": 16700.0,
        "gdp_per_inhabitant_pps": 14900.0,
        "gdp_per_inhabitant_index_france": 51.7,
        "is_provisional": false
    },
    {
        "departement_code": "973",
        "departement_name": "Guyane",
        "period": "2014-01-01",
        "gdp_per_inhabitant_eur": 16700.0,
        "gdp_per_inhabitant_pps": 14800.0,
        "gdp_per_inhabitant_index_france": 51.2,
        "is_provisional": false
    },
    {
        "departement_code": "973",
        "departement_name": "Guyane",
        "period": "2024-01-01",
        "gdp_per_inhabitant_eur": 17700.0,
        "gdp_per_inhabitant_pps": 16300.0,
        "gdp_per_inhabitant_index_france": 41.5,
        "is_provisional": true
    },
    {
        "departement_code": "976",
        "departement_name": "Mayotte",
        "period": "2000-01-01",
        "gdp_per_inhabitant_eur": null,
        "gdp_per_inhabitant_pps": null,
        "gdp_per_inhabitant_index_france": null,
        "is_provisional": false
    },
    {
        "departement_code": "976",
        "departement_name": "Mayotte",
        "period": "2013-01-01",
        "gdp_per_inhabitant_eur": null,
        "gdp_per_inhabitant_pps": null,
        "gdp_per_inhabitant_index_france": null,
        "is_provisional": false
    },
    {
        "departement_code": "976",
        "departement_name": "Mayotte",
        "period": "2014-01-01",
        "gdp_per_inhabitant_eur": 7600.0,
        "gdp_per_inhabitant_pps": 6800.0,
        "gdp_per_inhabitant_index_france": 23.3,
        "is_provisional": false
    },
    {
        "departement_code": "976",
        "departement_name": "Mayotte",
        "period": "2024-01-01",
        "gdp_per_inhabitant_eur": 13100.0,
        "gdp_per_inhabitant_pps": 12000.0,
        "gdp_per_inhabitant_index_france": 30.8,
        "is_provisional": true
    }
]),
  cleanup: "none",
});

/** Rejects rows that do not match the consumer schema (code string; index finite or null). */
export function validateDepartementChoroplethRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (!(typeof row?.departement_code === "string" && typeof row?.departement_name === "string")) {
      throw new TypeError("departement-choropleth rows do not match the consumer schema.");
    }
    return { ...row };
  });
}
