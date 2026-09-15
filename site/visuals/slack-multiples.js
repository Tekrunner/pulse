import {
  PALETTE,
  chart,
  circle,
  enablePicking,
  grid,
  millions,
  niceSpan,
  node,
  placeChips,
  polyline,
  quarterLabel,
  selection,
  xScale,
  xTicks,
} from "./report-shared.js";

export const SLACK_MULTIPLES_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "slack-multiples",
  question:
    "Beyond headline ILO unemployment, how large are long-term unemployment, the halo around unemployment and underemployment?",
  consumerSchema: Object.freeze({
    period: "string",
    unemployed_thousands: "number",
    unemployment_rate_pct: "number",
    long_term_unemployed_thousands: "number",
    long_term_unemployment_rate_pct: "number",
    halo_15_to_64_thousands: "number",
    halo_share_of_population_15_to_64_pct: "number",
    underemployed_thousands: "number",
    underemployment_rate_pct: "number",
  }),
  displaySchema: Object.freeze({
    width: "number",
    selectedIndex: "number",
    seriesColours: "object",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  cleanup: "none",
});

const MEASURES = Object.freeze([
  "unemployed_thousands",
  "unemployment_rate_pct",
  "long_term_unemployed_thousands",
  "long_term_unemployment_rate_pct",
  "halo_15_to_64_thousands",
  "halo_share_of_population_15_to_64_pct",
  "underemployed_thousands",
  "underemployment_rate_pct",
]);

export function validateSlackMultiplesRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row, i) => {
    if (typeof row?.period !== "string") {
      throw new TypeError(`slack-multiples@1.0.0 · row ${i} · expected a string period`);
    }
    const out = { period: row.period };
    for (const field of MEASURES) {
      const value = Number(row?.[field]);
      if (!Number.isFinite(value)) {
        throw new TypeError(`slack-multiples@1.0.0 · row ${i} · expected a finite ${field}`);
      }
      out[field] = value;
    }
    return out;
  });
}

function legendRow(entries) {
  const legend = node("div");
  legend.className = "legend";
  for (const [label, colour] of entries) {
    const item = node("span"),
      swatch = node("i");
    swatch.style.background = colour;
    item.append(swatch, node("span", label));
    legend.append(item);
  }
  return legend;
}

function panel(title, legend, width, rows, si, draw, aria) {
  const wrapper = node("section"),
    heading = node("h4", title);
  wrapper.className = "slack-panel";
  heading.className = "panel-title";
  const w = Math.max(300, width),
    h = Math.round(Math.max(190, Math.min(260, w * 0.52))),
    plotBottom = h - 32,
    scale = xScale(rows.length, w, 46, 14),
    surface = chart(w, h, aria);
  const chips = draw(surface, scale, plotBottom, w, h) || [];
  selection(surface.svg, scale.x(si), plotBottom);
  placeChips(surface.overlay, chips, {
    x: scale.x(si),
    width: w,
    height: h,
    flip: si > rows.length / 2,
    bottom: 30,
  });
  xTicks(surface.overlay, rows, scale, h - 17, w, 58, quarterLabel);
  enablePicking(surface.svg, rows.length, scale.padL, scale.inner);
  wrapper.append(heading, legend, surface.root);
  return wrapper;
}

/**
 * Two panels, each on its own scale. The four measures overlap — a long-term
 * unemployed person is also unemployed — so nothing here is a part of a whole,
 * and the four published rates have four different denominators, which is why
 * the panels carry headcounts and the denominators are named in the report's
 * own definitions rather than implied by a shared axis.
 */
export function renderSlackMultiples(input, display, provenance) {
  const rows = validateSlackMultiplesRows(input),
    total = Math.max(320, display.width),
    colours = {
      short_term: "#3987e5",
      long_term: "#d95926",
      halo: "#199e70",
      underemployment: "#c98500",
      ...(display.seriesColours || {}),
    },
    si = Math.max(0, Math.min(rows.length - 1, display.selectedIndex)),
    now = rows[si],
    side = total >= 860,
    panelWidth = side ? Math.floor((total - 12) / 2) : total,
    root = node("div");
  root.className = side ? "slack-panels slack-panels-side" : "slack-panels";

  // Published in thousands, read in millions.
  const M = (value) => value / 1000;
  // A count stack is read against zero, and the band below the long-term line
  // is part of the mark, so this axis starts at zero and is never padded below
  // it: a negative gridline under a headcount is meaningless.
  const stackTop = Math.max(...rows.map((r) => M(r.unemployed_thousands))),
    padded = niceSpan(0, stackTop, 0.04),
    stackDomain = { ...padded, lo: 0 };
  root.append(
    panel(
      "Unemployment, of which long-term",
      legendRow([
        ["Long-term (a year or more)", colours.long_term],
        ["Unemployed less than a year", colours.short_term],
      ]),
      panelWidth,
      rows,
      si,
      ({ svg, overlay }, scale, plotBottom, w) => {
        const y = (v) =>
          14 +
          (1 - (v - stackDomain.lo) / (stackDomain.hi - stackDomain.lo)) *
            (plotBottom - 14);
        grid(svg, overlay, stackDomain, y, w, scale.padL, scale.padR, 38);
        const upper = rows.map(
          (r, i) => `${scale.x(i).toFixed(1)},${y(M(r.unemployed_thousands)).toFixed(1)}`,
        );
        const lower = rows.map(
          (r, i) =>
            `${scale.x(i).toFixed(1)},${y(M(r.long_term_unemployed_thousands)).toFixed(1)}`,
        );
        polyline(
          svg,
          [...upper, ...[...lower].reverse()].join(" "),
          colours.short_term,
          0,
          "",
          colours.short_term,
          0.34,
        );
        polyline(
          svg,
          [
            ...lower,
            `${scale.right.toFixed(1)},${y(stackDomain.lo).toFixed(1)}`,
            `${scale.padL.toFixed(1)},${y(stackDomain.lo).toFixed(1)}`,
          ].join(" "),
          colours.long_term,
          0,
          "",
          colours.long_term,
          0.5,
        );
        polyline(svg, upper.join(" "), colours.short_term, 2.2);
        polyline(svg, lower.join(" "), colours.long_term, 2.2);
        circle(svg, scale.x(si), y(M(now.unemployed_thousands)), 4.5, PALETTE.text, colours.short_term, 2);
        circle(
          svg,
          scale.x(si),
          y(M(now.long_term_unemployed_thousands)),
          4.5,
          PALETTE.text,
          colours.long_term,
          2,
        );
        return [
          {
            y: y(M(now.unemployed_thousands)),
            color: colours.short_term,
            text: `Unemployed ${millions(now.unemployed_thousands)}`,
          },
          {
            y: y(M(now.long_term_unemployed_thousands)),
            color: colours.long_term,
            text: `Long-term ${millions(now.long_term_unemployed_thousands)}`,
          },
        ];
      },
      `Unemployed people in millions with the long-term share beneath, ${quarterLabel(rows[0].period)} to ${quarterLabel(rows.at(-1).period)}. Selected observation ${quarterLabel(now.period)}: ${millions(now.unemployed_thousands, { long: true })} unemployed, of which ${millions(now.long_term_unemployed_thousands, { long: true })} for a year or more. ${provenance?.summary || ""}`,
    ),
  );

  const pairValues = rows.flatMap((r) => [
      M(r.halo_15_to_64_thousands),
      M(r.underemployed_thousands),
    ]),
    pairDomain = niceSpan(Math.min(...pairValues), Math.max(...pairValues), 0.06);
  root.append(
    panel(
      "Halo and underemployment",
      legendRow([
        ["Halo around unemployment", colours.halo],
        ["Underemployment", colours.underemployment],
      ]),
      panelWidth,
      rows,
      si,
      ({ svg, overlay }, scale, plotBottom, w) => {
        const y = (v) =>
          14 +
          (1 - (v - pairDomain.lo) / (pairDomain.hi - pairDomain.lo)) *
            (plotBottom - 14);
        grid(svg, overlay, pairDomain, y, w, scale.padL, scale.padR, 38);
        const chips = [];
        for (const [field, colour, label] of [
          ["halo_15_to_64_thousands", colours.halo, "Halo"],
          ["underemployed_thousands", colours.underemployment, "Underemployment"],
        ]) {
          polyline(
            svg,
            rows
              .map((r, i) => `${scale.x(i).toFixed(1)},${y(M(r[field])).toFixed(1)}`)
              .join(" "),
            colour,
            2.2,
          );
          circle(svg, scale.x(si), y(M(now[field])), 4.5, PALETTE.text, colour, 2);
          chips.push({ y: y(M(now[field])), color: colour, text: `${label} ${millions(now[field])}` });
        }
        return chips;
      },
      `People in the halo around unemployment and people in underemployment, in millions, ${quarterLabel(rows[0].period)} to ${quarterLabel(rows.at(-1).period)}. Selected observation ${quarterLabel(now.period)}: halo ${millions(now.halo_15_to_64_thousands, { long: true })}, underemployment ${millions(now.underemployed_thousands, { long: true })}. ${provenance?.summary || ""}`,
    ),
  );
  return root;
}

