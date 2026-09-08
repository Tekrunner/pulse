import {
  DASH,
  PALETTE,
  chart,
  circle,
  enablePicking,
  grid,
  niceDomain,
  node,
  overlayLabel,
  periodLabel,
  polyline,
  selection,
  signed,
  tickIndices,
  xScale,
} from "./report-shared.js";

export const DIVERGENCE_MULTIPLES_VISUAL_CONTRACT = Object.freeze({
  contractVersion: "1.0.0",
  visualId: "divergence-multiples",
  consumerSchema: {
    period: "string",
    category: "string",
    annual_change_pct: "number",
    headline_annual_change_pct: "number",
    weight_per_10k: "number",
    weight_reference_year: "number",
    is_pulse_calculation: "boolean",
  },
  displaySchema: {
    width: "number",
    selectedIndex: "number",
    sharedDomain: "boolean",
  },
  inputs: ["rows", "display", "provenance"],
  cleanup: "none",
});

const CATEGORIES = new Set([
  "food",
  "services",
  "manufactured",
  "energy",
  "rent",
]);
const NAMES = {
  food: "Food",
  services: "Services",
  manufactured: "Manufactured products",
  energy: "Energy",
  rent: "Rents paid",
};

export function validateDivergenceRows(rows) {
  if (!Array.isArray(rows))
    throw new TypeError("Visual rows must be an array.");
  return rows.map((row, index) => {
    const numbers = [
      row.annual_change_pct,
      row.headline_annual_change_pct,
      row.weight_per_10k,
      row.weight_reference_year,
    ].map(Number);
    if (
      typeof row?.period !== "string" ||
      !CATEGORIES.has(row.category) ||
      !numbers.every(Number.isFinite)
    ) {
      throw new TypeError(
        `divergence-multiples@1.0.0 · row ${index} · incompatible schema`,
      );
    }
    return {
      period: row.period,
      category: row.category,
      annual_change_pct: numbers[0],
      headline_annual_change_pct: numbers[1],
      weight_per_10k: numbers[2],
      weight_reference_year: numbers[3],
      is_pulse_calculation: row.is_pulse_calculation === true,
    };
  });
}

function staircasePoints(items, scale, y) {
  return items
    .flatMap((row, index) =>
      index
        ? [
            `${scale.x(index)},${y(items[index - 1].weight_per_10k / 100)}`,
            `${scale.x(index)},${y(row.weight_per_10k / 100)}`,
          ]
        : [`${scale.x(index)},${y(row.weight_per_10k / 100)}`],
    )
    .join(" ");
}

export function renderDivergenceMultiples(input, display, provenance) {
  const rows = validateDivergenceRows(input);
  const root = node("div");
  root.className = "multiples";
  const categories = [...new Set(rows.map((row) => row.category))];
  const width = Math.max(320, display.width || 900);
  const columns = width >= 780 ? Math.min(3, categories.length) : 1;
  const gap = 11.2;
  const panelWidth = Math.max(
    280,
    Math.floor((width - gap * (columns - 1)) / columns) - 17,
  );
  const plotHeight = Math.round(
    Math.max(150, Math.min(210, panelWidth * 0.62)),
  );
  const values = rows.flatMap((row) => [
    row.annual_change_pct,
    row.headline_annual_change_pct,
  ]);
  const domain = niceDomain(Math.min(...values), Math.max(...values));
  root.style.setProperty("--multiple-columns", String(columns));

  for (const category of categories) {
    const items = rows.filter((row) => row.category === category);
    const selectedIndex = Math.max(
      0,
      Math.min(items.length - 1, display.selectedIndex),
    );
    const current = items[selectedIndex];
    const scale = xScale(items.length, panelWidth, 34, 22);
    const y = (value) =>
      10 +
      (1 - (value - domain.lo) / (domain.hi - domain.lo)) * (plotHeight - 48);
    const panel = node("section");
    const header = node("div");
    const title = node("strong", NAMES[category]);
    const latest = node("span", signed(current.annual_change_pct, 1, "%"));
    panel.className = "multiple-panel";
    panel.dataset.category = category;
    header.className = "multiple-header";
    title.className = "multiple-title";
    header.append(title, latest);

    const main = chart(
      panelWidth,
      plotHeight,
      `${NAMES[category]} inflation versus headline from ${periodLabel(items[0].period)} to ${periodLabel(items.at(-1).period)}. Selected ${periodLabel(current.period)}, ${signed(current.annual_change_pct, 1, "%")} and basket share ${(current.weight_per_10k / 100).toFixed(1)} percent. ${provenance?.summary || ""}`,
    );
    grid(main.svg, main.overlay, domain, y, panelWidth, 34, 22, 27);
    const area = [
      ...items.map(
        (row, index) => `${scale.x(index)},${y(row.annual_change_pct)}`,
      ),
      ...items.map(
        (row, index) =>
          `${scale.x(items.length - 1 - index)},${y(items[items.length - 1 - index].headline_annual_change_pct)}`,
      ),
    ].join(" ");
    polyline(main.svg, area, PALETTE[category], 0, "", PALETTE[category], 0.14);
    polyline(
      main.svg,
      items
        .map(
          (row, index) =>
            `${scale.x(index)},${y(row.headline_annual_change_pct)}`,
        )
        .join(" "),
      PALETTE.headline,
      1.5,
      "5 4",
    );
    polyline(
      main.svg,
      items
        .map((row, index) => `${scale.x(index)},${y(row.annual_change_pct)}`)
        .join(" "),
      PALETTE[category],
      2.2,
      DASH[category],
    );
    selection(main.svg, scale.x(selectedIndex), plotHeight - 26);
    circle(
      main.svg,
      scale.x(selectedIndex),
      y(current.annual_change_pct),
      4,
      PALETTE[category],
    );
    for (const index of tickIndices(items.length, scale.inner))
      overlayLabel(
        main.overlay,
        periodLabel(items[index].period, true),
        Math.max(28, Math.min(panelWidth - 64, scale.x(index) - 28)),
        plotHeight - 22,
        { width: 56 },
      );
    enablePicking(main.svg, items.length, scale.padL, scale.inner);

    const weights = items.map((row) => row.weight_per_10k / 100);
    const low = Math.min(...weights),
      high = Math.max(...weights),
      span = high - low || 1;
    const weightY = (value) =>
      8 + (1 - (value - (low - span * 0.25)) / (span * 1.5)) * 16;
    const weight = chart(
      panelWidth,
      30,
      `Basket share for ${NAMES[category]}.`,
    );
    weight.root.classList.add("weight-staircase");
    polyline(
      weight.svg,
      staircasePoints(items, scale, weightY),
      PALETTE.share,
      1.5,
    );
    circle(
      weight.svg,
      scale.x(selectedIndex),
      weightY(current.weight_per_10k / 100),
      3,
      PALETTE.share,
    );
    overlayLabel(weight.overlay, `${high.toFixed(1)}%`, 0, 0, {
      width: 30,
      align: "right",
    });
    if (high - low >= 0.05)
      overlayLabel(weight.overlay, `${low.toFixed(1)}%`, 0, 16, {
        width: 30,
        align: "right",
      });
    enablePicking(weight.svg, items.length, scale.padL, scale.inner);
    const first = items[0];
    const readout = node(
      "p",
      `Basket share ${(current.weight_per_10k / 100).toFixed(1)}% in ${periodLabel(current.period)} (${current.weight_reference_year} weights), from ${(first.weight_per_10k / 100).toFixed(1)}% at the start of this window.${current.is_pulse_calculation ? " Rent annual change is a Pulse calculation." : ""}`,
    );
    readout.className = "panel-readout";
    panel.append(header, main.root, weight.root, readout);
    root.append(panel);
  }
  return root;
}
