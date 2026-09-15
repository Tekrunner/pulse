import {
  PALETTE,
  chart,
  circle,
  enablePicking,
  grid,
  niceSpan,
  node,
  overlayLabel,
  periodLabel,
  placeChips,
  polyline,
  quarterLabel,
  selection,
  tickIndices,
  xScale,
} from "./report-shared.js";

export const INTERNATIONAL_LINES_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "international-lines",
  question: "How does France's unemployment rate compare with those of other OECD economies?",
  consumerSchema: Object.freeze({
    period: "string",
    reference_area_code: "string",
    reference_area_name: "string",
    reference_area_kind: "string",
    unemployment_rate_pct: "number",
  }),
  displaySchema: Object.freeze({
    width: "number",
    selectedIndex: "number",
    seriesColours: "object",
    emphasisCode: "string",
    unavailable: "array",
  }),
  inputs: Object.freeze(["rows", "display", "provenance"]),
  cleanup: "none",
});

const KINDS = new Set(["member", "aggregate", "non-member"]);

export function validateInternationalRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Visual rows must be an array.");
  return rows.map((row, i) => {
    const rate = Number(row?.unemployment_rate_pct);
    if (
      typeof row?.period !== "string" ||
      typeof row?.reference_area_code !== "string" ||
      typeof row?.reference_area_name !== "string" ||
      !KINDS.has(row?.reference_area_kind) ||
      !Number.isFinite(rate)
    ) {
      throw new TypeError(
        `international-lines@1.0.0 · row ${i} · expected string period, area code, area name, a known area kind and a finite unemployment_rate_pct`,
      );
    }
    return {
      period: row.period,
      reference_area_code: row.reference_area_code,
      reference_area_name: row.reference_area_name,
      reference_area_kind: row.reference_area_kind,
      unemployment_rate_pct: rate,
    };
  });
}

/**
 * The panel is ragged on purpose: each area is drawn to its own latest
 * published period and its end is marked there, rather than every line being
 * cut back to the slowest reporter. The reader's selected observation is shared
 * with the rest of the report, so the values beside the selection line are the
 * values for the same period every other figure is showing — and an area that
 * publishes nothing at that period says so rather than quietly showing its
 * latest instead. Colour follows the entity and is supplied by the report, so
 * removing one comparator never repaints the others.
 */
export function renderComparatorLines(rows, display, provenance) {
  const label = display.grain === "quarterly" ? quarterLabel : periodLabel,
    w = Math.max(320, display.width),
    wide = w >= 680,
    padR = 24,
    h = Math.round(Math.max(240, Math.min(380, w * 0.36))),
    plotBottom = h - 34,
    periods = [...new Set(rows.map((r) => r.period))].sort(),
    index = new Map(periods.map((period, i) => [period, i])),
    scale = xScale(periods.length, w, 46, padR),
    values = rows.map((r) => r.value),
    // Little headroom: a dozen economies already span most of the axis, and a
    // wide pad rounds the top up a whole gridline and wastes a fifth of the
    // plot.
    domain = niceSpan(Math.min(...values), Math.max(...values), 0.02),
    y = (v) =>
      14 + (1 - (v - domain.lo) / (domain.hi - domain.lo)) * (plotBottom - 14),
    byArea = new Map();
  for (const row of rows) {
    if (!byArea.has(row.code)) byArea.set(row.code, []);
    byArea.get(row.code).push(row);
  }
  for (const series of byArea.values()) series.sort((a, b) => a.period.localeCompare(b.period));
  const ordered = [...byArea.values()].sort(
      (a, b) => b.at(-1).value - a.at(-1).value,
    ),
    root = node("div");
  root.className = "comparator-lines";
  const { root: plot, svg, overlay } = chart(
    w,
    h,
    `${display.measureLabel}, ${label(periods[0])} to ${label(periods.at(-1))}. Selected observation ${label(periods[Math.max(0, Math.min(periods.length - 1, display.selectedIndex ?? periods.length - 1))])}: ${ordered
      .map((series) => {
        const period =
          periods[Math.max(0, Math.min(periods.length - 1, display.selectedIndex ?? periods.length - 1))];
        const at = series.find((row) => row.period === period);
        return at
          ? `${at.name} ${at.value.toFixed(1)} percent`
          : `${series.at(-1).name} publishes nothing at that period and stops at ${label(series.at(-1).period)}`;
      })
      .join("; ")}. Every value is listed in the table below this figure. ${provenance?.summary || ""}`,
  );
  grid(svg, overlay, domain, y, w - (padR - 14), scale.padL, scale.padR, 38);
  const si = Math.max(0, Math.min(periods.length - 1, display.selectedIndex ?? periods.length - 1)),
    selectedPeriod = periods[si],
    chips = [];
  for (const series of ordered) {
    const colour = display.seriesColours?.[series[0].code] || PALETTE.muted,
      emphasis = series[0].code === display.emphasisCode,
      end = series.at(-1),
      atSelection = series.find((row) => row.period === selectedPeriod);
    polyline(
      svg,
      series
        .map((r) => `${scale.x(index.get(r.period)).toFixed(1)},${y(r.value).toFixed(1)}`)
        .join(" "),
      colour,
      emphasis ? 3.2 : 2,
      series[0].kind === "aggregate" ? "5 4" : "",
    );
    // The end marker stays where the series actually stops, which is how the
    // ragged publication edge remains visible at a glance.
    circle(svg, scale.x(index.get(end.period)), y(end.value), emphasis ? 4 : 3, colour, colour, 1);
    if (atSelection) {
      circle(svg, scale.x(si), y(atSelection.value), emphasis ? 5 : 4, PALETTE.text, colour, 2);
      chips.push({
        y: y(atSelection.value),
        color: colour,
        text: `${wide ? atSelection.name : atSelection.code} ${atSelection.value.toFixed(1)}%`,
      });
    } else {
      chips.push({
        y: y(end.value),
        color: colour,
        text: `${wide ? end.name : end.code} — to ${label(end.period, true)}`,
      });
    }
  }
  selection(svg, scale.x(si), plotBottom);
  placeChips(overlay, chips, {
    x: scale.x(si),
    width: w,
    height: h,
    flip: si > periods.length / 2,
  });
  for (const i of tickIndices(periods.length, scale.inner)) {
    overlayLabel(
      overlay,
      label(periods[i], true),
      Math.max(scale.padL - 10, Math.min(w - 64, scale.x(i) - 32)),
      h - 19,
      { width: 64 },
    );
  }
  enablePicking(svg, periods.length, scale.padL, scale.inner);
  root.append(plot);
  const missing = (display.unavailable || []).filter(Boolean);
  if (missing.length) {
    const chips = node("p");
    chips.className = "unavailable-chips";
    chips.append(node("span", `Selected but not published in this series: `));
    missing.forEach((area, i) => {
      const chip = node("span", `${area.name} — not published`);
      chip.className = "chip-absent";
      chips.append(chip);
      if (i < missing.length - 1) chips.append(node("span", " "));
    });
    root.append(chips);
  }
  return root;
}

export function renderInternationalLines(input, display, provenance) {
  const rows = validateInternationalRows(input).map((row) => ({
    period: row.period,
    code: row.reference_area_code,
    name: row.reference_area_name,
    kind: row.reference_area_kind,
    value: row.unemployment_rate_pct,
  }));
  return renderComparatorLines(
    rows,
    {
      grain: "monthly",
      measureLabel: "Unemployment rate, OECD harmonised, monthly",
      ...display,
    },
    provenance,
  );
}
