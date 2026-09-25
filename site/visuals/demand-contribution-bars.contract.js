/** Application-owned Visual Contract v1 declaration for demand-contribution-bars.
 *
 * Diverging stacked bars of five contributions to real GDP growth, one bar per year, positive contributions stacked above zero and negative ones below, with real GDP growth as a dot; the selected year's dot is enlarged. Households include NPISH and inventories include valuables, merged by the report, which keeps the stack additive and removes two slivers too thin to read. The report passes one row per year with published growth; a contribution may be null and then draws no segment. A selected year without a row says so in the value strip. Boundary rows: 1975 (inventories −3.0, net trade +1.3), 2009, 2020 (consumption −4.5), 2025.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: INSEE, comptes nationaux annuels, base 2020. Licence Ouverte / Open Licence 2.0.
 */

export const DEMAND_CONTRIBUTION_BARS_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "demand-contribution-bars",
  question: "Which expenditure components have carried or held back GDP volume growth in each year?",
  consumerSchema: Object.freeze({
    period: "string",  // YYYY-01-01
    households_pt: "number|null",  // household consumption including NPISH, percentage points
    government_pt: "number|null",  // government consumption, percentage points
    investment_pt: "number|null",  // gross fixed capital formation, percentage points
    inventories_pt: "number|null",  // changes in inventories including valuables, percentage points
    net_trade_pt: "number|null",  // exports less imports, percentage points
    gdp_growth_pct: "number",  // real GDP growth, %
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",
    from: "number",  // represented period, first year
    to: "number",  // represented period, last year
    selectedYear: "number",
    notes: "array",  // report-owned named warnings, {label, text}
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "1975-01-01",
        "households_pt": 1.12,
        "government_pt": 1.008,
        "investment_pt": -1.39,
        "inventories_pt": -2.999,
        "net_trade_pt": 1.315,
        "gdp_growth_pct": -0.946
    },
    {
        "period": "1993-01-01",
        "households_pt": 0.256,
        "government_pt": 0.795,
        "investment_pt": -1.246,
        "inventories_pt": -0.958,
        "net_trade_pt": 0.793,
        "gdp_growth_pct": -0.359
    },
    {
        "period": "2009-01-01",
        "households_pt": 0.152,
        "government_pt": 0.632,
        "investment_pt": -2.116,
        "inventories_pt": -1.116,
        "net_trade_pt": -0.377,
        "gdp_growth_pct": -2.825
    },
    {
        "period": "2020-01-01",
        "households_pt": -3.493,
        "government_pt": -1.004,
        "investment_pt": -1.307,
        "inventories_pt": -0.291,
        "net_trade_pt": -1.346,
        "gdp_growth_pct": -7.441
    },
    {
        "period": "2021-01-01",
        "households_pt": 2.815,
        "government_pt": 1.68,
        "investment_pt": 2.184,
        "inventories_pt": -0.528,
        "net_trade_pt": 0.732,
        "gdp_growth_pct": 6.882
    },
    {
        "period": "2025-01-01",
        "households_pt": 0.197,
        "government_pt": 0.146,
        "investment_pt": 0.107,
        "inventories_pt": 0.526,
        "net_trade_pt": -0.172,
        "gdp_growth_pct": 0.805
    }
]),
  cleanup: "none",
});

const CONTRIBUTIONS = Object.freeze(["households_pt", "government_pt", "investment_pt", "inventories_pt", "net_trade_pt"]);
const nullableNumber = (value) => value === null || Number.isFinite(value);

/** Rejects rows that do not match the consumer schema: an annual period, five nullable contributions and a finite growth. */
export function validateDemandContributionBarsRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (
      typeof row?.period !== "string" || !/^\d{4}-01-01$/.test(row.period)
      || !CONTRIBUTIONS.every((key) => nullableNumber(row[key]))
      || !Number.isFinite(row.gdp_growth_pct)
    ) {
      throw new TypeError("demand-contribution-bars rows do not match the consumer schema.");
    }
    return Object.freeze({ ...row });
  });
}
