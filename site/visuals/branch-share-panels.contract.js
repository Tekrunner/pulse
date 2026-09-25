/** Application-owned Visual Contract v1 declaration for branch-share-panels.
 *
 * Small multiples, one panel per branch one level below the open branch, in a fixed alphabetical order by label so panels never move when the year changes (revised after review: ordering by share reshuffled them), one colour, each panel on its own vertical scale with y and x axes; the title carries the share in the selected year and the change since the window start. Panels with more than one sub-branch carry an open button; a breadcrumb returns. A88 carries the shorter-span warning; residual rows are dashed and tagged derived. The report passes every year of every branch at every level; each panel's x-axis is the represented period intersected with the span common to the branches shown. Boundary rows: A10 in 1949 and 2025, A38 children of BE, A88 children of CL and the residuals 24, 80, 05+07 and 98.
 *
 * Fixture rows are real published observations at provider precision, chosen to
 * include this visual's boundary cases. Source: INSEE, comptes nationaux annuels, base 2020 — production accounts by branch. Licence Ouverte / Open Licence 2.0.
 */

export const BRANCH_SHARE_PANELS_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "branch-share-panels",
  question: "How is value added distributed across branches of activity, and how has that distribution shifted, from broad sectors down to individual industries?",
  consumerSchema: Object.freeze({
    period: "string",
    level: "string",  // A10 | A38 | A88
    branch_code: "string",
    branch_label: "string",
    parent_code: "string|null",
    is_residual: "boolean",
    share_of_total_value_added_pct: "number",
  }),
  // Report-owned display inputs. The visual reads them; it never derives them.
  displaySchema: Object.freeze({
    width: "number",
    from: "number",  // represented period, first year
    to: "number",  // represented period, last year
    selectedYear: "number",
    path: "string[]",  // open branch keys `${level}:${branch_code}`, outermost first; [] = the A10 branches
    notes: "array",  // report-owned named warnings, {label, text}
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  fixtureRows: Object.freeze([
    {
        "period": "1949-01-01",
        "level": "A10",
        "branch_code": "AZ",
        "branch_label": "Agriculture, forestry, and fisheries",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 17.505
    },
    {
        "period": "1949-01-01",
        "level": "A10",
        "branch_code": "BE",
        "branch_label": "Mining, quarrying and manufacturing",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 27.982
    },
    {
        "period": "1949-01-01",
        "level": "A10",
        "branch_code": "FZ",
        "branch_label": "Construction",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 5.569
    },
    {
        "period": "1949-01-01",
        "level": "A10",
        "branch_code": "GI",
        "branch_label": "Wholesale and retail trade, transport, accommodation and food service activities",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 20.319
    },
    {
        "period": "1949-01-01",
        "level": "A10",
        "branch_code": "JZ",
        "branch_label": "Information and communication",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 2.506
    },
    {
        "period": "1949-01-01",
        "level": "A10",
        "branch_code": "KZ",
        "branch_label": "Financial and insurance activities",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 2.102
    },
    {
        "period": "1949-01-01",
        "level": "A10",
        "branch_code": "LZ",
        "branch_label": "Real estate",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 3.861
    },
    {
        "period": "1949-01-01",
        "level": "A10",
        "branch_code": "MN",
        "branch_label": "Professional, scientific and technical activities - Administrative and support service activities",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 5.329
    },
    {
        "period": "1949-01-01",
        "level": "A10",
        "branch_code": "OQ",
        "branch_label": "Public administration, education, health and social work",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 12.768
    },
    {
        "period": "1949-01-01",
        "level": "A10",
        "branch_code": "RU",
        "branch_label": "Other service activities",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 2.051
    },
    {
        "period": "2025-01-01",
        "level": "A10",
        "branch_code": "AZ",
        "branch_label": "Agriculture, forestry, and fisheries",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 1.55
    },
    {
        "period": "2025-01-01",
        "level": "A10",
        "branch_code": "BE",
        "branch_label": "Mining, quarrying and manufacturing",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 13.454
    },
    {
        "period": "2025-01-01",
        "level": "A10",
        "branch_code": "FZ",
        "branch_label": "Construction",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 5.572
    },
    {
        "period": "2025-01-01",
        "level": "A10",
        "branch_code": "GI",
        "branch_label": "Wholesale and retail trade, transport, accommodation and food service activities",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 16.684
    },
    {
        "period": "2025-01-01",
        "level": "A10",
        "branch_code": "JZ",
        "branch_label": "Information and communication",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 5.521
    },
    {
        "period": "2025-01-01",
        "level": "A10",
        "branch_code": "KZ",
        "branch_label": "Financial and insurance activities",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 3.612
    },
    {
        "period": "2025-01-01",
        "level": "A10",
        "branch_code": "LZ",
        "branch_label": "Real estate",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 14.137
    },
    {
        "period": "2025-01-01",
        "level": "A10",
        "branch_code": "MN",
        "branch_label": "Professional, scientific and technical activities - Administrative and support service activities",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 14.564
    },
    {
        "period": "2025-01-01",
        "level": "A10",
        "branch_code": "OQ",
        "branch_label": "Public administration, education, health and social work",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 21.756
    },
    {
        "period": "2025-01-01",
        "level": "A10",
        "branch_code": "RU",
        "branch_label": "Other service activities",
        "parent_code": null,
        "is_residual": false,
        "share_of_total_value_added_pct": 3.149
    },
    {
        "period": "1999-01-01",
        "level": "A88",
        "branch_code": "05+07",
        "branch_label": "Mining of coal and lignite; Mining of metal ores",
        "parent_code": "BZ",
        "is_residual": true,
        "share_of_total_value_added_pct": 0.016
    },
    {
        "period": "1999-01-01",
        "level": "A88",
        "branch_code": "24",
        "branch_label": "Manufacture of basic metals",
        "parent_code": "CH",
        "is_residual": true,
        "share_of_total_value_added_pct": 0.517
    },
    {
        "period": "1999-01-01",
        "level": "A88",
        "branch_code": "29",
        "branch_label": "Manufacture of motor vehicles, trailers and semi-trailers",
        "parent_code": "CL",
        "is_residual": false,
        "share_of_total_value_added_pct": 1.295
    },
    {
        "period": "1999-01-01",
        "level": "A88",
        "branch_code": "30",
        "branch_label": "Manufacture of other transport equipment",
        "parent_code": "CL",
        "is_residual": false,
        "share_of_total_value_added_pct": 0.668
    },
    {
        "period": "1999-01-01",
        "level": "A88",
        "branch_code": "80",
        "branch_label": "Security and investigation activities",
        "parent_code": "NZ",
        "is_residual": true,
        "share_of_total_value_added_pct": 0.247
    },
    {
        "period": "1999-01-01",
        "level": "A88",
        "branch_code": "98",
        "branch_label": "Undifferentiated goods- and services-producing activities of private households for own use",
        "parent_code": "TZ",
        "is_residual": true,
        "share_of_total_value_added_pct": 0.0
    },
    {
        "period": "2024-01-01",
        "level": "A88",
        "branch_code": "05+07",
        "branch_label": "Mining of coal and lignite; Mining of metal ores",
        "parent_code": "BZ",
        "is_residual": true,
        "share_of_total_value_added_pct": 0.0
    },
    {
        "period": "2024-01-01",
        "level": "A88",
        "branch_code": "24",
        "branch_label": "Manufacture of basic metals",
        "parent_code": "CH",
        "is_residual": true,
        "share_of_total_value_added_pct": 0.269
    },
    {
        "period": "2024-01-01",
        "level": "A88",
        "branch_code": "29",
        "branch_label": "Manufacture of motor vehicles, trailers and semi-trailers",
        "parent_code": "CL",
        "is_residual": false,
        "share_of_total_value_added_pct": 0.568
    },
    {
        "period": "2024-01-01",
        "level": "A88",
        "branch_code": "30",
        "branch_label": "Manufacture of other transport equipment",
        "parent_code": "CL",
        "is_residual": false,
        "share_of_total_value_added_pct": 1.004
    },
    {
        "period": "2024-01-01",
        "level": "A88",
        "branch_code": "80",
        "branch_label": "Security and investigation activities",
        "parent_code": "NZ",
        "is_residual": true,
        "share_of_total_value_added_pct": 0.342
    },
    {
        "period": "2024-01-01",
        "level": "A88",
        "branch_code": "98",
        "branch_label": "Undifferentiated goods- and services-producing activities of private households for own use",
        "parent_code": "TZ",
        "is_residual": true,
        "share_of_total_value_added_pct": 0.0
    }
]),
  cleanup: "none",
});

const LEVELS = Object.freeze(["A10", "A38", "A88"]);
const code = (value) => typeof value === "string" && value.length > 0;

/**
 * Rejects rows that do not match the consumer schema: an annual period, a
 * known level, a parent code exactly below A10, a boolean residual flag, a
 * finite share, and one row per branch and year.
 */
export function validateBranchSharePanelsRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  const seen = new Set();
  return rows.map((row) => {
    if (
      typeof row?.period !== "string" || !/^\d{4}-01-01$/.test(row.period)
      || !LEVELS.includes(row?.level) || !code(row?.branch_code) || !code(row?.branch_label)
      || (row.level === "A10" ? row.parent_code !== null : !code(row.parent_code))
      || typeof row?.is_residual !== "boolean"
      || typeof row?.share_of_total_value_added_pct !== "number" || !Number.isFinite(row.share_of_total_value_added_pct)
    ) {
      throw new TypeError("branch-share-panels rows do not match the consumer schema.");
    }
    const key = `${row.level}:${row.branch_code}:${row.period}`;
    if (seen.has(key)) throw new TypeError(`branch-share-panels has two rows for ${key}.`);
    seen.add(key);
    return Object.freeze({ ...row });
  });
}
