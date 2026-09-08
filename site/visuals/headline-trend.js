import {
  PALETTE,
  chart,
  circle,
  enablePicking,
  grid,
  niceDomain,
  overlayLabel,
  periodLabel,
  polyline,
  rect,
  selection,
  signed,
  xScale,
  xTicks,
} from "./report-shared.js";
export const HEADLINE_TREND_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "headline-trend",
  consumerSchema: {
    period: "string",
    annual_change_pct: "number",
    monthly_change_pct: "number",
  },
  displaySchema: {
    width: "number",
    selectedIndex: "number",
    unit: "string",
    color: "string",
    label: "string",
  },
  inputs: ["rows", "display", "provenance"],
  cleanup: "none",
});
export function validateHeadlineTrendRows(rows) {
  if (!Array.isArray(rows))
    throw new TypeError("Visual rows must be an array.");
  return rows.map((r, i) => {
    const annual = Number(r?.annual_change_pct),
      monthly =
        r?.monthly_change_pct == null ? null : Number(r.monthly_change_pct);
    if (
      typeof r?.period !== "string" ||
      !Number.isFinite(annual) ||
      (monthly !== null && !Number.isFinite(monthly))
    )
      throw new TypeError(
        `headline-trend@1.0.0 · row ${i} · expected finite annual and nullable monthly change`,
      );
    return {
      period: r.period,
      annual_change_pct: annual,
      monthly_change_pct: monthly,
    };
  });
}
export function renderHeadlineTrend(input, display, provenance) {
  const rows = validateHeadlineTrendRows(input),
    w = Math.max(320, display.width),
    h = Math.round(Math.max(190, Math.min(300, w * 0.26))),
    lineH = h - 96,
    barTop = h - 78,
    barH = 52,
    scale = xScale(rows.length, w),
    values = rows.map((r) => r.annual_change_pct),
    domain = niceDomain(Math.min(...values), Math.max(...values)),
    y = (v) =>
      12 + (1 - (v - domain.lo) / (domain.hi - domain.lo)) * (lineH - 12),
    momMax =
      Math.max(
        ...rows.flatMap((r) =>
          r.monthly_change_pct == null ? [] : [Math.abs(r.monthly_change_pct)],
        ),
      ) || 1,
    barZero = barTop + barH / 2,
    barWidth = Math.max(1.5, Math.min(14, (scale.inner / rows.length) * 0.62)),
    si = Math.max(0, Math.min(rows.length - 1, display.selectedIndex)),
    selected = rows[si],
    color = display.color || PALETTE.headline,
    { root, svg, overlay } = chart(
      w,
      h,
      `${display.label} annual change from ${periodLabel(rows[0].period)} to ${periodLabel(rows.at(-1).period)}, between ${Math.min(...values).toFixed(1)}% and ${Math.max(...values).toFixed(1)}%, ${periodLabel(selected.period)} ${signed(selected.annual_change_pct, 1, "%")} year on year and ${signed(selected.monthly_change_pct, 1, "%")} on the month. ${provenance?.summary || ""}`,
    );
  grid(svg, overlay, domain, y, w);
  polyline(
    svg,
    rows
      .map(
        (r, i) =>
          `${scale.x(i).toFixed(1)},${y(r.annual_change_pct).toFixed(1)}`,
      )
      .join(" "),
    color,
  );
  rows.forEach((r, i) => {
    if (r.monthly_change_pct == null) return;
    const hh = Math.max(
      1,
      ((Math.abs(r.monthly_change_pct) / momMax) * barH) / 2,
    );
    rect(
      svg,
      (scale.x(i) - barWidth / 2).toFixed(1),
      (r.monthly_change_pct >= 0 ? barZero - hh : barZero).toFixed(1),
      barWidth.toFixed(1),
      hh.toFixed(1),
      r.monthly_change_pct >= 0 ? color : PALETTE.zero,
    );
  });
  rect(svg, scale.padL, barZero, scale.inner, 1, PALETTE.zero);
  selection(svg, scale.x(si), barTop + barH);
  circle(
    svg,
    scale.x(si),
    y(selected.annual_change_pct),
    5,
    PALETTE.text,
    PALETTE.headline,
    2,
  );
  xTicks(overlay, rows, scale, h - 21, w);
  const right = si > rows.length / 2,
    left = Math.max(
      0,
      Math.min(w - 96, right ? scale.x(si) - 104 : scale.x(si) + 8),
    ),
    lineTop =
      y(selected.annual_change_pct) > 40
        ? y(selected.annual_change_pct) - 26
        : y(selected.annual_change_pct) + 10,
    momTop = selected.monthly_change_pct >= 0 ? barZero + 5 : barZero - 24;
  overlayLabel(
    overlay,
    `${signed(selected.annual_change_pct, 1, "%")} y/y`,
    left,
    lineTop,
    {
      width: 96,
      align: right ? "right" : "left",
      color: PALETTE.text,
      className: "selected-readout",
    },
  );
  overlayLabel(
    overlay,
    `${signed(selected.monthly_change_pct, 1, "%")} m/m`,
    left,
    momTop,
    {
      width: 96,
      align: right ? "right" : "left",
      color: PALETTE.text,
      className: "selected-readout",
    },
  );
  overlayLabel(overlay, "m/m", 0, barZero - 9, { width: 36, align: "right" });
  enablePicking(svg, rows.length, scale.padL, scale.inner);
  return root;
}
