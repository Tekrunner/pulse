/**
 * Each branch's share of total value added at current prices, one panel per
 * branch one level below the open branch, in a fixed alphabetical order so
 * panels never move when the year changes. Every panel has its own vertical
 * scale; its title carries the share in the selected year and the change
 * since the window start. A branch with more than one sub-branch opens into
 * them, and the breadcrumb returns; both ask the report for a new path.
 * Residual rows are dashed and tagged derived.
 */
import {
  FRAME, circle, dataTable, drawFrame, grouped, line, linearTicks, niceLinear, node, panelGrid,
  plotBox, polyline, provenanceLine, signedGrouped, valueStrip, warning, yearHits, yearScale,
} from "./report-shared.js";
import { validateBranchSharePanelsRows } from "./branch-share-panels.contract.js";

const ACCENT = "#73d6c2";
const PANEL = Object.freeze({ height: 118, top: 8, bottom: 96, x0: 44, padRight: 8, size: 10 });
// `.panels` gap and `.panel` horizontal padding in style.css.
const GRID = Object.freeze({ gap: 10, padding: 10, readable: 200 });
const BELOW = Object.freeze({ A10: "A38", A38: "A88" });

const yearOf = (period) => Number(period.slice(0, 4));
const keyOf = (level, code) => `${level}:${code}`;

/** One series per branch: its key, parent key, first and last year, and shares by year. */
function branchesOf(observations) {
  const byKey = new Map();
  for (const row of observations) {
    const key = keyOf(row.level, row.branch_code);
    let branch = byKey.get(key);
    if (!branch) {
      const parentLevel = row.level === "A38" ? "A10" : row.level === "A88" ? "A38" : null;
      branch = {
        key, level: row.level, code: row.branch_code, label: row.branch_label, residual: row.is_residual,
        parent: parentLevel ? keyOf(parentLevel, row.parent_code) : null, share: new Map(), first: Infinity, last: -Infinity,
      };
      byKey.set(key, branch);
    }
    const year = yearOf(row.period);
    branch.share.set(year, row.share_of_total_value_added_pct);
    branch.first = Math.min(branch.first, year);
    branch.last = Math.max(branch.last, year);
  }
  return byKey;
}

export function renderBranchSharePanels(rows, display = {}, provenance = "") {
  const observations = validateBranchSharePanelsRows(rows);
  const { width = 1188, notes = [] } = display;
  const byKey = branchesOf(observations);
  const branches = [...byKey.values()];

  // The open path, kept to the prefix where each key is a child of the one before.
  const path = [];
  for (const key of display.path ?? []) {
    const branch = byKey.get(key);
    if (!branch || branch.level === "A88" || branch.parent !== (path.at(-1) ?? null)) break;
    path.push(key);
  }
  const parentKey = path.at(-1) ?? null;
  const parent = parentKey ? byKey.get(parentKey) : null;
  const level = parent ? BELOW[parent.level] : "A10";
  const kids = branches.filter((branch) => branch.level === level && (parent ? branch.parent === parentKey : true));
  const get = (branch, year) => branch.share.get(year) ?? null;
  const countKids = (branch) => (BELOW[branch.level]
    ? branches.filter((child) => child.level === BELOW[branch.level] && child.parent === branch.key).length : 0);

  const figure = node("figure");

  // Breadcrumb and level note.
  const first = kids.length ? Math.max(...kids.map((kid) => kid.first)) : null;
  const last = kids.length ? Math.min(...kids.map((kid) => kid.last)) : null;
  const nav = node("nav");
  nav.className = "crumbs";
  nav.setAttribute("aria-label", "Branch level");
  const crumbs = [{ label: "All branches" }].concat(path.map((key) => {
    const label = byKey.get(key).label;
    return { label: label.length > 38 ? `${label.slice(0, 36)}…` : label };
  }));
  crumbs.forEach((crumb, index) => {
    const current = index === crumbs.length - 1;
    const button = node("button", crumb.label);
    button.type = "button";
    button.className = current ? "crumb cur" : "crumb";
    button.setAttribute("aria-current", current ? "page" : "false");
    if (!current) {
      button.addEventListener("click", () => {
        button.dispatchEvent(new CustomEvent("pulse-branch-path", { bubbles: true, detail: { path: path.slice(0, index) } }));
      });
    }
    const separator = node("span", current ? "" : "›");
    separator.className = "muted";
    separator.setAttribute("aria-hidden", "true");
    nav.append(button, separator);
  });
  const levelNote = node("span", kids.length ? `${level} — ${kids.length} branches, ${first}–${last}` : `${level} — no branches`);
  levelNote.className = "muted";
  levelNote.style.fontSize = "12px";
  levelNote.style.marginLeft = "8px";
  nav.append(levelNote);
  figure.append(nav);
  if (!kids.length) return figure;

  if (level === "A88") {
    figure.append(warning("Shorter span", `Industry detail starts in ${first} and ends in ${last}, a year before the broader levels.`));
  }

  // The represented period intersected with the level's common span; a window
  // that misses the span entirely falls back to the span.
  let from = Math.max(display.from ?? first, first), to = Math.min(display.to ?? last, last);
  if (from > to) { from = first; to = last; }
  const year = display.selectedYear ?? last;
  const beyond = year > last || year < first;

  // Value strip.
  const parentShare = parent ? get(parent, year) : 100;
  const strip = [{ label: parent ? parent.label : "All branches", value: parentShare === null ? "—" : `${grouped(parentShare, 1)} % of value added` }];
  if (beyond) strip.push({ label: `this level is published ${first}–${last}` });
  figure.append(valueStrip(String(year), strip));

  // Panels.
  const requested = width >= 900 ? 4 : 2;
  const grid = panelGrid(width, requested, GRID);
  const panelWidth = grid.width, X0 = PANEL.x0, X1 = panelWidth - PANEL.padRight, { top, bottom } = PANEL;
  const xs = yearScale(from, to, X0, X1);
  const xTicks = [{ x: xs.x(from + 0.5), t: String(from) }, { x: xs.x(to + 0.5), t: String(to) }];
  const selectedX = xs.x(Math.min(Math.max(year, from), to) + 0.5);
  const wall = node("div");
  wall.className = "panels";
  wall.style.setProperty("--panel-columns", String(grid.columns));

  const panels = kids.slice().sort((a, b) => a.label.localeCompare(b.label, "en")).map((kid) => {
    const values = [];
    for (let y = from; y <= to; y += 1) { const value = get(kid, y); if (value !== null) values.push(value); }
    const lo = values.length ? Math.min(...values) : 0, hi = values.length ? Math.max(...values) : 1;
    const pad = Math.max((hi - lo) * 0.12, 0.05);
    const domain = niceLinear(Math.max(0, lo - pad), hi + pad, false);
    const yv = (value) => bottom - ((value - domain.lo) / (domain.hi - domain.lo)) * (bottom - top);
    const dp = domain.step < 0.1 ? 2 : domain.step < 1 ? 1 : 0;
    const points = [];
    for (let y = from; y <= to; y += 1) {
      const value = get(kid, y);
      if (value !== null) points.push(`${xs.x(y + 0.5).toFixed(1)},${yv(value).toFixed(1)}`);
    }
    const share = get(kid, year), share0 = get(kid, from), children = level === "A88" ? 0 : countKids(kid);
    return {
      kid, domain, yv, dp, points: points.join(" "), selected: share,
      share: share === null ? (beyond ? `not in ${year}` : "—") : `${grouped(share, 2)} %`,
      change: share === null || share0 === null ? "—" : signedGrouped(share - share0, 2, " pt"),
      children,
    };
  });

  for (const panel of panels) {
    const { kid } = panel;
    const item = node("figure");
    item.className = "panel";
    // `.figure-body figure` strips a figure's padding, ground and gap; a panel keeps its own.
    item.style.padding = "10px 10px 6px";
    item.style.background = "var(--gdp-well)";
    item.style.boxShadow = "inset 0 0 0 1px #2a303d";
    item.style.gap = "4px";

    const title = node("div");
    title.className = "t";
    const name = node("span", `${kid.label} `);
    name.title = kid.label;
    const code = node("span", kid.code);
    code.className = "muted";
    name.append(code);
    const shareCell = node("span");
    shareCell.className = "num";
    const shareValue = node("b", panel.share);
    shareValue.style.fontWeight = "500";
    shareCell.append(shareValue);
    title.append(name, shareCell);

    const change = node("div");
    change.className = "t";
    change.style.fontSize = "11.5px";
    const changeLabel = node("span", `change since ${from}`);
    changeLabel.className = "muted";
    const changeValue = node("span", panel.change);
    changeValue.className = "num muted";
    change.append(changeLabel, changeValue);
    item.append(title, change);

    const plot = plotBox(panelWidth, PANEL.height,
      `${kid.label} (${kid.code}), share of total value added from ${from} to ${to}${kid.residual ? ", derived" : ""}${beyond ? "" : `; selected year ${year}`}`);
    drawFrame(plot.svg, plot.overlay, {
      x0: X0, x1: X1, top, bottom, xTicks, size: PANEL.size, zeroStroke: FRAME.grid,
      yTicks: linearTicks(panel.domain, panel.yv, (value) => grouped(value, panel.dp)),
    });
    const trace = polyline(plot.svg, panel.points, ACCENT, 1.8, kid.residual ? "4 3" : "");
    trace.removeAttribute("stroke-linecap");
    if (!beyond) {
      line(plot.svg, { x1: selectedX, x2: selectedX, y1: top, y2: bottom, stroke: FRAME.mark, "stroke-dasharray": "2 3" });
      if (panel.selected !== null) circle(plot.svg, selectedX, panel.yv(panel.selected), 3.5, FRAME.ground, FRAME.mark, 1.6);
    }
    yearHits(plot.svg, xs, top, bottom);
    item.append(plot.box);

    if (kid.residual) {
      const tag = node("span", "derived");
      tag.className = "tag";
      item.append(tag);
    }
    if (panel.children > 1) {
      const next = BELOW[level];
      const open = node("button", `Open its ${panel.children} ${next} sub-branches ›`);
      open.type = "button";
      open.className = "open";
      open.setAttribute("aria-label", `Open ${kid.label} into its ${panel.children} sub-branches`);
      open.addEventListener("click", () => {
        open.dispatchEvent(new CustomEvent("pulse-branch-path", { bubbles: true, detail: { path: path.concat([kid.key]) } }));
      });
      item.append(open);
    }
    wall.append(item);
  }
  figure.append(wall);

  if (kids.some((kid) => kid.residual)) {
    figure.append(warning("Derived", "Dashed panels tagged \"derived\" have no series of their own: their value added is the parent branch less the industries published separately, at current prices only."));
  }
  for (const note of notes) figure.append(warning(note.label, note.text));
  if (provenance) figure.append(provenanceLine(provenance));

  figure.append(dataTable(`Share of total value added by ${level} branch${parent ? ` within ${parent.label}` : ""}, ${year}`,
    ["Branch", "Share of value added", "Change since window start"],
    panels.map((panel) => [`${panel.kid.label} (${panel.kid.code})`, panel.share, panel.change]),
    { summary: "Data table — branches at this level, selected year", numeric: true }));
  return figure;
}

export { BRANCH_SHARE_PANELS_VISUAL_CONTRACT } from "./branch-share-panels.contract.js";
