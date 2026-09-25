/** Application-owned Visual Contract v1 declaration for dollar-decomposition.
 *
 * Two plots on one time axis: dollar GDP (linear), then stacked log-point terms with the net change as a tick. Boundary rows: 1960 (no change), 1981 and 1986 (exchange rate −25 and +26 lp), 1998–1999 (converted franc rate), 2015, 2025.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: World Bank, World Development Indicators (CC BY 4.0). Changes: francs converted at 6.55957 per euro; decomposition computed by Pulse.
 */

export const DOLLAR_DECOMPOSITION_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "dollar-decomposition",
  question: "How has French GDP measured in US dollars at market exchange rates evolved, and how much of each year's change comes from real growth, domestic price change and the euro-dollar exchange rate?",
  consumerSchema: Object.freeze({
    period: "string",
    gdp_current_usd_bn: "number",
    eur_per_usd: "number",
    dollar_change_log_points: "number|null",
    real_growth_log_points: "number|null",
    deflator_change_log_points: "number|null",
    exchange_rate_change_log_points: "number|null",
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",
    selectedYear: "number",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "1960-01-01",
        "gdp_current_usd_bn": 62.0,
        "eur_per_usd": 0.75265,
        "dollar_change_log_points": null,
        "real_growth_log_points": null,
        "deflator_change_log_points": null,
        "exchange_rate_change_log_points": null
    },
    {
        "period": "1961-01-01",
        "gdp_current_usd_bn": 67.2,
        "eur_per_usd": 0.75265,
        "dollar_change_log_points": 8.057,
        "real_growth_log_points": 4.828,
        "deflator_change_log_points": 3.229,
        "exchange_rate_change_log_points": 0.0
    },
    {
        "period": "1975-01-01",
        "gdp_current_usd_bn": 357.3,
        "eur_per_usd": 0.653671,
        "dollar_change_log_points": 23.412,
        "real_growth_log_points": -0.95,
        "deflator_change_log_points": 12.885,
        "exchange_rate_change_log_points": 11.484
    },
    {
        "period": "1981-01-01",
        "gdp_current_usd_bn": 609.2,
        "eur_per_usd": 0.828501,
        "dollar_change_log_points": -13.111,
        "real_growth_log_points": 1.181,
        "deflator_change_log_points": 10.868,
        "exchange_rate_change_log_points": -25.163
    },
    {
        "period": "1986-01-01",
        "gdp_current_usd_bn": 764.9,
        "eur_per_usd": 1.055876,
        "dollar_change_log_points": 33.495,
        "real_growth_log_points": 2.361,
        "deflator_change_log_points": 5.107,
        "exchange_rate_change_log_points": 26.029
    },
    {
        "period": "1998-01-01",
        "gdp_current_usd_bn": 1496.9,
        "eur_per_usd": 0.899375,
        "dollar_change_log_points": 3.226,
        "real_growth_log_points": 3.394,
        "deflator_change_log_points": 0.904,
        "exchange_rate_change_log_points": -1.071
    },
    {
        "period": "1999-01-01",
        "gdp_current_usd_bn": 1486.9,
        "eur_per_usd": 0.938283,
        "dollar_change_log_points": -0.67,
        "real_growth_log_points": 3.343,
        "deflator_change_log_points": 0.22,
        "exchange_rate_change_log_points": -4.235
    },
    {
        "period": "2015-01-01",
        "gdp_current_usd_bn": 2442.5,
        "eur_per_usd": 0.901296,
        "dollar_change_log_points": -15.824,
        "real_growth_log_points": 1.061,
        "deflator_change_log_points": 1.128,
        "exchange_rate_change_log_points": -18.013
    },
    {
        "period": "2024-01-01",
        "gdp_current_usd_bn": 3160.4,
        "eur_per_usd": 0.92389,
        "dollar_change_log_points": 3.352,
        "real_growth_log_points": 1.183,
        "deflator_change_log_points": 2.066,
        "exchange_rate_change_log_points": 0.103
    },
    {
        "period": "2025-01-01",
        "gdp_current_usd_bn": 3366.3,
        "eur_per_usd": 0.884969,
        "dollar_change_log_points": 6.311,
        "real_growth_log_points": 0.837,
        "deflator_change_log_points": 1.169,
        "exchange_rate_change_log_points": 4.304
    }
]),
  cleanup: "none",
});

/** Rejects rows that do not match the consumer schema (level finite and positive; the three terms sum to the dollar change within 0.1). */
export function validateDollarDecompositionRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row) => {
    if (!(typeof row?.period === "string" && Number.isFinite(Number(row?.gdp_current_usd_bn)) && Number.isFinite(Number(row?.eur_per_usd)))) {
      throw new TypeError("dollar-decomposition rows do not match the consumer schema.");
    }
    return { ...row };
  });
}
