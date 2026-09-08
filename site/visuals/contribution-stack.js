import {
  PALETTE,
  chart,
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
export const CONTRIBUTION_STACK_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "contribution-stack",
  consumerSchema: {
    period: "string",
    food_pp: "number",
    services_pp: "number",
    manufactured_pp: "number",
    energy_pp: "number",
    headline_pct: "number",
    rent_pulse_pp: "number",
    rent_weight_per_10k: "number",
  },
  displaySchema: {
    width: "number",
    selectedIndex: "number",
    showRentLane: "boolean",
  },
  inputs: ["rows", "display", "provenance"],
  nonAdditiveFields: ["rent_pulse_pp"],
  cleanup: "none",
});
const KEYS = [
    ["food_pp", "food", "Food"],
    ["services_pp", "services", "Services"],
    ["manufactured_pp", "manufactured", "Manufactured"],
    ["energy_pp", "energy", "Energy"],
  ],
  FIELDS = [
    ...KEYS.map((x) => x[0]),
    "headline_pct",
    "rent_pulse_pp",
    "rent_weight_per_10k",
  ];
export function validateContributionStackRows(rows) {
  if (!Array.isArray(rows))
    throw new TypeError("Visual rows must be an array.");
  return rows.map((r, i) => {
    if (typeof r?.period !== "string")
      throw new TypeError(
        `contribution-stack@1.0.0 · row ${i} · expected string period`,
      );
    const out = { period: r.period };
    for (const f of FIELDS) {
      out[f] = Number(r[f]);
      if (!Number.isFinite(out[f]))
        throw new TypeError(
          `contribution-stack@1.0.0 · row ${i} · ${f}: expected number, received ${typeof r[f]}`,
        );
    }
    return out;
  });
}
export function renderContributionStack(input, display, provenance) {
  const rows = validateContributionStackRows(input),
    w = Math.max(320, display.width || 640),
    stackH = Math.round(Math.max(170, Math.min(260, w * 0.22))),
    laneH = display.showRentLane === false ? 0 : 62,
    h = stackH + 34 + laneH + 22,
    scale = xScale(rows.length, w),
    sums = rows.flatMap((r) => {
      let pos = 0,
        neg = 0;
      for (const [f] of KEYS) {
        if (r[f] >= 0) pos += r[f];
        else neg += r[f];
      }
      return [pos, neg, r.headline_pct];
    }),
    domain = niceDomain(Math.min(...sums), Math.max(...sums)),
    y = (v) =>
      12 + (1 - (v - domain.lo) / (domain.hi - domain.lo)) * (stackH - 12),
    bar = Math.max(1.5, Math.min(16, (scale.inner / rows.length) * 0.68)),
    si = Math.max(0, Math.min(rows.length - 1, display.selectedIndex)),
    selected = rows[si],
    { root, svg, overlay } = chart(
      w,
      h,
      `Official category contributions and headline inflation from ${periodLabel(rows[0].period)} to ${periodLabel(rows.at(-1).period)}. Rents are a separate Pulse-calculated non-additive lane. Selected ${periodLabel(selected.period)}. ${provenance?.summary || ""}`,
    );
  grid(svg, overlay, domain, y, w);
  rows.forEach((r, i) => {
    let pos = 0,
      neg = 0;
    for (const [f, key] of KEYS) {
      const from = r[f] >= 0 ? pos : neg,
        to = from + r[f];
      rect(
        svg,
        scale.x(i) - bar / 2,
        Math.min(y(from), y(to)),
        bar,
        Math.max(0.5, Math.abs(y(from) - y(to))),
        PALETTE[key],
      );
      if (r[f] >= 0) pos = to;
      else neg = to;
    }
  });
  polyline(
    svg,
    rows
      .map((r, i) => `${scale.x(i).toFixed(1)},${y(r.headline_pct).toFixed(1)}`)
      .join(" "),
    PALETTE.text,
    2,
    "5 4",
  );
  selection(svg, scale.x(si), stackH + 4);
  xTicks(overlay, rows, scale, stackH + 14, w);
  if (laneH) {
    const laneZero = stackH + 34 + laneH - 14,
      laneTop = laneZero - (laneH - 24),
      laneMax =
        Math.max(...rows.map((r) => Math.abs(r.rent_pulse_pp)), 0.001) * 1.15;
    rect(svg, scale.padL, laneZero, scale.inner, 1, PALETTE.zero);
    rows.forEach((r, i) => {
      const hh = (Math.abs(r.rent_pulse_pp) / laneMax) * (laneZero - laneTop);
      rect(
        svg,
        scale.x(i) - bar / 2,
        r.rent_pulse_pp >= 0 ? laneZero - hh : laneZero,
        bar,
        hh,
        PALETTE.rent,
        0.85,
      );
    });
    overlayLabel(overlay, laneMax.toFixed(2), 0, laneTop - 8, {
      width: 36,
      align: "right",
    });
    overlayLabel(overlay, "0", 0, laneZero - 8, { width: 36, align: "right" });
    overlayLabel(overlay, "Rents, pp", 0, laneZero + 6, {
      width: 58,
      align: "right",
      color: PALETTE.rent,
    });
  }
  const right = si > rows.length / 2,
    calloutW = 168,
    left = Math.max(
      42,
      Math.min(
        w - calloutW - 8,
        right ? scale.x(si) - calloutW - 8 : scale.x(si) + 8,
      ),
    ),
    box = document.createElement("div");
  box.className = "contribution-callout";
  box.style.left = `${left}px`;
  box.style.top = "6px";
  box.innerHTML = `<strong>${periodLabel(selected.period)}</strong>${KEYS.map(([f, key, label]) => `<span><i style="background:${PALETTE[key]}"></i>${label}<b>${signed(selected[f], 1, " pp")}</b></span>`).join("")}<span><i style="background:${PALETTE.text}"></i>Headline<b>${signed(selected.headline_pct, 1, "%")}</b></span><span class="rent-callout"><i style="background:${PALETTE.rent}"></i>Rents (Pulse)<b>${signed(selected.rent_pulse_pp, 3, " pp")}</b></span>`;
  overlay.append(box);
  enablePicking(svg, rows.length, scale.padL, scale.inner);
  return root;
}
