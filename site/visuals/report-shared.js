export const NS = "http://www.w3.org/2000/svg";
export const PALETTE = Object.freeze({
  headline: "#9184d9",
  food: "#8fb0d1",
  services: "#b5abfc",
  manufactured: "#8c93a8",
  energy: "#d09a6a",
  rent: "#9dc0ae",
  share: "#8f93a6",
  text: "#e9e9ed",
  muted: "#b2b6ca",
  zero: "#75798c",
  grid: "rgba(233,233,237,.10)",
});
export const DASH = Object.freeze({
  headline: "",
  food: "6 4",
  services: "4 3",
  manufactured: "1 3",
  energy: "2 4",
  rent: "10 4",
});
export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function node(name, text, svg = false) {
  const item = svg
    ? document.createElementNS(NS, name)
    : document.createElement(name);
  if (text !== undefined) item.textContent = String(text);
  return item;
}
export function periodLabel(p, short = false) {
  const [y, m] = p.split("-");
  return `${MONTHS[Number(m) - 1]} ${short ? y.slice(2) : y}`;
}
export function signed(value, dp = 1, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value)))
    return "—";
  const n = Number(value);
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(dp)}${suffix}`;
}
export function quarterLabel(p, short = false) {
  const [y, m] = p.split("-");
  return `Q${Math.floor((Number(m) - 1) / 3) + 1} ${short ? y.slice(2) : y}`;
}
/**
 * A rounded domain that spans the data instead of anchoring at zero. A rate
 * that never leaves the 4-to-11 band is unreadable on a zero-based axis, and
 * these series are levels rather than changes, so zero carries no meaning that
 * would justify the lost resolution.
 */
export function niceSpan(min, max, pad = 0.08) {
  let lo = min,
    hi = max;
  if (lo === hi) {
    lo -= 0.5;
    hi += 0.5;
  }
  const margin = (hi - lo) * pad;
  lo -= margin;
  hi += margin;
  const raw = (hi - lo) / 4,
    mag = 10 ** Math.floor(Math.log10(raw)),
    step =
      [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= raw) || 10 * mag;
  return {
    lo: Math.floor(lo / step) * step,
    hi: Math.ceil(hi / step) * step,
    step,
  };
}
export function niceDomain(min, max) {
  let lo = Math.min(0, min),
    hi = Math.max(0, max);
  if (lo === hi) {
    lo -= 0.5;
    hi += 0.5;
  }
  const span = hi - lo,
    raw = span / 4,
    mag = 10 ** Math.floor(Math.log10(raw)),
    step =
      [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= raw) || 10 * mag;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  return { lo, hi, step };
}
export function tickIndices(n, width) {
  const target = Math.max(2, Math.min(7, Math.floor(width / 110))),
    step = Math.max(1, Math.ceil((n - 1) / (target - 1))),
    out = [];
  for (let i = n - 1; i >= 0; i -= step) out.unshift(i);
  if (out[0] !== 0 && out[0] > step / 2) out.unshift(0);
  return out;
}
export function xScale(n, width, padL = 44, padR = 14) {
  const inner = Math.max(120, width - padL - padR);
  return {
    padL,
    padR,
    inner,
    right: padL + inner,
    x: (i) => padL + (n === 1 ? inner / 2 : (i * inner) / (n - 1)),
  };
}
export function chart(width, height, aria) {
  const root = node("div");
  root.className = "report-visual";
  root.style.width = `${width}px`;
  root.style.height = `${height}px`;
  const svg = node("svg", undefined, true);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", aria);
  svg.style.cursor = "pointer";
  const overlay = node("div");
  overlay.className = "plot-overlay";
  root.append(svg, overlay);
  return { root, svg, overlay };
}
export function line(svg, attrs) {
  const item = node("line", undefined, true);
  for (const [k, v] of Object.entries(attrs)) item.setAttribute(k, String(v));
  svg.append(item);
  return item;
}
export function polyline(
  svg,
  points,
  color,
  width = 2.5,
  dash = "",
  fill = "none",
  opacity,
) {
  const item = node("polyline", undefined, true);
  item.setAttribute("points", points);
  item.setAttribute("fill", fill);
  item.setAttribute("stroke", color);
  item.setAttribute("stroke-width", width);
  item.setAttribute("stroke-linejoin", "round");
  item.setAttribute("stroke-linecap", "round");
  if (dash) item.setAttribute("stroke-dasharray", dash);
  if (opacity !== undefined) item.setAttribute("opacity", opacity);
  svg.append(item);
  return item;
}
export function circle(
  svg,
  cx,
  cy,
  r,
  fill,
  stroke = "#161826",
  strokeWidth = 1.5,
) {
  const item = node("circle", undefined, true);
  for (const [k, v] of Object.entries({
    cx,
    cy,
    r,
    fill,
    stroke,
    "stroke-width": strokeWidth,
  }))
    item.setAttribute(k, String(v));
  svg.append(item);
  return item;
}
export function rect(svg, x, y, width, height, fill, opacity) {
  const item = node("rect", undefined, true);
  for (const [k, v] of Object.entries({ x, y, width, height, fill }))
    item.setAttribute(k, String(v));
  if (opacity !== undefined) item.setAttribute("opacity", opacity);
  svg.append(item);
  return item;
}
export function overlayLabel(
  overlay,
  text,
  left,
  top,
  { width = 64, align = "center", color = PALETTE.muted, className = "" } = {},
) {
  const item = node("span", text);
  item.className = className;
  Object.assign(item.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    textAlign: align,
    color,
  });
  overlay.append(item);
  return item;
}

// Advance widths at the size the overlay draws in, as a fraction of that
// size. Enough to size a gutter, not to typeset: the digits here are tabular
// and share one width, and it is the separators and the unit letters that a
// plain character count gets wrong.
const ADVANCE = Object.freeze({
  ".": 0.3, ",": 0.3, "−": 0.55, "-": 0.55, "+": 0.58,
  "%": 0.9, "‰": 1.25, M: 0.85, k: 0.56, b: 0.62, n: 0.62,
});

/**
 * The gutter an axis needs for the labels it will actually carry, never wider
 * than `max` -- the constant it replaces.
 *
 * A gutter sized for the longest label any series and unit could produce is a
 * sixth of the plot once the plot is a phone wide, and the labels there are
 * two or three characters. Estimated rather than measured because a visual is
 * built detached, where nothing has a width yet; the estimate carries a
 * cushion so that a host whose own font is wider than this one's leaves the
 * gutter generous rather than short.
 */
export function axisGutter(labels, { max = Infinity, size = 12, min = 22 } = {}) {
  const widest = labels.reduce((widestSoFar, label) => Math.max(widestSoFar,
    [...String(label ?? "")].reduce((total, character) => total + (ADVANCE[character] ?? 0.62) * size, 0)), 0);
  return Math.round(Math.min(max, Math.max(min, widest * 1.25 + 8)));
}

/**
 * How many small multiples fit across a figure, and the width each panel is
 * drawn at.
 *
 * A visual asks for a column count and is given the width it has. Below a
 * readable panel width it takes fewer columns rather than drawing panels
 * narrower than their own axes, and the width it returns is the width the
 * grid cell will actually give the panel. That second half is the point: a
 * panel drawn wider than its cell has its marks scaled to fit while the
 * overlay labels beside them are not, which is what put the age bands over
 * the men's bars on a phone.
 *
 * `gap` and `padding` restate `.multiples` and `.multiple-panel` in
 * style.css. They are one measurement kept in two places; changing either
 * means changing both.
 */
export function panelGrid(width, requested, { gap = 11.2, padding = 8.4, readable = 250 } = {}) {
  const columns = Math.max(1, Math.min(Math.max(1, requested), Math.floor((width + gap) / (readable + gap))));
  const cell = (width - (columns - 1) * gap) / columns;
  return { columns, width: Math.max(160, Math.floor(cell - padding * 2)) };
}

export function grid(
  svg,
  overlay,
  domain,
  y,
  width,
  padL = 44,
  padR = 14,
  gutter = 36,
) {
  const rows = [];
  const dp = domain.step < 1 ? 1 : 0;
  for (let v = domain.lo; v <= domain.hi + 1e-9; v += domain.step) {
    const yy = y(v),
      zero = Math.abs(v) < 1e-9;
    line(svg, {
      x1: padL,
      x2: width - padR,
      y1: yy,
      y2: yy,
      stroke: zero ? PALETTE.zero : PALETTE.grid,
      "stroke-width": 1,
    });
    overlayLabel(overlay, zero ? "0" : v.toFixed(dp), 0, yy - 9, {
      width: gutter,
      align: "right",
    });
    rows.push({ value: v, y: yy });
  }
  return rows;
}
export function xTicks(
  overlay,
  rows,
  scale,
  top,
  width,
  labelWidth = 64,
  label = periodLabel,
) {
  for (const i of tickIndices(rows.length, scale.inner)) {
    const left = Math.max(
      scale.padL - 10,
      Math.min(width - labelWidth, scale.x(i) - labelWidth / 2),
    );
    overlayLabel(overlay, label(rows[i].period, true), left, top, {
      width: labelWidth,
    });
  }
}
export function selection(svg, x, bottom) {
  line(svg, {
    x1: x,
    x2: x,
    y1: 8,
    y2: bottom,
    stroke: PALETTE.text,
    "stroke-width": 1,
    "stroke-dasharray": "3 3",
  });
}
export function enablePicking(svg, count, padL, inner) {
  svg.dataset.plotPadLeft = String(padL);
  svg.dataset.plotInnerWidth = String(inner);
  svg.dataset.periodCount = String(count);
  svg.addEventListener("click", (event) => {
    const box = svg.getBoundingClientRect();
    if (!box.width) return;
    const vb = svg.viewBox.baseVal,
      x = (event.clientX - box.left) * (vb.width / box.width),
      index = count === 1 ? 0 : Math.round(((x - padL) / inner) * (count - 1));
    svg.dispatchEvent(
      new CustomEvent("pulse-select", {
        bubbles: true,
        detail: { index: Math.max(0, Math.min(count - 1, index)) },
      }),
    );
  });
}

/**
 * Selected-observation chips placed beside the selection line rather than
 * under the figure, so reading a value costs no eye travel. Chips are stacked
 * apart when two series are close, pushed back inside the plot when the stack
 * would overflow it, and flipped to the left of the line once the selection
 * passes the middle — which is where it sits by default, at the series end.
 */
export function placeChips(overlay, chips, { x, width, height, flip, top = 8, bottom = 34 }) {
  const ordered = [...chips].sort((a, b) => a.y - b.y);
  for (let i = 1; i < ordered.length; i += 1) {
    ordered[i].labelY = Math.max(
      ordered[i].y,
      (ordered[i - 1].labelY ?? ordered[i - 1].y) + 17,
    );
  }
  const overflow = (ordered.at(-1)?.labelY ?? 0) - (height - bottom);
  if (overflow > 0) for (const chip of ordered) chip.labelY = (chip.labelY ?? chip.y) - overflow;
  for (const chip of ordered) {
    chip.labelY = Math.max(top, Math.min(height - bottom, chip.labelY ?? chip.y));
  }
  for (const chip of ordered) {
    const chipWidth = Math.min(190, Math.max(76, chip.text.length * 6.8 + 12)),
      left = flip ? x - chipWidth - 7 : x + 7,
      node = overlayLabel(
        overlay,
        chip.text,
        Math.max(4, Math.min(width - chipWidth - 4, left)),
        chip.labelY - 8,
        { width: chipWidth, align: "left", color: chip.color, className: "selection-chip" },
      );
    node.style.background = "#1f2233";
  }
}

// Headcounts are published in thousands, to one decimal, and read in millions.
// Rounded on the integer hundredths rather than by toFixed: 1,825.0 thousand is
// 1.825 million, which is not exactly representable, so toFixed(2) would show
// 1.82 and lose the half upwards.
export function millionsValue(value) {
  return (Math.round(Number(value) / 10) / 100).toFixed(2);
}
export function millions(value, { long = false } = {}) {
  const text = millionsValue(value);
  return long ? `${text} million` : `${text}M`;
}


// --- Shared figure furniture --------------------------------------------
// Added for the world-demography report and available to any visual: a
// people-scale formatter, the selected-value strip, the accessible data
// equivalent and the provenance line. These extend the existing shared
// drawing role rather than introducing a new one, and they add no styling to
// any visual that does not call them.

/**
 * Thousands of people in the unit a reader says out loud. `signed` is for a
 * flow, where the direction is the point and a leading plus is information;
 * a stock never takes it.
 */
export function people(thousands, { signed = false } = {}) {
  if (thousands === null || thousands === undefined || !Number.isFinite(Number(thousands))) return "—";
  const value = Number(thousands);
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  const size = Math.abs(value);
  if (size >= 1000000) return `${sign}${(size / 1000000).toFixed(2)}bn`;
  if (size >= 1000) return `${sign}${(size / 1000).toFixed(size >= 10000 ? 1 : 2)}M`;
  return `${sign}${Math.round(size * 10) / 10}k`;
}

export function signedPercent(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  return `${number > 0 ? "+" : number < 0 ? "−" : ""}${Math.abs(number).toFixed(digits)}%`;
}

/** The calendar year of an ISO period, which is how an annual axis reads. */
export function periodYear(period) { return String(period).slice(0, 4); }

/** The value strip: the same place above every plot, never over the marks. */
export function valueStrip(title, entries) {
  const strip = node("div");
  strip.className = "values";
  const heading = node("span", title);
  heading.className = "yr";
  strip.append(heading);
  for (const entry of entries) {
    const item = node("span");
    item.className = "v";
    const swatch = node("i");
    swatch.style.background = entry.color;
    const value = node("b", entry.value);
    item.append(swatch, document.createTextNode(entry.label), value);
    if (entry.extra) {
      const extra = node("em", entry.extra);
      item.append(extra);
    }
    strip.append(item);
  }
  return strip;
}

/**
 * `summary` replaces the default disclosure label; `numeric` right-aligns
 * every column after the first, which is where the values are.
 */
export function dataTable(caption, headings, bodyRows, { summary: label = "Provenance, query and data table", numeric = false } = {}) {
  const details = node("details"), summary = node("summary", label);
  // A stable identity so a report can reopen it after an asynchronous
  // refresh: the caption names one figure's table and no other's.
  details.dataset.disclosure = caption;
  const scroll = node("div"), table = node("table");
  scroll.className = "table-scroll";
  table.className = "accessible-data";
  const head = node("thead"), headRow = node("tr");
  headings.forEach((heading, index) => {
    const cell = node("th", heading);
    cell.scope = "col";
    if (numeric && index) cell.className = "n";
    headRow.append(cell);
  });
  head.append(headRow);
  const body = node("tbody");
  for (const row of bodyRows) {
    const tableRow = node("tr");
    row.forEach((cellValue, index) => {
      const cell = node(index ? "td" : "th", cellValue);
      if (!index) cell.scope = "row";
      else if (numeric) cell.className = "n";
      tableRow.append(cell);
    });
    body.append(tableRow);
  }
  table.append(node("caption", caption), head, body);
  scroll.append(table);
  details.append(summary, scroll);
  return details;
}

export function provenanceLine(text) {
  const paragraph = node("p", text);
  paragraph.className = "figure-provenance";
  return paragraph;
}


// --- Grouped amounts and year-axis frames --------------------------------
// Added for the national-accounts figures and available to any visual.
// Amounts group thousands with a narrow no-break space and carry their unit
// after the number (2 991 bn €); decimals keep the point. The frame below is
// one axis box: y grid, ticks and values, the axes, year ticks and a unit
// title, drawn into a plot's SVG and its HTML overlay.

export const FRAME = Object.freeze({
  grid: "rgba(240,243,248,.07)",
  zero: "rgba(240,243,248,.45)",
  axis: "#7a8397",
  label: "#c9d0db",
  unit: "#abb5c5",
  mark: "#f0f3f8",
  ground: "#111318",
});

/** Thousands grouped with U+202F, a fixed number of decimals, "—" for none. */
export function grouped(value, dp = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Number(value)
    .toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })
    .replace(/,/g, " ");
}

/**
 * A signed amount. The sign is dropped when the value rounds to zero at the
 * shown precision, so a reading never says "+0.0" for a fall of 0.02.
 */
export function signedGrouped(value, dp = 1, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  const text = grouped(Math.abs(number), dp);
  const shown = Number(Math.abs(number).toFixed(dp));
  const sign = shown === 0 ? "" : number > 0 ? "+" : "−";
  return `${sign}${text}${suffix}`;
}

/** A rounded linear domain; `zero` forces zero inside it. */
export function niceLinear(lo, hi, zero = false, divisions = 4) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / divisions, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= raw) || 10 * mag;
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
}

/** Ticks of a linear domain, each value snapped to its step. */
export function linearTicks(domain, y, labeller) {
  const ticks = [];
  for (let value = domain.lo; value <= domain.hi + domain.step / 2; value += domain.step) {
    const snapped = Math.round(value / domain.step) * domain.step;
    ticks.push({ value: snapped, y: y(snapped), t: labeller(snapped), zero: Math.abs(snapped) < 1e-9 });
  }
  return ticks;
}

/**
 * A year axis where each year owns a band `step` wide: a year's point sits at
 * its middle, `x(year + 0.5)`, and a quarter at `x(year + (q - 0.5) / 4)`.
 */
export function yearScale(from, to, x0, x1) {
  const span = to - from + 1;
  return { from, to, x0, x1, step: (x1 - x0) / span, x: (t) => x0 + ((t - from) / span) * (x1 - x0) };
}

/** Round-year ticks, no more than `maxTicks`. */
export function yearTicks(scale, maxTicks = 14) {
  const span = scale.to - scale.from + 1;
  const gap = [1, 2, 5, 10, 20, 25].find((g) => span / g <= maxTicks) || 25;
  const ticks = [];
  for (let year = Math.ceil(scale.from / gap) * gap; year <= scale.to; year += gap) {
    ticks.push({ x: scale.x(year + 0.5), t: String(year) });
  }
  return ticks;
}

/**
 * An overlay label anchored at (x, y) in the plot's own pixels: "start",
 * "middle" or "end" horizontally, centred on y unless `top` is set.
 */
export function anchoredLabel(overlay, text, x, y, anchor = "start", { size = 11, width, color = FRAME.label, weight = 400, top = false } = {}) {
  const box = width ?? (anchor === "middle" ? 120 : 220);
  const left = anchor === "end" ? x - box : anchor === "middle" ? x - box / 2 : x;
  const item = overlayLabel(overlay, text, Math.round(left * 10) / 10, Math.round((top ? y : y - size * 0.55) * 10) / 10, {
    width: box, align: anchor === "end" ? "right" : anchor === "middle" ? "center" : "left", color,
  });
  item.style.fontSize = `${size}px`;
  item.style.lineHeight = "1";
  item.style.whiteSpace = "nowrap";
  if (weight !== 400) item.style.fontWeight = String(weight);
  return item;
}

/**
 * One axis frame. `yTicks` are `{ y, t, zero }`, `xTicks` are `{ x, t }`.
 * Gridlines are drawn first, so the marks a visual adds afterwards sit above.
 */
export function drawFrame(svg, overlay, { x0, x1, top, bottom, yTicks = [], xTicks = [], unit = "", size = 11, zeroStroke = FRAME.zero }) {
  for (const tick of yTicks) {
    line(svg, { x1: x0, x2: x1, y1: tick.y, y2: tick.y, stroke: tick.zero ? zeroStroke : FRAME.grid });
    line(svg, { x1: x0 - 5, x2: x0, y1: tick.y, y2: tick.y, stroke: FRAME.axis });
    if (tick.t !== "") anchoredLabel(overlay, tick.t, x0 - 9, tick.y, "end", { size });
  }
  line(svg, { x1: x0, x2: x0, y1: top, y2: bottom, stroke: FRAME.axis });
  line(svg, { x1: x0, x2: x1, y1: bottom, y2: bottom, stroke: FRAME.axis });
  for (const tick of xTicks) {
    line(svg, { x1: tick.x, x2: tick.x, y1: bottom, y2: bottom + 5, stroke: FRAME.axis });
    anchoredLabel(overlay, tick.t, tick.x, bottom + 8, "middle", { size, top: true });
  }
  if (unit) anchoredLabel(overlay, unit, x0, 3, "start", { size, color: FRAME.unit, top: true, width: 520 });
}

/**
 * Transparent year bands over a plot. A click on one emits `pulse-select`
 * with its year; the report decides what that selects.
 */
export function yearHits(svg, scale, top, bottom) {
  for (let year = scale.from; year <= scale.to; year += 1) {
    const band = rect(svg, scale.x(year), top, Math.max(1, scale.step), bottom - top, "transparent");
    band.style.cursor = "pointer";
    band.dataset.year = String(year);
    band.addEventListener("click", () => {
      svg.dispatchEvent(new CustomEvent("pulse-select", { bubbles: true, detail: { year } }));
    });
  }
}

/** A plot box: an SVG of a fixed size with its overlay above it. */
export function plotBox(width, height, aria) {
  const box = node("div");
  box.className = "plot";
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
  const svg = node("svg", undefined, true);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", aria);
  const overlay = node("div");
  overlay.className = "ov";
  overlay.setAttribute("aria-hidden", "true");
  box.append(svg, overlay);
  return { box, svg, overlay };
}

/** A caption line above a plot, in small capitals. */
export function plotCaption(text) {
  const item = node("p", text);
  item.className = "cap";
  return item;
}

/** A labelled warning: a named data quirk, never colour alone. */
export function warning(label, text) {
  const item = node("p");
  item.className = "warn";
  item.append(node("b", label), node("span", text));
  return item;
}

/** A legend of swatches; `shape` is "box", "dot", "line" or "tick". */
export function legendRow(entries) {
  const row = node("div");
  row.className = "legend";
  for (const entry of entries) {
    const item = node("span");
    const swatch = node("i");
    swatch.className = entry.shape ?? "box";
    swatch.style.background = entry.color;
    item.append(swatch, document.createTextNode(entry.label));
    row.append(item);
  }
  return row;
}
