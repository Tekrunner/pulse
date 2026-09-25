import { expect, test } from "@playwright/test";
import { publishedRows } from "./published-data.mjs";

const ROUTE = "reports/french-gdp";
const FIGURES = [
  "output-growth-tail",
  "demand-contribution-bars",
  "branch-share-panels",
  "income-share-panels",
  "dollar-decomposition",
  "oecd-standing",
  "per-capita-drivers",
  "index-choropleth",
];

/**
 * Every expectation is read from the served Parquet and formatted here, never
 * restated as a literal: an INSEE, World Bank, OECD or Eurostat release moves
 * these values and the gate in front of deployment must move with them. The
 * default selected year is the last year of the annual accounts, itself read
 * from the data.
 */
const grouped = (value, dp = 0) =>
  Number(value).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp }).replace(/,/g, " ");
const signed = (value, dp, suffix) => {
  if (value === null || value === undefined) return "—";
  const shown = Number(Math.abs(value).toFixed(dp));
  return `${shown === 0 ? "" : value > 0 ? "+" : "−"}${grouped(Math.abs(value), dp)}${suffix}`;
};
const yearOf = (period) => Number(String(period).slice(0, 4));

const ANNUAL = "french-national-accounts-annual";
const QUARTERLY = "french-gdp-quarterly";
const DEPARTEMENTS = "french-departement-gdp";
const OECD = "oecd-productivity-comparison";
const DOLLAR = "french-gdp-dollar-decomposition";

const [LAST] = publishedRows([ANNUAL], `SELECT * FROM "${ANNUAL}" ORDER BY period DESC LIMIT 1`);
const YEAR = yearOf(LAST.period);
const QUARTERS_IN_YEAR = publishedRows([QUARTERLY], `SELECT * FROM "${QUARTERLY}" WHERE year(period) = ${YEAR} ORDER BY period`);
const [LAST_QUARTER] = publishedRows([QUARTERLY], `SELECT max(period) AS period FROM "${QUARTERLY}"`);
const LAST_QUARTER_YEAR = yearOf(LAST_QUARTER.period);
const [DEPARTEMENT_EDGE] = publishedRows([DEPARTEMENTS], `SELECT min(period) AS first, max(period) AS last FROM "${DEPARTEMENTS}"`);
const [PARIS] = publishedRows([DEPARTEMENTS],
  `SELECT * FROM "${DEPARTEMENTS}" WHERE departement_code = '75' AND period = DATE '${DEPARTEMENT_EDGE.last}'`);
const FRANCE_PPP = publishedRows([OECD],
  `SELECT reference_area_code, gdp_per_capita_ppp_current_usd AS level FROM "${OECD}"
    WHERE period = DATE '${YEAR}-01-01' AND reference_area_code IN ('FRA', 'DEU', 'GBR', 'USA')`);
const [DOLLAR_AT_YEAR] = publishedRows([DOLLAR], `SELECT * FROM "${DOLLAR}" WHERE period = DATE '${YEAR}-01-01'`);
const A10 = publishedRows(["french-branch-value-added"],
  `SELECT DISTINCT branch_code, branch_label FROM "french-branch-value-added" WHERE level = 'A10'`)
  .sort((a, b) => a.branch_label.localeCompare(b.branch_label, "en"));

async function ready(page, route = ROUTE) {
  await page.goto(route, { waitUntil: "networkidle" });
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({ timeout: 45_000 });
  for (const id of FIGURES) {
    await expect(page.locator(`.figure-body[data-slot="${id}"][data-state=ready]`)).toBeVisible({ timeout: 45_000 });
  }
}

const section = (page, id) => page.locator(`section[data-figure="${id}"]`);
const strip = (page, id) => section(page, id).locator(".values").first();
const segment = (page, control) => page.locator(`label:has(input[data-control="${control}"])`);

test("every declared figure reaches ready and reads the provider's values at the latest annual year", async ({ page }) => {
  await ready(page);
  await expect(page.locator('select[data-control="observation-year"]')).toHaveValue(String(YEAR));

  // Headline tiles follow the selected year, at constant prices.
  const tiles = section(page, "output-growth-tail").locator(".tile");
  await expect(tiles.nth(0)).toContainText(`${grouped(LAST.gdp_chained_2020_eur_mn / 1000, 0)} bn €`);
  await expect(tiles.nth(1)).toContainText(signed(LAST.gdp_volume_growth_pct, 1, " %"));
  await expect(tiles.nth(2)).toContainText(`${grouped(LAST.gdp_per_capita_chained_2020_eur, 0)} €`);
  if (QUARTERS_IN_YEAR.length) {
    const quarter = QUARTERS_IN_YEAR.at(-1);
    await expect(tiles.nth(3)).toContainText(signed(quarter.gdp_quarterly_growth_pct, 1, " %"));
    await expect(tiles.nth(4)).toContainText(signed(quarter.gdp_year_on_year_growth_pct, 1, " %"));
  }

  // Demand: households include the institutions serving them.
  const households = LAST.contribution_household_consumption_pt + (LAST.contribution_npish_consumption_pt ?? 0);
  await expect(strip(page, "demand-contribution-bars")).toContainText(signed(households, 2, " pt"));
  await expect(strip(page, "demand-contribution-bars")).toContainText(signed(LAST.contribution_net_trade_pt, 2, " pt"));

  // Income shares close on GDP at current prices.
  await expect(strip(page, "income-share-panels")).toContainText(
    `${grouped((100 * LAST.adjusted_labour_income_eur_mn) / LAST.gdp_current_eur_mn, 1)} %`);

  if (DOLLAR_AT_YEAR) {
    await expect(strip(page, "dollar-decomposition")).toContainText(`${grouped(DOLLAR_AT_YEAR.gdp_current_usd_mn / 1000, 0)} bn $`);
    // Constant dollars carry the provider's own base year in their label.
    await expect(strip(page, "dollar-decomposition")).toContainText(
      `Constant ${DOLLAR_AT_YEAR.constant_usd_base_year} US$${grouped(DOLLAR_AT_YEAR.gdp_constant_usd_mn / 1000, 0)} bn $`);
  } else {
    test.info().annotations.push({ type: "data", description: "the World Bank has not published the latest annual year" });
  }

  const france = FRANCE_PPP.find((row) => row.reference_area_code === "FRA");
  if (france?.level) await expect(section(page, "oecd-standing")).toContainText(`${grouped(france.level / 1000, 1)} k$`);

  // Every figure's value strip sits above its first plot, never over it.
  for (const id of FIGURES) {
    const figure = section(page, id);
    const box = await figure.locator(".values").first().boundingBox();
    const plot = await figure.locator(".plot").first().boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(plot.y + 1);
  }
});

test("the header states where each family's data stops", async ({ page }) => {
  await ready(page);
  const header = page.locator(".gdp-report header dl");
  await expect(header).toContainText(`INSEE annual accounts${YEAR}`);
  await expect(header).toContainText(`${LAST_QUARTER_YEAR}-Q${Math.floor((Number(LAST_QUARTER.period.slice(5, 7)) - 1) / 3) + 1}`);
  await expect(header).toContainText(`Eurostat regions${yearOf(DEPARTEMENT_EDGE.last)}`);
});

test("the departement strip and table carry euros and the index, not PPS", async ({ page }) => {
  await ready(page);
  const map = section(page, "index-choropleth");
  await expect(map.locator(".values")).not.toContainText("PPS");
  await expect(map.locator("table.accessible-data thead")).not.toContainText("PPS");
});

test("the map draws its nearest published year and says so", async ({ page }) => {
  await ready(page);
  const map = section(page, "index-choropleth");
  if (yearOf(DEPARTEMENT_EDGE.last) < YEAR) {
    await expect(map.locator(".values .yr")).toHaveText(`${yearOf(DEPARTEMENT_EDGE.last)} · latest published`);
    await expect(map.locator(".banner")).toContainText(String(YEAR));
    await expect(map).toContainText(grouped(PARIS.gdp_per_inhabitant_index_france, 0));
    await map.locator(".banner button").click();
    await expect(page.locator('select[data-control="observation-year"]')).toHaveValue(String(yearOf(DEPARTEMENT_EDGE.last)));
    await expect(map.locator(".banner")).toHaveCount(0);
  } else {
    test.info().annotations.push({ type: "data", description: "departement figures reach the latest annual year" });
  }
});

test("branches drill down and back in a fixed alphabetical order", async ({ page }) => {
  await ready(page);
  const figure = section(page, "branch-share-panels");
  const titles = figure.locator(".panel .t:first-child > span:first-child");
  await expect(titles).toHaveCount(A10.length);
  const shown = await titles.evaluateAll((items) => items.map((item) => item.getAttribute("title")));
  expect(shown).toEqual(A10.map((row) => row.branch_label));

  // The order survives a change of year.
  await page.locator('button[data-control="year-previous"]').click();
  await expect(figure.locator(".values .yr")).toHaveText(String(YEAR - 1));
  expect(await titles.evaluateAll((items) => items.map((item) => item.getAttribute("title")))).toEqual(shown);

  const open = figure.locator("button.open").first();
  await open.click();
  await expect(figure.locator(".crumb.cur")).toBeVisible();
  await expect(figure.locator(".crumb").first()).toHaveText("All branches");
  await figure.locator(".crumb").first().click();
  await expect(titles).toHaveCount(A10.length);
});

test("France stays, comparators come and go, and the aggregate is a reference", async ({ page }) => {
  await ready(page);
  await expect(page.locator(".compare-line .chip.fixed")).toHaveText("FRA");
  for (const code of ["DEU", "GBR", "USA"]) await expect(page.locator(`button[data-control="remove-${code}"]`)).toBeVisible();

  await page.locator('button[data-control="remove-GBR"]').click();
  await expect(page.locator('button[data-control="remove-GBR"]')).toHaveCount(0);
  await expect(page.locator(`.figure-body[data-slot="oecd-standing"][data-state=ready]`)).toBeVisible({ timeout: 30_000 });
  await page.locator('select[data-control="add-comparator"]').focus();
  await page.locator('select[data-control="add-comparator"]').selectOption("ITA");
  await expect(page.locator('button[data-control="remove-ITA"]')).toBeVisible();
  await expect(page.locator('select[data-control="add-comparator"]')).toBeFocused();

  const reference = page.locator('input[data-control="oecd-reference"]');
  await expect(reference).toBeChecked();
  await page.locator("label.chip.ref").click();
  await expect(reference).not.toBeChecked();
});

test("a click near the left, middle and right of a plot selects that year", async ({ page }) => {
  await ready(page);
  const plot = section(page, "demand-contribution-bars").locator(".plot svg").first();
  const box = await plot.boundingBox();
  const bands = await plot.locator("rect[data-year]").evaluateAll((items) =>
    items.map((item) => ({ year: Number(item.dataset.year), x: Number(item.getAttribute("x")), width: Number(item.getAttribute("width")) })));
  expect(bands.length).toBeGreaterThan(10);
  const viewBox = await plot.evaluate((svg) => svg.viewBox.baseVal.width);
  for (const band of [bands[1], bands[Math.floor(bands.length / 2)], bands.at(-2)]) {
    const x = ((band.x + band.width / 2) / viewBox) * box.width;
    await plot.click({ position: { x, y: box.height / 2 } });
    await expect(page.locator('select[data-control="observation-year"]')).toHaveValue(String(band.year));
    await expect(strip(page, "demand-contribution-bars").locator(".yr")).toHaveText(String(band.year));
  }
});

test("the headline switches measure and scale without losing the selected year", async ({ page }) => {
  await ready(page);
  await segment(page, "measure-capita").click();
  await expect(section(page, "output-growth-tail").locator(".cap").first()).toContainText("per inhabitant");
  await expect(strip(page, "output-growth-tail")).toContainText(`${grouped(LAST.gdp_per_capita_chained_2020_eur, 0)} €`);
  await segment(page, "scale-log").click();
  await expect(section(page, "output-growth-tail").locator(".ov").first()).toContainText("log scale");
  await expect(page.locator('select[data-control="observation-year"]')).toHaveValue(String(YEAR));
});

test("every figure carries an accessible data equivalent and its own provenance", async ({ page }) => {
  await ready(page);
  for (const id of FIGURES) {
    const figure = section(page, id);
    await expect(figure.locator("table.accessible-data").first()).toBeAttached();
    await expect(figure.locator(".figure-provenance").first()).toContainText(/Source/);
    for (const svg of await figure.locator("svg").all()) {
      await expect(svg).toHaveAttribute("role", "img");
      expect((await svg.getAttribute("aria-label"))?.length ?? 0).toBeGreaterThan(10);
    }
  }
});

test("a failed dataset stays inside its own figure", async ({ page }) => {
  await page.goto(`${ROUTE}?scenario=slot-query`, { waitUntil: "networkidle" });
  await expect(page.locator(`.figure-body[data-slot="branch-share-panels"][data-state=query-error]`)).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.figure-body[data-slot="branch-share-panels"] [role=alert] button')).toHaveText("Retry");
  for (const id of FIGURES.filter((item) => item !== "branch-share-panels")) {
    await expect(page.locator(`.figure-body[data-slot="${id}"][data-state=ready]`)).toBeVisible({ timeout: 45_000 });
  }
});

for (const [scenario, state] of [["query", "query-error"], ["schema", "schema-error"], ["empty", "empty"]]) {
  test(`every figure shows the ${state} state on its own`, async ({ page }) => {
    await page.goto(`${ROUTE}?scenario=${scenario}`, { waitUntil: "networkidle" });
    for (const id of FIGURES) {
      await expect(page.locator(`.figure-body[data-slot="${id}"][data-state=${state}]`)).toBeVisible({ timeout: 45_000 });
    }
  });
}

test("a failed engine start is a report-wide state with a retry", async ({ page }) => {
  await page.goto(`${ROUTE}?scenario=startup`, { waitUntil: "networkidle" });
  await expect(page.locator(".report-content[data-state=engine-error]")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".report-content [role=alert] button")).toHaveText("Retry");
});

test("loading keeps every figure's frame and says so", async ({ page }) => {
  await page.goto(`${ROUTE}?scenario=loading`);
  for (const id of FIGURES) {
    await expect(page.locator(`.figure-body[data-slot="${id}"][data-state=loading]`)).toBeVisible({ timeout: 45_000 });
  }
});

for (const viewport of [{ width: 740, height: 360 }, { width: 320, height: 640 }]) {
  test(`no horizontal page scroll at ${viewport.width} px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await ready(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const toggle = page.locator('button[data-control="controls-toggle"]');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('select[data-control="observation-year"]')).toBeVisible();
  });
}

test("suspect lineage marks only the figure its columns reach", async ({ page }) => {
  await ready(page, `${ROUTE}?scenario=status-suspect`);
  const cue = section(page, "branch-share-panels").locator(".qualification");
  await expect(cue).toContainText("Suspect");
  await expect(page.locator(".gdp-report header [data-qualification=suspect]")).toContainText("Figure 3");
  await expect(page.locator("section.fig .qualification")).toHaveCount(1);
});

test("a publication past its release is stale against the reader's clock", async ({ page }) => {
  await ready(page, `${ROUTE}?scenario=status-stale`);
  await expect(section(page, "dollar-decomposition").locator(".qualification")).toContainText("Stale");
  await expect(page.locator("section.fig .qualification")).toHaveCount(1);
});

test("a render failure keeps its siblings and offers a retry", async ({ page }) => {
  await page.goto(`${ROUTE}?scenario=render`, { waitUntil: "networkidle" });
  await expect(page.locator('.figure-body[data-slot="output-growth-tail"][data-state=render-error]')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.figure-body[data-slot="output-growth-tail"] [role=alert] button')).toHaveText("Retry");
  for (const id of FIGURES.slice(1)) {
    await expect(page.locator(`.figure-body[data-slot="${id}"][data-state=ready]`)).toBeVisible({ timeout: 45_000 });
  }
});

test("focus, scroll and open disclosures survive an update", async ({ page }) => {
  await ready(page);
  const table = section(page, "income-share-panels").locator("details");
  await table.locator("summary").click();
  await expect(table).toHaveAttribute("open", "");
  const next = page.locator('button[data-control="year-previous"]');
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(strip(page, "income-share-panels").locator(".yr")).toHaveText(String(YEAR - 1));
  await expect(page.locator('button[data-control="year-previous"]')).toBeFocused();
  await expect(section(page, "income-share-panels").locator("details")).toHaveAttribute("open", "");
});
