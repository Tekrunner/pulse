/** Application-owned Visual Contract v1 declaration for participation-gap-band.
 *
 * Two lines with the band between them shaded. The band is a RANGE, not a stack: it is the difference between two published rates and is labelled as derived wherever it appears. The fixture pins the widest gap in the series (10.6 points, 2003-Q4) and the narrowest (5.1 points, 2020-Q4). The all-ages column is carried so the report can switch to the basis that is comparable with the OECD figures; the 15-64 basis is NOT comparable with them and the two must never share an axis.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: INSEE, enquête Emploi, indicateurs trimestriels au sens du BIT. Licence Ouverte / Open Licence 2.0.
 */

export const PARTICIPATION_GAP_BAND_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "participation-gap-band",
  question: "What share of the population takes part in the labour market, and how far apart are men and women?",
  consumerSchema: Object.freeze({
    period: "string",  // "YYYY-MM-DD", first day of the quarter
    participation_rate_men_15_to_64_pct: "number",  // percent, men aged 15-64
    participation_rate_women_15_to_64_pct: "number",  // percent, women aged 15-64
    participation_rate_15_to_64_pct: "number",  // percent, both sexes aged 15-64
    participation_rate_pct: "number",  // percent, both sexes ALL AGES (the OECD-comparable basis)
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",  // px
    selectedIndex: "number",  // index into rows
    basis: "string",  // "15-64" or "all-ages"; the report owns the switch
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "2003-10-01",
        "participation_rate_men_15_to_64_pct": 75.7,
        "participation_rate_women_15_to_64_pct": 65.1,
        "participation_rate_15_to_64_pct": 70.4,
        "participation_rate_pct": 56.9
    },
    {
        "period": "2020-10-01",
        "participation_rate_men_15_to_64_pct": 75.0,
        "participation_rate_women_15_to_64_pct": 69.9,
        "participation_rate_15_to_64_pct": 72.4,
        "participation_rate_pct": 55.5
    },
    {
        "period": "2026-01-01",
        "participation_rate_men_15_to_64_pct": 78.2,
        "participation_rate_women_15_to_64_pct": 72.8,
        "participation_rate_15_to_64_pct": 75.5,
        "participation_rate_pct": 57.0
    },
    {
        "period": "2026-04-01",
        "participation_rate_men_15_to_64_pct": 78.0,
        "participation_rate_women_15_to_64_pct": 72.8,
        "participation_rate_15_to_64_pct": 75.4,
        "participation_rate_pct": 56.9
    }
]),
  cleanup: "none",
});

export function validateParticipationRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  const fields = [
    "participation_rate_men_15_to_64_pct",
    "participation_rate_women_15_to_64_pct",
    "participation_rate_15_to_64_pct",
    "participation_rate_pct",
  ];
  return rows.map((row) => {
    if (typeof row?.period !== "string") {
      throw new TypeError("participation-gap-band rows require a string period.");
    }
    const out = { period: row.period };
    for (const field of fields) {
      const value = Number(row?.[field]);
      if (!Number.isFinite(value)) {
        throw new TypeError(`participation-gap-band rows require a finite ${field}.`);
      }
      out[field] = value;
    }
    return out;
  });
}
