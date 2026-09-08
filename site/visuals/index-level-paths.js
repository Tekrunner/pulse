import {
  DASH,
  PALETTE,
  chart,
  circle,
  enablePicking,
  line,
  overlayLabel,
  periodLabel,
  polyline,
  selection,
  xScale,
  xTicks,
} from "./report-shared.js";
export const INDEX_LEVEL_PATHS_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "index-level-paths",
  consumerSchema: { period: "string", series: "string", index: "number" },
  displaySchema: {
    width: "number",
    selectedIndex: "number",
    referenceValue: "number",
  },
  inputs: ["rows", "display", "provenance"],
  cleanup: "none",
});
const SERIES = new Set([
    "headline",
    "food",
    "services",
    "manufactured",
    "energy",
    "rent",
  ]),
  NAMES = {
    headline: "Headline",
    food: "Food",
    services: "Services",
    manufactured: "Manufactured",
    energy: "Energy",
    rent: "Rents",
  };
export function validateIndexLevelRows(rows) {
  if (!Array.isArray(rows))
    throw new TypeError("Visual rows must be an array.");
  return rows.map((r, i) => {
    const value = Number(r.index);
    if (
      typeof r?.period !== "string" ||
      !SERIES.has(r.series) ||
      !Number.isFinite(value)
    )
      throw new TypeError(
        `index-level-paths@1.0.0 · row ${i} · incompatible schema`,
      );
    return { period: r.period, series: r.series, index: value };
  });
}
export function renderIndexLevelPaths(input, display, provenance) {
  const rows = validateIndexLevelRows(input),
    series = [...new Set(rows.map((r) => r.series))],
    grouped = Object.fromEntries(
      series.map((k) => [k, rows.filter((r) => r.series === k)]),
    ),
    base = grouped[series[0]],
    w = Math.max(320, display.width || 640),
    h = Math.round(Math.max(200, Math.min(300, w * 0.24))),
    si = Math.max(0, Math.min(base.length - 1, display.selectedIndex)),
    scale = xScale(base.length, w),
    values = rows.map((r) => r.index).concat([display.referenceValue || 100]),
    rawLo = Math.min(...values),
    rawHi = Math.max(...values),
    pad = (rawHi - rawLo || 1) * 0.12,
    lo = Math.floor(rawLo - pad),
    hi = Math.ceil(rawHi + pad),
    y = (v) => 12 + (1 - (v - lo) / (hi - lo)) * (h - 48),
    { root, svg, overlay } = chart(
      w,
      h,
      `Consumer price index levels, Base 2025 equals 100, from ${periodLabel(base[0].period)} to ${periodLabel(base.at(-1).period)}. Selected ${periodLabel(base[si].period)}. ${provenance?.summary || ""}`,
    ),
    step = Math.max(1, Math.round((hi - lo) / 4));
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    if (v !== 100 && Math.abs(y(v) - y(100)) < 17) continue;
    line(svg, {
      x1: scale.padL,
      x2: scale.right,
      y1: y(v),
      y2: y(v),
      stroke: v === 100 ? PALETTE.zero : PALETTE.grid,
      "stroke-width": v === 100 ? 1.5 : 1,
    });
    overlayLabel(overlay, String(v), 0, y(v) - 8, {
      width: 36,
      align: "right",
      color: v === 100 ? PALETTE.text : PALETTE.muted,
    });
  }
  // The base-year reference is required even when automatic ticks skip 100.
  if (100 % step !== 0) {
    line(svg, { x1: scale.padL, x2: scale.right, y1: y(100), y2: y(100),
      stroke: PALETTE.zero, "stroke-width": 1.5 });
    overlayLabel(overlay, "100", 0, y(100) - 8, {
      width: 36, align: "right", color: PALETTE.text,
    });
  }
  selection(svg, scale.x(si), h - 28);
  const chips = [];
  for (const key of series) {
    const items = grouped[key];
    polyline(
      svg,
      items.map((r, i) => `${scale.x(i)},${y(r.index)}`).join(" "),
      PALETTE[key],
      key === "headline" ? 2.7 : 2,
      DASH[key],
    );
    const current = items[si];
    circle(svg, scale.x(si), y(current.index), 3.5, PALETTE[key]);
    chips.push({
      key,
      y: y(current.index),
      text: `${NAMES[key]} ${current.index.toFixed(2)}`,
    });
  }
  chips.sort((a, b) => a.y - b.y);
  for (let i = 1; i < chips.length; i++)
    chips[i].labelY = Math.max(
      chips[i].y,
      (chips[i - 1].labelY ?? chips[i - 1].y) + 17,
    );
  const overflow = (chips.at(-1)?.labelY ?? 0) - (h - 38);
  if (overflow > 0)
    for (const c of chips) c.labelY = (c.labelY ?? c.y) - overflow;
  for (const c of chips)
    c.labelY = Math.max(8, Math.min(h - 38, c.labelY ?? c.y));
  const flip = si > base.length / 2;
  for (const c of chips) {
    const width = Math.min(146, Math.max(84, c.text.length * 7 + 12)),
      left = flip ? scale.x(si) - width - 7 : scale.x(si) + 7;
    const chip = overlayLabel(
      overlay,
      c.text,
      Math.max(38, Math.min(w - width - 4, left)),
      c.labelY - 8,
      { width, align: "left", color: PALETTE[c.key], className: "index-chip" },
    );
    chip.style.background = "#1f2233";
  }
  xTicks(overlay, base, scale, h - 21, w);
  enablePicking(svg, base.length, scale.padL, scale.inner);
  return root;
}
