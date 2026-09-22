/**
 * Population by five-year age band and sex at the selected year, and the same
 * people split into young, working age and old.
 *
 * The only figure here that is not on a time axis: it renders one year, the
 * one selected anywhere on the page. Rows arrive in two groupings of the same
 * population and are never added across them — the bar beneath each pyramid
 * is the broad grouping alone, and the pyramid is the five-year grouping
 * alone. Bands are ordered by their first year of age, never by their label:
 * as text, "100+" sorts before "10-14".
 */
import {
  chart, dataTable, node, overlayLabel, panelGrid, people, provenanceLine,
  rect, valueStrip,
} from "./report-shared.js";
import { validateAgeStructureRows } from "./age-structure.contract.js";

const MEN = "#8fb0d1", WOMEN = "#c98fb0";
const BROAD_COLOURS = { "0-14": "#9dc0ae", "15-64": "#8fb0d1", "65+": "#d09a6a" };
const SVG_HEIGHT = 252, GAP = 30;

export function renderAgeStructure(rows, display = {}, provenance = "") {
  const bands = validateAgeStructureRows(rows);
  const { width = 1188, selectedYear = "", seriesColours = {}, columns = 3 } = display;

  const byCountry = new Map();
  for (const band of bands) {
    if (!byCountry.has(band.location_id)) byCountry.set(band.location_id, { name: band.location_name, fiveYear: [], broad: [] });
    const entry = byCountry.get(band.location_id);
    if (band.age_grouping === "five-year") entry.fiveYear.push(band);
    else if (band.age_grouping === "broad") entry.broad.push(band);
  }
  for (const entry of byCountry.values()) {
    entry.fiveYear.sort((left, right) => left.age_start - right.age_start);
    entry.broad.sort((left, right) => left.age_start - right.age_start);
  }

  const grid = node("div");
  grid.className = "multiples";
  const { columns: panelColumns, width: panelWidth } = panelGrid(width, Math.min(columns, Math.max(1, byCountry.size)));
  grid.style.setProperty("--multiple-columns", String(panelColumns));

  for (const [id, entry] of byCountry) {
    const colour = seriesColours[id] ?? "#b2b6ca";
    const panel = node("div");
    panel.className = "multiple-panel";
    const title = node("span", entry.name);
    title.className = "multiple-title";
    title.style.color = colour;
    panel.append(title);

    const total = entry.fiveYear.reduce((sum, band) => sum + band.population_total_thousands, 0);
    const widest = entry.fiveYear.reduce(
      (largest, band) => Math.max(largest, band.population_male_thousands, band.population_female_thousands), 1);
    panel.append(valueStrip(String(selectedYear), [
      { color: colour, label: "Population", value: people(total) },
      { color: MEN, label: "Widest band", value: people(widest) },
    ]));

    const centre = Math.round(panelWidth / 2);
    const half = Math.max(40, centre - GAP / 2 - 12);
    const rowHeight = (SVG_HEIGHT - 36) / Math.max(1, entry.fiveYear.length);
    const { root, svg, overlay } = chart(panelWidth, SVG_HEIGHT,
      `${entry.name}: population by five-year age band and sex at ${selectedYear}`);

    entry.fiveYear.forEach((band, offset) => {
      const top = 18 + (entry.fiveYear.length - 1 - offset) * rowHeight;
      const menWidth = (band.population_male_thousands / widest) * half;
      const womenWidth = (band.population_female_thousands / widest) * half;
      rect(svg, centre - GAP / 2 - menWidth, top, menWidth, Math.max(1, rowHeight - 1.8), MEN, 0.85);
      rect(svg, centre + GAP / 2, top, womenWidth, Math.max(1, rowHeight - 1.8), WOMEN, 0.85);
      if (offset % 2 === 0) overlayLabel(overlay, band.age_group, centre - 17, top - 3, { width: 34, align: "center" });
    });
    overlayLabel(overlay, "Men", centre - GAP / 2 - half, 2, { width: half, align: "center", color: MEN });
    overlayLabel(overlay, "Women", centre + GAP / 2, 2, { width: half, align: "center", color: WOMEN });
    panel.append(root);

    const bar = node("div");
    bar.className = "broad-bands";
    const scale = node("div");
    scale.className = "broad-scale";
    for (const band of entry.broad) {
      const segment = node("div");
      segment.style.width = `${band.share_of_population_pct}%`;
      segment.style.background = BROAD_COLOURS[band.age_group] ?? "#8c93a8";
      segment.append(node("span", `${band.share_of_population_pct.toFixed(1)}%`));
      bar.append(segment);
      scale.append(node("span", band.age_group));
    }
    panel.append(bar, scale);
    grid.append(panel);
  }

  const fragment = document.createDocumentFragment();
  fragment.append(grid);
  if (provenance) fragment.append(provenanceLine(provenance));
  fragment.append(dataTable(
    `Population by age band and sex at ${selectedYear}`,
    ["Age band", "Country", "Grouping", "Men", "Women", "Share of population"],
    bands.map((band) => [
      band.age_group, band.location_name, band.age_grouping,
      people(band.population_male_thousands), people(band.population_female_thousands),
      `${band.share_of_population_pct.toFixed(2)}%`,
    ]),
  ));
  return fragment;
}
