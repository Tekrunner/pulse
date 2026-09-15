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

export const AGE_BAND_LINES_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "age-band-lines",
  question:
    "How far apart are the unemployment rates of under-25s, 25-to-49-year-olds and people aged 50 or over, and is the gap widening?",
  consumerSchema: Object.freeze({
    period: "string",
    unemployment_rate_under_25_pct: "number",
    unemployment_rate_25_to_49_pct: "number",
    unemployment_rate_50_and_over_pct: "number",
    unemployed_under_25_thousands: "number",
    unemployed_25_to_49_thousands: "number",
    unemployed_50_and_over_thousands: "number",
  }),
  displaySchema: Object.freeze({
    width: "number",
    selectedIndex: "number",
    seriesColours: "object",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  cleanup: "none",
});

export const AGE_BANDS = Object.freeze([
  { key: "under_25", label: "Under 25", short: "under 25" },
  { key: "25_to_49", label: "25 to 49", short: "25–49" },
  { key: "50_and_over", label: "50 or over", short: "50+" },
]);
const RATE = (band) => `unemployment_rate_${band.key}_pct`;
const COUNT = (band) => `unemployed_${band.key}_thousands`;

export function validateAgeBandRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row, i) => {
    if (typeof row?.period !== "string") {
      throw new TypeError(`age-band-lines@1.0.0 · row ${i} · expected a string period`);
    }
    const out = { period: row.period };
    for (const band of AGE_BANDS) {
      for (const field of [RATE(band), COUNT(band)]) {
        const value = Number(row?.[field]);
        if (!Number.isFinite(value)) {
          throw new TypeError(`age-band-lines@1.0.0 · row ${i} · expected a finite ${field}`);
        }
        out[field] = value;
      }
    }
    return out;
  });
}

/**
 * Three lines, each direct-labelled at its end, so a band is identifiable
 * without reading hue. An ordinal single-hue ramp would have encoded the bands'
 * natural order but failed contrast against this surface at its darkest step.
 */
export function renderAgeBandLines(input, display, provenance) {
  const rows = validateAgeBandRows(input),
    w = Math.max(320, display.width),
    h = Math.round(Math.max(230, Math.min(340, w * 0.32))),
    plotBottom = h - 34,
    // Band names are spelled out where there is room for them and abbreviated
    // where there is not; either way each band is named in the chip beside the
    // selected point, so identity never rests on hue.
    wide = w >= 680,
    scale = xScale(rows.length, w, 44, 24),
    colours = {
      under_25: "#3987e5",
      "25_to_49": "#d95926",
      "50_and_over": "#199e70",
      ...(display.seriesColours || {}),
    },
    values = rows.flatMap((r) => AGE_BANDS.map((band) => r[RATE(band)])),
    domain = niceSpan(Math.min(...values), Math.max(...values), 0.06),
    y = (v) =>
      14 + (1 - (v - domain.lo) / (domain.hi - domain.lo)) * (plotBottom - 14),
    si = Math.max(0, Math.min(rows.length - 1, display.selectedIndex)),
    now = rows[si],
    { root, svg, overlay } = chart(
      w,
      h,
      `Unemployment rate by age band, ${quarterLabel(rows[0].period)} to ${quarterLabel(rows.at(-1).period)}. Selected observation ${quarterLabel(now.period)}: ${AGE_BANDS.map((band) => `${band.label} ${now[RATE(band)].toFixed(1)} percent, ${Math.round(now[COUNT(band)]).toLocaleString("en")} thousand people`).join("; ")}. ${provenance?.summary || ""}`,
    );
  grid(svg, overlay, domain, y, w - (scale.padR - 14));
  // Rates only: the headcount behind each band adds a number without adding an
  // answer, and the report already carries counts where they are the point.
  const chips = [];
  for (const band of AGE_BANDS) {
    const colour = colours[band.key];
    polyline(
      svg,
      rows
        .map((r, i) => `${scale.x(i).toFixed(1)},${y(r[RATE(band)]).toFixed(1)}`)
        .join(" "),
      colour,
      2.4,
    );
    circle(svg, scale.x(si), y(now[RATE(band)]), 4.5, PALETTE.text, colour, 2);
    chips.push({
      y: y(now[RATE(band)]),
      color: colour,
      text: `${wide ? band.label : band.short} ${now[RATE(band)].toFixed(1)}%`,
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
