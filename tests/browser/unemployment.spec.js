import { expect, test } from "@playwright/test";
import { publishedRows } from "./published-data.mjs";

const ROUTE = "reports/french-unemployment";
const FIGURES = [
  "headline-trend-pair",
  "slack-multiples",
  "age-band-lines",
  "participation-gap-band",
  "departement-choropleth",
  "international-lines",
  "international-participation",
];
// Every expectation below is read from the served Parquet, not from the report
// and not restated as a literal: each refresh moves the latest quarter, and the
// gate in front of deployment must move with it.
const quarterLabel = (period, short = false) =>
  `Q${Math.floor((Number(period.slice(5, 7)) - 1) / 3) + 1} ${short ? period.slice(2, 4) : period.slice(0, 4)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (period) => `${MONTHS[Number(period.slice(5, 7)) - 1]} ${period.slice(2, 4)}`;
// Thousands in, millions out, rounded on integer hundredths as the report does.
const millions = (thousands) => (Math.round(thousands / 10) / 100).toFixed(2);
const shiftMonths = (period, months) => {
  const total = Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1 + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
};

const [national] = publishedRows(
  ["french-labour-market-quarterly"],
  `SELECT * FROM "french-labour-market-quarterly" ORDER BY period DESC LIMIT 1`,
);
const LATEST = {
  period: national.period,
  quarter: quarterLabel(national.period),
  rate: national.unemployment_rate_pct.toFixed(1),
  unemployed: millions(national.unemployed_thousands),
  longTerm: millions(national.long_term_unemployed_thousands),
  halo: millions(national.halo_15_to_64_thousands),
  underemployed: millions(national.underemployed_thousands),
  underemploymentRate: national.underemployment_rate_pct.toFixed(1),
  participation: national.participation_rate_15_to_64_pct.toFixed(1),
  men: national.participation_rate_men_15_to_64_pct.toFixed(1),
  women: national.participation_rate_women_15_to_64_pct.toFixed(1),
  gap: (
    national.participation_rate_men_15_to_64_pct - national.participation_rate_women_15_to_64_pct
  ).toFixed(1),
  under25: national.unemployment_rate_under_25_pct.toFixed(1),
};

// The OECD panels follow the national observation: a quarter is read at its
// last month in the monthly panel. An area that publishes nothing at the
// selected period shows where its series stops instead of a value.
const DEFAULT_COMPARATORS = ["FRA", "DEU", "GBR", "USA", "EU"];
const areaEdges = (dataset, filter, target, grain) =>
  publishedRows(
    [dataset],
    `SELECT reference_area_code AS code, any_value(reference_area_name) AS name,
            max(period) AS latest,
            max(CASE WHEN period = DATE '${target}' THEN ${grain} END) AS value
       FROM "${dataset}"
      WHERE period >= DATE '${shiftMonths(LATEST.period, -39 * 3)}' ${filter}
      GROUP BY reference_area_code ORDER BY name`,
  ).map((area) => ({ ...area, value: area.value ?? null }));
const MONTHLY = areaEdges(
  "oecd-unemployment-comparison",
  "",
  shiftMonths(LATEST.period, 2),
  "unemployment_rate_pct",
);
const QUARTERLY = areaEdges(
  "oecd-participation-comparison",
  "AND sex = 'all'",
  LATEST.period,
  "participation_rate_pct",
);
const chip = (area, label) =>
  area.value === null
    ? `${area.name} — to ${label(area.latest)}`
    : `${area.name} ${area.value.toFixed(1)}%`;
const defaults = (areas) =>
  DEFAULT_COMPARATORS.map((code) => areas.find((area) => area.code === code)).filter(Boolean);
// A non-default area absent at the selected period, added to reach the absence
// path when every default happens to be published.
const absentExtra = (areas) =>
  areas.find((area) => area.value === null && !DEFAULT_COMPARATORS.includes(area.code));

// The map answers for the selected quarter when the localised series has it,
// otherwise for its own latest published quarter.
const LOCALISED_ROWS = publishedRows(
  ["french-departement-unemployment"],
  `WITH published AS (
     SELECT max(period) AS latest FROM "french-departement-unemployment"
      WHERE territory_kind = 'departement' AND period <= DATE '${LATEST.period}')
   SELECT period, territory_code AS code, territory_name AS name, unemployment_rate_pct AS rate
     FROM "french-departement-unemployment", published
    WHERE territory_kind = 'departement' AND period = latest
    ORDER BY rate DESC NULLS LAST`,
);
const localised = (code) => LOCALISED_ROWS.find((row) => row.code === code);
const LOCALISED = {
  quarter: quarterLabel(LOCALISED_ROWS[0].period),
  paris: localised("75").rate.toFixed(1),
  guyane: localised("973").rate.toFixed(1),
  highest: LOCALISED_ROWS[0].name,
};

async function ready(page) {
  await page.goto(ROUTE, { waitUntil: "networkidle" });
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({ timeout: 20_000 });
}

test("every declared visual reaches ready and shows the provider's own latest values", async ({
  page,
}) => {
  await ready(page);
  for (const id of FIGURES) {
    await expect(page.locator(`figure[data-figure="${id}"][data-state=ready]`)).toBeVisible();
  }
  // Values are read beside the selected point, not under the figure.
  const chips = (id) => page.locator(`figure[data-figure="${id}"] .selection-chip`);
  // Only the map keeps text under it: its selection and its national reference.
  await expect(page.locator(".readout")).toHaveCount(2);
  await expect(chips("headline-trend-pair")).toHaveText(
    `${LATEST.quarter} · ${LATEST.rate}% · ${LATEST.unemployed}M`,
  );
  await expect(chips("slack-multiples").filter({ hasText: "Unemployed" })).toHaveText(
    `Unemployed ${LATEST.unemployed}M`,
  );
  await expect(chips("slack-multiples").filter({ hasText: "Long-term" })).toHaveText(
    `Long-term ${LATEST.longTerm}M`,
  );
  await expect(chips("slack-multiples").filter({ hasText: "Halo" })).toHaveText(
    `Halo ${LATEST.halo}M`,
  );
  await expect(chips("slack-multiples").filter({ hasText: "Underemployment" })).toHaveText(
    `Underemployment ${LATEST.underemployed}M`,
  );
  await expect(chips("age-band-lines").filter({ hasText: "Under 25" })).toHaveText(
    `Under 25 ${LATEST.under25}%`,
  );
  await expect(chips("age-band-lines")).toHaveCount(3);
  const participation = chips("participation-gap-band");
  // "Women" contains "men", so the men chip is matched from the start of its text.
  await expect(participation.filter({ hasText: /^Men / })).toHaveText(`Men ${LATEST.men}%`);
  await expect(participation.filter({ hasText: "Women" })).toHaveText(`Women ${LATEST.women}%`);
  await expect(participation.filter({ hasText: "Gap" })).toHaveText(`Gap ${LATEST.gap} pt`);
  const cards = page.locator(".scorecards article");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText(`${LATEST.rate}%`);
  await expect(cards.nth(1)).toContainText(`${LATEST.participation}%`);
  await expect(cards.nth(2)).toContainText(`${LATEST.halo}M`);
  await expect(cards.nth(3)).toContainText(`${LATEST.underemploymentRate}%`);
  await expect(page.locator(".unemployment-report header dl")).toContainText(
    `National data through${LATEST.quarter}`,
  );
});

test("the stored value, the query, the mapped row and the displayed text agree", async ({
  page,
}) => {
  await ready(page);
  const table = page.locator('figure[data-figure="headline-trend-pair"] .accessible-data');
  await page.locator('figure[data-figure="headline-trend-pair"] details summary').click();
  const last = table.locator("tbody tr").last();
  await expect(last.locator("th")).toHaveText(LATEST.quarter);
  await expect(last.locator("td").nth(0)).toHaveText(LATEST.rate);
  await expect(last.locator("td").nth(1)).toHaveText(LATEST.unemployed);
  await expect(table.locator("thead th").nth(2)).toContainText("millions");
  // One decimal in, one decimal out: the published DECIMAL(10,1) must not gain
  // or lose precision on its way through DOUBLE and Number().
  const values = await table.locator("tbody tr td:first-child").allTextContents();
  expect(values.every((value) => /^\d+\.\d$/.test(value))).toBe(true);
});

test("one observation is shared by every quarterly figure, from the control and from a figure", async ({
  page,
}) => {
  await ready(page);
  const output = page.locator(".observation-control output");
  await expect(output).toContainText(LATEST.quarter);
  const slider = page.locator("#pulse-quarter");
  const max = Number(await slider.getAttribute("max"));
  await slider.fill(String(Math.max(0, max - 4)));
  await slider.dispatchEvent("input");
  const chosen = (await output.textContent()).split(" · ")[0];
  expect(chosen).not.toBe(LATEST.quarter);
  await expect(
    page.locator('figure[data-figure="headline-trend-pair"] .selection-chip'),
  ).toContainText(chosen);
  // Every figure at the quarterly grain moved with it.
  for (const id of ["slack-multiples", "age-band-lines", "participation-gap-band"]) {
    await expect(page.locator(`figure[data-figure="${id}"] svg`).first()).toHaveAttribute(
      "aria-label",
      new RegExp(`Selected observation ${chosen}`),
    );
  }
  // Clicking a point on any figure moves the same shared selection.
  const plot = page.locator('figure[data-figure="age-band-lines"] svg');
  const box = await plot.boundingBox();
  await plot.click({ position: { x: box.width * 0.3, y: box.height / 2 } });
  const picked = (await output.textContent()).split(" · ")[0];
  expect(picked).not.toBe(chosen);
  await expect(
    page.locator('figure[data-figure="headline-trend-pair"] .selection-chip'),
  ).toContainText(picked);
});

test("the international panels follow the shared observation and can set it", async ({ page }) => {
  await ready(page);
  const panels = [
    ["international-lines", MONTHLY, monthLabel],
    ["international-participation", QUARTERLY, (period) => quarterLabel(period, true)],
  ];
  const chips = (id) => page.locator(`figure[data-figure="${id}"] .selection-chip`);
  const named = (id, area) =>
    chips(id).filter({ hasText: new RegExp(`^${area.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} `) });
  // Each default shows its value at the selected period, or where it stops.
  for (const [id, areas, label] of panels)
    for (const area of defaults(areas)) await expect(named(id, area)).toHaveText(chip(area, label));
  // An area that publishes nothing at the selected period says where it stops
  // rather than quietly showing another period's value. When no default is
  // absent, one that is gets added so the path is still exercised.
  for (const [id, areas, label] of panels) {
    if (defaults(areas).some((area) => area.value === null)) continue;
    const extra = absentExtra(areas);
    if (!extra) {
      test.info().annotations.push({
        type: "data",
        description: `every ${id} area publishes the selected period`,
      });
      continue;
    }
    await page.locator('[data-control="comparator-add"]').selectOption(extra.code);
    await expect(named(id, extra)).toHaveText(chip(extra, label));
  }
  // Clicking the monthly panel moves the whole report to that month's quarter.
  const plot = page.locator('figure[data-figure="international-lines"] svg').first();
  const box = await plot.boundingBox();
  await plot.click({ position: { x: box.width * 0.25, y: box.height / 2 } });
  const picked = (await page.locator(".observation-control output").textContent()).split(" · ")[0];
  expect(picked).not.toBe(LATEST.quarter);
  await expect(
    page.locator('figure[data-figure="headline-trend-pair"] .selection-chip'),
  ).toContainText(picked);
});

test("the represented period takes presets and an independent custom start and end", async ({
  page,
}) => {
  await ready(page);
  // The segment radios are visually hidden behind their labels, which is what
  // a reader clicks.
  await page.locator("label").filter({ hasText: "5 years" }).click();
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({ timeout: 20_000 });
  const ticks = page.locator('figure[data-figure="headline-trend-pair"] .plot-overlay');
  await expect(ticks).not.toContainText("Q1 17");
  await page.locator('[data-control="start-year"]').selectOption("2010");
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-control="period-five-years"]')).not.toBeChecked();
  await expect(page.locator('[data-control="start-year"]')).toHaveValue("2010");
  await page.locator('[data-control="end-year"]').selectOption("2015");
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-control="end-year"]')).toHaveValue("2015");
  await expect(
    page.locator('figure[data-figure="headline-trend-pair"] .selection-chip'),
  ).toContainText("2015");
});

test("the map publishes every boundary, selects one, and never draws an absent rate as zero", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator('figure[data-figure="departement-choropleth"] h3')).toContainText(
    LOCALISED.quarter,
  );
  const shapes = page.locator("path[data-departement]");
  await expect(shapes).toHaveCount(101);
  await page.locator('path[data-departement="75"]').click();
  const readout = page.locator('figure[data-figure="departement-choropleth"] .readout').first();
  await expect(readout).toContainText("Paris (75)");
  await expect(readout).toContainText(`${LOCALISED.paris}%`);
  await page.locator('path[data-departement="973"]').click();
  await expect(readout).toContainText(`${LOCALISED.guyane}%`);
  // Mayotte has a boundary and no published rate at any date.
  const mayotte = page.locator('path[data-departement="976"]');
  await expect(mayotte).toHaveAttribute("aria-label", /no rate published/);
  await expect(mayotte).toHaveAttribute("stroke-dasharray", "3 2");
  await page.locator('figure[data-figure="departement-choropleth"] details summary').click();
  const row = page
    .locator('figure[data-figure="departement-choropleth"] .accessible-data tbody tr')
    .filter({ hasText: "Mayotte" });
  await expect(row).toContainText("not published");
  await expect(row).not.toContainText("0.0");
  await expect(page.locator(".caution")).toContainText("no localised rate");
  await expect(page.locator('[data-readout="national-reference"]')).toContainText(
    "France métropolitaine",
  );
});

test("every territory carrying a rate also has a shape on the map", async ({ page }) => {
  // The join between french-departement-unemployment and
  // french-departement-geometry spans two dbt packages, which cannot ref each
  // other, so neither can assert this. The report performs the join, so the
  // guarantee is asserted here rather than copied into either package as a
  // hardcoded list that could drift from the provider.
  await ready(page);
  await page.locator('figure[data-figure="departement-choropleth"] details summary').click();
  const rated = await page
    .locator('figure[data-figure="departement-choropleth"] .accessible-data tbody tr')
    .evaluateAll((rows) =>
      rows
        .filter((row) => /^\d+\.\d$/.test(row.children[2].textContent.trim()))
        .map((row) => row.children[1].textContent.trim()),
    );
  expect(rated.length).toBeGreaterThan(90);
  const drawn = new Set(
    await page
      .locator("path[data-departement]")
      .evaluateAll((paths) => paths.map((path) => path.dataset.departement)),
  );
  expect(rated.filter((code) => !drawn.has(code))).toEqual([]);
});

test("the international panel is ragged, capped and never repaints on removal", async ({ page }) => {
  await ready(page);
  const labels = page.locator('figure[data-figure="international-lines"] .selection-chip');
  await expect(labels).toHaveCount(5);
  await expect(page.locator(".comparator-chip")).toHaveText(
    defaults(MONTHLY).map((area) => new RegExp(area.name)),
  );
  const franceColour = await labels
    .filter({ hasText: /^France / })
    .evaluate((node) => node.style.color);
  await page.locator('[data-control="comparator-remove-USA"]').click();
  await expect(
    page.locator('figure[data-figure="international-lines"] .selection-chip'),
  ).toHaveCount(4);
  expect(
    await page
      .locator('figure[data-figure="international-lines"] .selection-chip')
      .filter({ hasText: /^France / })
      .evaluate((node) => node.style.color),
  ).toBe(franceColour);
  // France is fixed: it has no remove control.
  await expect(page.locator('[data-control="comparator-remove-FRA"]')).toHaveCount(0);
  await expect(page.locator(".comparator-field legend")).toContainText("4 of 8");
});

test("a failing dataset fails alone", async ({ page }) => {
  await page.goto(`${ROUTE}?scenario=slot-query`, { waitUntil: "networkidle" });
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('section[data-state="query-error"]')).toHaveCount(1);
  await expect(page.locator('section[data-state="query-error"]')).toContainText(
    "Other sections are unaffected",
  );
  for (const id of ["headline-trend-pair", "slack-multiples", "international-lines"]) {
    await expect(page.locator(`figure[data-figure="${id}"][data-state=ready]`)).toBeVisible();
  }
  await expect(page.locator('figure[data-figure="departement-choropleth"]')).toHaveCount(0);
  await expect(page.locator('section[data-state="query-error"] button')).toBeEnabled();
});

test("the page reflows without horizontal scroll at narrow width and at 400% zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await ready(page);
  const overflow = async () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 320, height: 512 });
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1200);
  expect(await overflow()).toBeLessThanOrEqual(1);
  // A hundred shapes are unreadable at this width, so the map's own accessible
  // equivalent is promoted in its place rather than shrunk.
  await expect(page.locator("path[data-departement]")).toHaveCount(0);
  await expect(
    page.locator('figure[data-figure="departement-choropleth"] .chart-wrapper .accessible-data'),
  ).toBeVisible();
  await expect(
    page.locator('figure[data-figure="departement-choropleth"] .chart-wrapper tbody tr').first(),
  ).toContainText(LOCALISED.highest);
  // Every value stays reachable in the table even where a plot must scroll.
  await expect(page.locator(".accessible-data").first()).toBeAttached();
});

test("focus and open disclosures survive a refresh of the represented period", async ({ page }) => {
  await ready(page);
  await page.locator('figure[data-figure="headline-trend-pair"] details summary').click();
  await expect(
    page.locator('figure[data-figure="headline-trend-pair"] details'),
  ).toHaveAttribute("open", "");
  await page.locator('[data-control="start-year"]').focus();
  await page.locator('[data-control="start-year"]').selectOption("2012");
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({ timeout: 20_000 });
  await expect(
    page.locator('figure[data-figure="headline-trend-pair"] details'),
  ).toHaveAttribute("open", "");
});
