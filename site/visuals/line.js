let visualSequence = 0;

function element(name, text) {
  const node = document.createElement(name);
  if (text !== undefined) node.textContent = String(text);
  return node;
}

export function renderLineVisual(rows, { label = "Fixture index", unit = "index" } = {}) {
  if (!Array.isArray(rows) || rows.some((row) => typeof row.period !== "string" || !Number.isFinite(Number(row.value)))) {
    throw new TypeError("Visual rows must contain finite values and string periods");
  }
  const titleId = `visual-title-${++visualSequence}`;
  const section = element("section"); section.className = "visual-card"; section.setAttribute("aria-labelledby", titleId);
  const title = element("h2", label); title.id = titleId; section.append(title);
  if (!rows.length) { const empty = element("p", "No observations are available."); empty.className = "state state-empty"; section.append(empty); return section; }

  const values = rows.map((row) => Number(row.value));
  const { min, max } = values.reduce((extent, value) => ({ min: Math.min(extent.min, value), max: Math.max(extent.max, value) }), { min: Infinity, max: -Infinity });
  const x = (index) => 48 + index * (544 / Math.max(1, rows.length - 1));
  const y = (value) => 210 - ((value - min) / Math.max(1, max - min)) * 160;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 640 260"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `${label}, ${rows.length} observations from ${rows[0].period} to ${rows.at(-1).period}`);
  const line = document.createElementNS(svg.namespaceURI, "polyline");
  line.setAttribute("points", rows.map((row, index) => `${x(index)},${y(row.value)}`).join(" ")); line.setAttribute("fill", "none"); line.setAttribute("stroke", "currentColor"); line.setAttribute("stroke-width", "4"); svg.append(line);
  const marker = document.createElementNS(svg.namespaceURI, "circle"); marker.setAttribute("r", "7"); marker.setAttribute("class", "selected-point"); svg.append(marker);
  const controlLabel = element("label"); controlLabel.className = "observation-control";
  const controlText = element("span", "Selected observation");
  const slider = element("input"); slider.type = "range"; slider.min = "0"; slider.max = String(rows.length - 1); slider.step = "1"; slider.value = String(rows.length - 1);
  const selection = element("output"); selection.setAttribute("aria-live", "polite");
  const select = (index) => { const row = rows[index]; marker.setAttribute("cx", String(x(index))); marker.setAttribute("cy", String(y(row.value))); selection.textContent = `${row.period}: ${row.value} ${unit}`; };
  slider.addEventListener("input", () => select(Number(slider.value))); select(rows.length - 1);
  controlLabel.append(controlText, slider, selection); section.append(svg, controlLabel);

  const table = element("table"); table.className = "accessible-data";
  const caption = element("caption", `${label} (${unit})`); const head = element("thead"); const headRow = element("tr");
  for (const heading of ["Period", "Value"]) { const cell = element("th", heading); cell.scope = "col"; headRow.append(cell); }
  head.append(headRow); const body = element("tbody");
  for (const row of rows) { const tableRow = element("tr"); const period = element("th", row.period); period.scope = "row"; tableRow.append(period, element("td", row.value)); body.append(tableRow); }
  table.append(caption, head, body); section.append(table); return section;
}
