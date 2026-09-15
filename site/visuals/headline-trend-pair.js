import {
  PALETTE,
  chart,
  circle,
  enablePicking,
  grid,
  millions,
  niceSpan,
  placeChips,
  polyline,
  quarterLabel,
  selection,
  xScale,
  xTicks,
} from "./report-shared.js";

export const HEADLINE_TREND_PAIR_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "headline-trend-pair",
  question:
    "How many people in France are unemployed on the ILO definition, and what share of the labour force is that?",
  consumerSchema: Object.freeze({
    period: "string",
    unemployment_rate_pct: "number",
    unemployed_thousands: "number",
  }),
  displaySchema: Object.freeze({
    width: "number",
    selectedIndex: "number",
    representedPeriod: "string",
    color: "string",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  cleanup: "none",
});

export function validateHeadlineTrendPairRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row, i) => {
    const rate = Number(row?.unemployment_rate_pct),
      people = Number(row?.unemployed_thousands);
    if (
      typeof row?.period !== "string" ||
      !Number.isFinite(rate) ||
      !Number.isFinite(people)
    ) {
      throw new TypeError(
        `headline-trend-pair@1.0.0 · row ${i} · expected a string period and finite unemployment_rate_pct and unemployed_thousands`,
      );
    }
    return {
      period: row.period,
      unemployment_rate_pct: rate,
      unemployed_thousands: people,
    };
  });
}

/**
 * The rate is plotted; the headcount reaches the reader through the selected
 * observation rather than a second plot of the same quarters. The two are
 * independently published and move apart when the labour force itself changes,
 * so they never share an axis.
 */
export function renderHeadlineTrendPair(input, display, provenance) {
  const rows = validateHeadlineTrendPairRows(input),
    w = Math.max(320, display.width),
    h = Math.round(Math.max(210, Math.min(330, w * 0.3))),
    plotBottom = h - 34,
    scale = xScale(rows.length, w, 44, 24),
    values = rows.map((r) => r.unemployment_rate_pct),
    lo = Math.min(...values),
    hi = Math.max(...values),
    domain = niceSpan(lo, hi),
    y = (v) =>
      14 + (1 - (v - domain.lo) / (domain.hi - domain.lo)) * (plotBottom - 14),
    si = Math.max(0, Math.min(rows.length - 1, display.selectedIndex)),
    selected = rows[si],
    color = display.color || "#3987e5",
    { root, svg, overlay } = chart(
      w,
      h,
      `ILO unemployment rate, ${quarterLabel(rows[0].period)} to ${quarterLabel(rows.at(-1).period)}, between ${lo.toFixed(1)} and ${hi.toFixed(1)} percent of the labour force. Selected observation ${quarterLabel(selected.period)}: ${selected.unemployment_rate_pct.toFixed(1)} percent, ${millions(selected.unemployed_thousands, { long: true })} people. ${provenance?.summary || ""}`,
    );
  grid(svg, overlay, domain, y, w - (scale.padR - 14));
  polyline(
    svg,
    rows
      .map(
        (r, i) =>
          `${scale.x(i).toFixed(1)},${y(r.unemployment_rate_pct).toFixed(1)}`,
      )
      .join(" "),
    color,
  );
  selection(svg, scale.x(si), plotBottom);
  circle(svg, scale.x(si), y(selected.unemployment_rate_pct), 5, PALETTE.text, color, 2);
  // Rate and headcount reach the reader at the point itself, not under the
  // figure: they are the answer to "what was it then", and reading them should
  // cost no eye travel.
  placeChips(
    overlay,
    [
      {
        y: y(selected.unemployment_rate_pct),
        color: PALETTE.text,
        text: `${quarterLabel(selected.period)} · ${selected.unemployment_rate_pct.toFixed(1)}% · ${millions(selected.unemployed_thousands)}`,
      },
    ],
    { x: scale.x(si), width: w, height: h, flip: si > rows.length / 2 },
  );
  xTicks(overlay, rows, scale, h - 19, w, 64, quarterLabel);
  enablePicking(svg, rows.length, scale.padL, scale.inner);
  return root;
}
