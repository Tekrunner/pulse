/** Application-owned Visual Contract v1 declaration for output-growth-tail.
 *
 * Two plots on one time axis: the volume level on a log scale, then volume growth. Annual rows from french-national-accounts-annual (the row spine) are followed by quarterly rows from french-gdp-quarterly from Q1 of the year seven years before the latest quarter's year; the report joins them and marks each row's kind. The seam band and its label are part of the visual. Boundary rows: 1949 (no growth), 2020 (deepest contraction), the 2020 quarters (±12 to 17%), the latest year and the latest quarter.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: INSEE, comptes nationaux annuels et trimestriels, base 2020. Licence Ouverte / Open Licence 2.0.
 */

export const OUTPUT_GROWTH_TAIL_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "output-growth-tail",
  question: "How large is French GDP, in total and per inhabitant, and how fast has it grown in volume each year and over the most recent quarters?",
  consumerSchema: Object.freeze({
    kind: "string",  // 'annual' | 'quarter'
    period: "string",  // YYYY-MM-DD, first day of year or quarter
    gdp_volume_eur_bn: "number",  // chained 2020 €, annual total or annualised quarter
    growth_pct: "number|null",  // annual volume growth, or a quarter on the same quarter a year earlier
    quarter_on_quarter_pct: "number|null",  // quarters only
    gdp_per_capita_chained_eur: "number|null",  // annual rows only
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",
    mode: "string",  // 'total' | 'capita'
    selectedYear: "number",
    seamStart: "string",  // first quarterly period, computed by the report from the latest quarter
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "kind": "annual",
        "period": "1949-01-01",
        "gdp_volume_eur_bn": 284.7,
        "growth_pct": null,
        "quarter_on_quarter_pct": null,
        "gdp_per_capita_chained_eur": 6742.0
    },
    {
        "kind": "annual",
        "period": "1975-01-01",
        "gdp_volume_eur_bn": 1033.3,
        "growth_pct": -0.946,
        "quarter_on_quarter_pct": null,
        "gdp_per_capita_chained_eur": 19165.0
    },
    {
        "kind": "annual",
        "period": "2009-01-01",
        "gdp_volume_eur_bn": 2178.2,
        "growth_pct": -2.825,
        "quarter_on_quarter_pct": null,
        "gdp_per_capita_chained_eur": 33802.0
    },
    {
        "kind": "annual",
        "period": "2019-01-01",
        "gdp_volume_eur_bn": 2504.6,
        "growth_pct": 2.027,
        "quarter_on_quarter_pct": null,
        "gdp_per_capita_chained_eur": 37163.0
    },
    {
        "kind": "annual",
        "period": "2020-01-01",
        "gdp_volume_eur_bn": 2318.3,
        "growth_pct": -7.441,
        "quarter_on_quarter_pct": null,
        "gdp_per_capita_chained_eur": 34235.0
    },
    {
        "kind": "annual",
        "period": "2025-01-01",
        "gdp_volume_eur_bn": 2646.7,
        "growth_pct": 0.805,
        "quarter_on_quarter_pct": null,
        "gdp_per_capita_chained_eur": 38360.0
    },
    {
        "kind": "quarter",
        "period": "2019-01-01",
        "gdp_volume_eur_bn": 2501.4,
        "growth_pct": 2.47,
        "quarter_on_quarter_pct": 0.9,
        "gdp_per_capita_chained_eur": null
    },
    {
        "kind": "quarter",
        "period": "2020-01-01",
        "gdp_volume_eur_bn": 2377.0,
        "growth_pct": -4.97,
        "quarter_on_quarter_pct": -5.0,
        "gdp_per_capita_chained_eur": null
    },
    {
        "kind": "quarter",
        "period": "2020-04-01",
        "gdp_volume_eur_bn": 2086.7,
        "growth_pct": -16.99,
        "quarter_on_quarter_pct": -12.2,
        "gdp_per_capita_chained_eur": null
    },
    {
        "kind": "quarter",
        "period": "2020-07-01",
        "gdp_volume_eur_bn": 2402.8,
        "growth_pct": -4.46,
        "quarter_on_quarter_pct": 15.1,
        "gdp_per_capita_chained_eur": null
    },
    {
        "kind": "quarter",
        "period": "2021-04-01",
        "gdp_volume_eur_bn": 2442.5,
        "growth_pct": 17.05,
        "quarter_on_quarter_pct": 1.2,
        "gdp_per_capita_chained_eur": null
    },
    {
        "kind": "quarter",
        "period": "2026-04-01",
        "gdp_volume_eur_bn": 2659.0,
        "growth_pct": 0.54,
        "quarter_on_quarter_pct": 0.0,
        "gdp_per_capita_chained_eur": null
    }
]),
  cleanup: "none",
});

/** Rejects rows that do not match the consumer schema (kind in ('annual','quarter'), period string, gdp_volume_eur_bn finite and positive). */
export function validateOutputGrowthTailRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (!(typeof row?.kind === "string" && typeof row?.period === "string" && Number.isFinite(Number(row?.gdp_volume_eur_bn)))) {
      throw new TypeError("output-growth-tail rows do not match the consumer schema.");
    }
    return { ...row };
  });
}
