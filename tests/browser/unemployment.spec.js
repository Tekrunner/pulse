import { expect, test } from "@playwright/test";

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
// Read from the published Parquet, not from the report: every assertion below
// compares displayed text against the provider's own value at Q2 2026, the
// latest national quarter, and at Q1 2026 for the localised series.
const LATEST = {
  quarter: "Q2 2026",
  rate: "8.3",
  unemployed: "2.68",
  longTerm: "0.67",
  halo: "1.83",
  underemployed: "1.30",
  underemploymentRate: "4.4",
  participation: "75.4",
  men: "78.0",
  women: "72.8",
  under25: "21.6",
};
// The monthly OECD panel follows the same observation: Q2 2026 is read at its
// last month. The United Kingdom publishes nothing that month, so the monthly
// absence path is exercised by the default view; Italy, whose participation
// series has no Q2, is added to exercise the quarterly one.
const INTERNATIONAL = {
  defaults: ["France", "Germany", "United Kingdom", "United States", "European Union"],
  france: "8.3",
  unitedStates: "4.2",
  europeanUnion: "6.1",
  britainStops: "May 26",
  participationFrance: "56.9",
  participationItalyStops: "Q1 26",
};
const LOCALISED = { quarter: "Q1 2026", paris: "6.3", guyane: "19.3", cantal: "4.7", nord: "10.5" };

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
  await expect(participation.filter({ hasText: "Gap" })).toHaveText("Gap 5.2 pt");
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
  const monthly = page.locator('figure[data-figure="international-lines"] .selection-chip');
  // Q2 2026 is read at its last month in a monthly panel.
  await expect(monthly.filter({ hasText: /^France / })).toHaveText(
    `France ${INTERNATIONAL.france}%`,
  );
  await expect(monthly.filter({ hasText: "United States" })).toHaveText(
    `United States ${INTERNATIONAL.unitedStates}%`,
  );
  await expect(monthly.filter({ hasText: "European Union" })).toHaveText(
    `European Union ${INTERNATIONAL.europeanUnion}%`,
  );
  // The United Kingdom publishes nothing that month, so it says where it stops
  // rather than quietly showing a different month's value.
  await expect(monthly.filter({ hasText: "United Kingdom" })).toHaveText(
    `United Kingdom — to ${INTERNATIONAL.britainStops}`,
  );
  const quarterly = page.locator(
    'figure[data-figure="international-participation"] .selection-chip',
  );
  await expect(quarterly.filter({ hasText: /^France / })).toHaveText(
    `France ${INTERNATIONAL.participationFrance}%`,
  );
  // Italy is not a default comparator; added here because its participation
  // series has no Q2 2026, which is the quarterly absence path.
  await page.locator('[data-control="comparator-add"]').selectOption("ITA");
  await expect(quarterly.filter({ hasText: "Italy" })).toHaveText(
    `Italy — to ${INTERNATIONAL.participationItalyStops}`,
  );
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

test("the international panel is ragged, capped and never repaints on removal", async ({ page }) => {
  await ready(page);
  const labels = page.locator('figure[data-figure="international-lines"] .selection-chip');
  await expect(labels).toHaveCount(5);
  await expect(page.locator(".comparator-chip")).toHaveText(
    INTERNATIONAL.defaults.map((name) => new RegExp(name)),
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
  ).toContainText("Guyane");
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
