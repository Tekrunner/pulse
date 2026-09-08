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
export function xTicks(overlay, rows, scale, top, width, labelWidth = 64) {
  for (const i of tickIndices(rows.length, scale.inner)) {
    const left = Math.max(
      scale.padL - 10,
      Math.min(width - labelWidth, scale.x(i) - labelWidth / 2),
    );
    overlayLabel(overlay, periodLabel(rows[i].period, true), left, top, {
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
