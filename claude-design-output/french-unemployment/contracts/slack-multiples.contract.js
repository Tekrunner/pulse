/** Application-owned Visual Contract v1 declaration for slack-multiples.
 *
 * FOUR panels, each on its own scale, never a stack and never a shared rate axis. The four measures overlap (a long-term unemployed person is also unemployed) so they are not parts of a whole, and their published rates have four different denominators, named in the consumer schema above. A visual that stacks them, sums them, or puts the four rates on one axis is wrong. The 2020-Q2 row is retained because the pandemic quarter is the sharpest divergence between the measures in the series.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: INSEE, enquête Emploi, indicateurs trimestriels au sens du BIT. Licence Ouverte / Open Licence 2.0.
 */

export const SLACK_MULTIPLES_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "slack-multiples",
  question: "Beyond headline ILO unemployment, how large are long-term unemployment, the halo around unemployment and underemployment?",
  consumerSchema: Object.freeze({
    period: "string",  // "YYYY-MM-DD", first day of the quarter
    unemployed_thousands: "number",  // thousands; rate is a share of the labour force
    unemployment_rate_pct: "number",  // percent of the LABOUR FORCE
    long_term_unemployed_thousands: "number",  // thousands
    long_term_unemployment_rate_pct: "number",  // percent of the LABOUR FORCE
    halo_15_to_64_thousands: "number",  // thousands
    halo_share_of_population_15_to_64_pct: "number",  // percent of the POPULATION aged 15-64
    underemployed_thousands: "number",  // thousands
    underemployment_rate_pct: "number",  // percent of EMPLOYMENT
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px
    selectedIndex: "number",  // index into rows
    representedPeriod: "string",  // human label
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "2003-01-01",
        "unemployed_thousands": 2327.0,
        "unemployment_rate_pct": 8.4,
        "long_term_unemployed_thousands": 604.0,
        "long_term_unemployment_rate_pct": 2.2,
        "halo_15_to_64_thousands": 1501.0,
        "halo_share_of_population_15_to_64_pct": 3.8,
        "underemployed_thousands": 1335.0,
        "underemployment_rate_pct": 5.2
    },
    {
        "period": "2020-04-01",
        "unemployed_thousands": 2096.0,
        "unemployment_rate_pct": 7.2,
        "long_term_unemployed_thousands": 455.0,
        "long_term_unemployment_rate_pct": 1.6,
        "halo_15_to_64_thousands": 2832.0,
        "halo_share_of_population_15_to_64_pct": 6.9,
        "underemployed_thousands": 4221.0,
        "underemployment_rate_pct": 15.6
    },
    {
        "period": "2026-01-01",
        "unemployed_thousands": 2615.0,
        "unemployment_rate_pct": 8.1,
        "long_term_unemployed_thousands": 635.0,
        "long_term_unemployment_rate_pct": 2.0,
        "halo_15_to_64_thousands": 1822.0,
        "halo_share_of_population_15_to_64_pct": 4.4,
        "underemployed_thousands": 1302.0,
        "underemployment_rate_pct": 4.4
    },
    {
        "period": "2026-04-01",
        "unemployed_thousands": 2677.0,
        "unemployment_rate_pct": 8.3,
        "long_term_unemployed_thousands": 671.0,
        "long_term_unemployment_rate_pct": 2.1,
        "halo_15_to_64_thousands": 1825.0,
        "halo_share_of_population_15_to_64_pct": 4.4,
        "underemployed_thousands": 1296.0,
        "underemployment_rate_pct": 4.4
    }
]),
  cleanup: "none",
});

const SLACK_MEASURES = Object.freeze([
  { count: "unemployed_thousands", rate: "unemployment_rate_pct", denominator: "the labour force" },
  { count: "long_term_unemployed_thousands", rate: "long_term_unemployment_rate_pct", denominator: "the labour force" },
  { count: "halo_15_to_64_thousands", rate: "halo_share_of_population_15_to_64_pct", denominator: "the population aged 15 to 64" },
  { count: "underemployed_thousands", rate: "underemployment_rate_pct", denominator: "employment" },
]);

export { SLACK_MEASURES };

export function validateSlackMultiplesRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (typeof row?.period !== "string") {
      throw new TypeError("slack-multiples rows require a string period.");
    }
    const out = { period: row.period };
    for (const measure of SLACK_MEASURES) {
      for (const field of [measure.count, measure.rate]) {
        const value = Number(row?.[field]);
        if (!Number.isFinite(value)) {
          throw new TypeError(`slack-multiples rows require a finite ${field}.`);
        }
        out[field] = value;
      }
    }
    return out;
  });
}
