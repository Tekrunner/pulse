import { runReportSlot } from "../../../data/report-runtime.js";

export const REPORT_ID = "synthetic-report";
export const PRIMARY_QUERY = "SELECT period, CAST(value AS DOUBLE) AS value FROM synthetic_table WHERE period BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY period";

export function mountPrimarySlot({ element, client, annotations, render, start, end }) {
  const execute = () => runReportSlot({
    element,
    annotations,
    anchorColumn: "period",
    query: () => client.query("synthetic-dataset", PRIMARY_QUERY, {
      params: [start, end],
      expectedColumns: ["period", "value"],
      requireRows: true,
      mapRow: (row) => ({ period: String(row.period), value: Number(row.value) }),
    }),
    mapRows: (row) => row,
    render,
    retry: execute,
  });
  return execute();
}
