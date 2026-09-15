import {
  PALETTE,
  chart,
  circle,
  enablePicking,
  grid,
  niceSpan,
  placeChips,
  polyline,
  quarterLabel,
  selection,
  xScale,
  xTicks,
} from "./report-shared.js";

export const PARTICIPATION_GAP_BAND_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "participation-gap-band",
  question:
    "What share of the population takes part in the labour market, and how far apart are men and women?",
  consumerSchema: Object.freeze({
    period: "string",
    participation_rate_men_15_to_64_pct: "number",
    participation_rate_women_15_to_64_pct: "number",
    participation_rate_15_to_64_pct: "number",
    participation_rate_pct: "number",
  }),
  displaySchema: Object.freeze({
    width: "number",
    selectedIndex: "number",
    basis: "string",
    seriesColours: "object",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  cleanup: "none",
});

const FIELDS = Object.freeze([
  "participation_rate_men_15_to_64_pct",
  "participation_rate_women_15_to_64_pct",
  "participation_rate_15_to_64_pct",
  "participation_rate_pct",
]);

export function validateParticipationRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row, i) => {
    if (typeof row?.period !== "string") {
      throw new TypeError(`participation-gap-band@1.0.0 · row ${i} · expected a string period`);
    }
    const out = { period: row.period };
    for (const field of FIELDS) {
      const value = Number(row?.[field]);
      if (!Number.isFinite(value)) {
        throw new TypeError(`participation-gap-band@1.0.0 · row ${i} · expected a finite ${field}`);
      }
      out[field] = value;
    }
    return out;
  });
}

/**
 * On the 15-to-64 basis the two published rates are drawn with the space
 * between them shaded: the band is a range, not a stack, and the gap it shows
 * is a difference between two published rates rather than a published series.
 * On the all-ages basis the provider publishes no sex split, so that view is a
 * single line — the basis the OECD comparison uses.
 */
export function renderParticipationGapBand(input, display, provenance) {
  const rows = validateParticipationRows(input),
    allAges = display.basis === "all-ages",
    w = Math.max(320, display.width),
    h = Math.round(Math.max(230, Math.min(340, w * 0.32))),
    plotBottom = h - 34,
    scale = xScale(rows.length, w, 44, 24),
    colours = {
      men: "#3987e5",
      women: "#d95926",
      band: "#9085e9",
      total: "#199e70",
      ...(display.seriesColours || {}),
    },
    series = allAges
      ? [{ field: "participation_rate_pct", label: "Both sexes, 15+", colour: colours.total }]
      : [
          { field: "participation_rate_men_15_to_64_pct", label: "Men", colour: colours.men },
          { field: "participation_rate_women_15_to_64_pct", label: "Women", colour: colours.women },
        ],
    values = rows.flatMap((r) => series.map((s) => r[s.field])),
    domain = niceSpan(Math.min(...values), Math.max(...values), 0.1),
    y = (v) =>
      14 + (1 - (v - domain.lo) / (domain.hi - domain.lo)) * (plotBottom - 14),
    si = Math.max(0, Math.min(rows.length - 1, display.selectedIndex)),
    now = rows[si],
    gap =
      now.participation_rate_men_15_to_64_pct -
      now.participation_rate_women_15_to_64_pct,
    { root, svg, overlay } = chart(
      w,
      h,
      allAges
        ? `Labour force participation rate, both sexes aged 15 or over, ${quarterLabel(rows[0].period)} to ${quarterLabel(rows.at(-1).period)}. Selected observation ${quarterLabel(now.period)}: ${now.participation_rate_pct.toFixed(1)} percent. ${provenance?.summary || ""}`
        : `Labour force participation rate of men and women aged 15 to 64, ${quarterLabel(rows[0].period)} to ${quarterLabel(rows.at(-1).period)}, with the gap between them shaded. Selected observation ${quarterLabel(now.period)}: men ${now.participation_rate_men_15_to_64_pct.toFixed(1)} percent, women ${now.participation_rate_women_15_to_64_pct.toFixed(1)} percent, a derived gap of ${gap.toFixed(1)} points. ${provenance?.summary || ""}`,
    );
  grid(svg, overlay, domain, y, w - (scale.padR - 14));
  if (!allAges) {
    const upper = rows.map(
        (r, i) =>
          `${scale.x(i).toFixed(1)},${y(r.participation_rate_men_15_to_64_pct).toFixed(1)}`,
      ),
      lower = rows.map(
        (r, i) =>
          `${scale.x(i).toFixed(1)},${y(r.participation_rate_women_15_to_64_pct).toFixed(1)}`,
      );
    polyline(
      svg,
      [...upper, ...[...lower].reverse()].join(" "),
      colours.band,
      0,
      "",
      colours.band,
      0.24,
    );
  }
  const chips = [];
  for (const s of series) {
    polyline(
      svg,
      rows.map((r, i) => `${scale.x(i).toFixed(1)},${y(r[s.field]).toFixed(1)}`).join(" "),
      s.colour,
      2.4,
    );
    circle(svg, scale.x(si), y(now[s.field]), 4.5, PALETTE.text, s.colour, 2);
    chips.push({
      y: y(now[s.field]),
      color: s.colour,
      text: `${s.label} ${now[s.field].toFixed(1)}%`,
    });
  }
  if (!allAges) {
    // The band is the gap, so it carries its own value, placed in the middle of
    // the shaded area it names.
    chips.push({
      y:
        (y(now.participation_rate_men_15_to_64_pct) +
          y(now.participation_rate_women_15_to_64_pct)) /
        2,
      color: colours.band,
      text: `Gap ${gap.toFixed(1)} pt`,
    });
  }
  selection(svg, scale.x(si), plotBottom);
  placeChips(overlay, chips, {
    x: scale.x(si),
    width: w,
    height: h,
    flip: si > rows.length / 2,
  });
  xTicks(overlay, rows, scale, h - 19, w, 64, quarterLabel);
  enablePicking(svg, rows.length, scale.padL, scale.inner);
  return root;
}
