import { expect, test } from "@playwright/test";

const ROUTE = "reports/world-demography";
const FIGURES = [
  "world-population-path",
  "country-population-paths",
  "change-composition",
  "migration-flows",
  "fertility-longevity",
  "age-structure",
];

/**
 * Every expectation below was read from the published Parquet and formatted
 * through the shipped formatter, not copied from the prototype. 2023 is the
 * provider's last estimated year and the report's default observation year.
 */
const AT_2023 = {
  world: { population: "8.09bn", rate: "+0.87% a year" },
  france: { population: "66.4M", natural: "+22.8k", migration: "+91.9k", fertility: "1.64", life: "83.3" },
  germany: { population: "84.5M", natural: "−314.9k", migration: "+609.6k", change: "+294.7k", naturalRate: "−3.7‰", migrationRate: "+7.2‰" },
  britain: { population: "68.7M", migration: "+445.5k" },
  flows: { germanyIn: "1.30M", germanyOut: "580.5k", franceIn: "467.5k", britain: "not published" },
  healthy: "not published",
  franceAge: { total: "66.4M", widest: "2.24M", young: "16.8%", working: "61.5%", old: "21.7%" },
};
const PEAK = { year: "2084", population: "10.29bn" };
const AT_2021 = { franceHealthy: "70.1", germanyHealthy: "68.9", britainHealthy: "68.6" };
const BRITAIN_FLOWS_END = "to 2019";
const JAPAN = { id: "392", name: "Japan", natural: "−774.5k", migration: "+175k" };

async function ready(page) {
  await page.goto(ROUTE, { waitUntil: "networkidle" });
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({ timeout: 45_000 });
  for (const id of FIGURES) {
    await expect(page.locator(`.figure-body[data-slot="${id}"][data-state=ready]`)).toBeVisible({ timeout: 45_000 });
  }
}

const strip = (page, id) => page.locator(`figure[data-figure="${id}"] .values`);
// Panels are found by their own title, never by position: adding a country
// reorders them, and an index would quietly assert about the wrong one.
const panel = (page, id, title) =>
  page.locator(`figure[data-figure="${id}"] .multiple-panel`).filter({ has: page.locator(`.multiple-title:text-is("${title}")`) });
const panelStrip = (page, id, title) => panel(page, id, title).locator(".values");
// The segmented controls hide their radio and style the label, which is the
// repository's own pattern, so a reader — and a test — clicks the label.
const segment = (page, control) => page.locator(`label:has(input[data-control="${control}"])`);

async function selectYear(page, year) {
  const slider = page.locator('input[data-control="observation-year"]');
  await slider.fill(String(year));
  await slider.dispatchEvent("input");
  await expect(page.locator(`figure[data-figure="world-population-path"] .values .yr`)).toHaveText(String(year));
}

test("every declared figure reaches ready and shows the provider's own values at the selected year", async ({ page }) => {
  await ready(page);

  // The value strip is the one place a reader looks, and it is above the plot.
  await expect(strip(page, "world-population-path")).toContainText(AT_2023.world.population);
  await expect(strip(page, "world-population-path")).toContainText(AT_2023.world.rate);
  await expect(strip(page, "world-population-path").locator(".yr")).toHaveText("2023");

  const countries = strip(page, "country-population-paths");
  await expect(countries).toContainText(AT_2023.france.population);
  await expect(countries).toContainText(AT_2023.germany.population);
  await expect(countries).toContainText(AT_2023.britain.population);

  // No figure has a readout under it, and no value box sits inside a plot.
  await expect(page.locator("figure .plot-overlay .selection-chip")).toHaveCount(0);
  for (const id of FIGURES) {
    const figure = page.locator(`figure[data-figure="${id}"]`);
    const strips = figure.locator(".values");
    await expect(strips.first()).toBeVisible();
    const box = await strips.first().boundingBox();
    const plot = figure.locator(".report-visual").first();
    if (await plot.count()) {
      const plotBox = await plot.boundingBox();
      expect(box.y + box.height).toBeLessThanOrEqual(plotBox.y + 1);
    }
  }
});

test("the components figure reads the same year in people and per 1,000", async ({ page }) => {
  await ready(page);
  const germany = panelStrip(page, "change-composition", "Germany");
  await expect(germany).toContainText(AT_2023.germany.natural);
  await expect(germany).toContainText(AT_2023.germany.migration);
  await expect(germany).toContainText(AT_2023.germany.change);

  await segment(page, "unit-per-1000").click();
  await expect(panelStrip(page, "change-composition", "Germany")).toContainText(AT_2023.germany.naturalRate);
  await expect(panelStrip(page, "change-composition", "Germany")).toContainText(AT_2023.germany.migrationRate);
  // Population change is dropped in rate mode: the provider publishes no rate for it.
  await expect(panelStrip(page, "change-composition", "Germany")).not.toContainText("Population change");
});

test("a flow that stops says where, and a country outside the collection says so", async ({ page }) => {
  await ready(page);
  const britain = panel(page, "migration-flows", "United Kingdom");
  await expect(britain).toContainText(AT_2023.flows.britain);
  await expect(britain).toContainText(BRITAIN_FLOWS_END);

  const germany = panelStrip(page, "migration-flows", "Germany");
  await expect(germany).toContainText(AT_2023.flows.germanyIn);
  await expect(germany).toContainText(AT_2023.flows.germanyOut);

  await page.locator('select[data-control="add-country"]').selectOption(JAPAN.id);
  await expect(page.locator(`.figure-body[data-slot="migration-flows"][data-state=ready]`)).toBeVisible({ timeout: 30_000 });
  const japan = page.locator('figure[data-figure="migration-flows"] .flow-absence');
  await expect(japan).toBeVisible();
  await expect(japan).toContainText("No gross flows published");
  await expect(japan).toContainText(JAPAN.name);
  // Its natural change still draws: only the flow panel is absent.
  await expect(panelStrip(page, "change-composition", JAPAN.name)).toContainText(JAPAN.natural);
});

test("healthy life expectancy stops at its own last published year", async ({ page }) => {
  await ready(page);
  await expect(panel(page, "fertility-longevity", "Total fertility rate")).toContainText(AT_2023.france.fertility);
  await expect(panel(page, "fertility-longevity", "Life expectancy at birth")).toContainText(AT_2023.france.life);
  const healthy = panel(page, "fertility-longevity", "Healthy life expectancy");
  await expect(healthy).toContainText(AT_2023.healthy);
  await expect(healthy).toContainText("— to 2021");

  await selectYear(page, 2021);
  await expect(healthy).toContainText(AT_2021.franceHealthy);
  await expect(healthy).toContainText(AT_2021.germanyHealthy);
  await expect(healthy).toContainText(AT_2021.britainHealthy);
});

test("the age structure follows the year selected anywhere on the page", async ({ page }) => {
  await ready(page);
  const france = panel(page, "age-structure", "France");
  await expect(france.locator(".values")).toContainText(AT_2023.franceAge.total);
  await expect(france.locator(".values")).toContainText(AT_2023.franceAge.widest);
  await expect(france.locator(".broad-bands")).toContainText(AT_2023.franceAge.young);
  await expect(france.locator(".broad-bands")).toContainText(AT_2023.franceAge.working);
  await expect(france.locator(".broad-bands")).toContainText(AT_2023.franceAge.old);

  // Clicking a point on another figure moves this one too.
  const plot = page.locator('figure[data-figure="world-population-path"] svg').first();
  const box = await plot.boundingBox();
  await plot.click({ position: { x: box.width * 0.2, y: box.height * 0.4 } });
  await expect(page.locator('figure[data-figure="age-structure"] .values .yr').first()).not.toHaveText("2023");
});

test("the projection range is the 95% interval, and the peak is a mark", async ({ page }) => {
  await ready(page);
  await selectYear(page, 2050);
  await expect(strip(page, "world-population-path")).toContainText("95% interval");

  await segment(page, "scenario-medium").click();
  await expect(page.locator(`.figure-body[data-slot="world-population-path"][data-state=ready]`)).toBeVisible({ timeout: 30_000 });
  await expect(strip(page, "world-population-path")).not.toContainText("95% interval");

  await selectYear(page, Number(PEAK.year));
  await expect(strip(page, "world-population-path")).toContainText(PEAK.population);
  await expect(page.locator('figure[data-figure="world-population-path"] .plot-overlay')).toContainText(`peak · ${PEAK.year}`);
});

test("every figure carries an accessible data equivalent and its own provenance", async ({ page }) => {
  await ready(page);
  for (const id of FIGURES) {
    const figure = page.locator(`figure[data-figure="${id}"]`);
    await expect(figure.locator("details summary")).toHaveText("Provenance, query and data table");
    await expect(figure.locator(".figure-provenance")).toBeVisible();
    await figure.locator("details summary").click();
    await expect(figure.locator("table.accessible-data")).toBeVisible();
    await expect(figure.locator("table.accessible-data tbody tr").first()).toBeVisible();
  }
  // Every plot names itself to a screen reader.
  for (const id of FIGURES) {
    const images = page.locator(`figure[data-figure="${id}"] svg[role=img]`);
    expect(await images.count()).toBeGreaterThan(0);
    for (let index = 0; index < await images.count(); index += 1) {
      expect((await images.nth(index).getAttribute("aria-label")) ?? "").not.toEqual("");
    }
  }
});

test("a failing slot does not take its neighbours with it", async ({ page }) => {
  await page.goto(`${ROUTE}?scenario=slot-query`, { waitUntil: "networkidle" });
  const failed = page.locator('.figure-body[data-slot="age-structure"][data-state="query-error"]');
  await expect(failed).toBeVisible({ timeout: 45_000 });
  await expect(failed.locator("[data-report-status][role=alert]")).toBeVisible();
  await expect(failed.locator("button", { hasText: "Retry" })).toBeVisible();

  // Every other figure keeps its data: the failure is the slot's, not the report's.
  for (const id of FIGURES.filter((figure) => figure !== "age-structure")) {
    await expect(page.locator(`.figure-body[data-slot="${id}"][data-state=ready]`)).toBeVisible({ timeout: 45_000 });
  }
  await expect(page.locator('.report-content[data-state="query-error"]')).toHaveCount(0);
});

test("a whole-report data failure is reported once, with a retry", async ({ page }) => {
  await page.goto(`${ROUTE}?scenario=query`, { waitUntil: "networkidle" });
  const failed = page.locator('.report-content[data-state="query-error"], .figure-body[data-state="query-error"]').first();
  await expect(failed).toBeVisible({ timeout: 30_000 });
  await expect(failed.locator("[data-report-status][role=alert]")).toBeVisible();
  await expect(failed.locator("button", { hasText: "Retry" })).toBeVisible();
});

test("the report says where each family's data stops", async ({ page }) => {
  await ready(page);
  const header = page.locator(".wd-report header dl");
  await expect(header).toContainText("estimates to 2023");
  await expect(header).toContainText("Eurostat migration flows");
  await expect(header).toContainText("WHO healthy life expectancy");
  await expect(header).toContainText("to 2021");
});

// A viewport change always has a frame in which the old plots are still the
// old width, so the settled layout is what a reader sees and what these
// assertions are about. Waiting for every plot to fit is itself the check
// that the figures remeasured; a plot that never redrew never settles.
async function settled(page) {
  await page.waitForFunction(() => [...document.querySelectorAll(".report-visual svg")]
    .every((svg) => svg.getBoundingClientRect().width <= window.innerWidth + 1), null, { timeout: 30_000 });
}

// Text is wider on some hosts than on the machine a layout was written on,
// and a layout that fits only under one font's metrics breaks somewhere else.
// The report is loaded under a deliberately wider font as well as the default
// one, because that is what separated this repository's CI from its authors:
// a select sized to its widest option, and a caption holding a field on one
// line, both fitted here and overflowed there.
const WIDER_TEXT =
  "*{font-family:'DejaVu Sans',Verdana,sans-serif !important;letter-spacing:1.2px !important;}";

for (const [metrics, stylesheet] of [["the shipped font", null], ["a wider font", WIDER_TEXT]]) {
  test(`the layout reflows at a narrow width and at 400% zoom without losing a figure, in ${metrics}`, async ({ page }) => {
    // Applied before the first paint, the way a host's own fonts apply.
    if (stylesheet) await page.addInitScript((css) => {
      addEventListener("DOMContentLoaded", () => {
        const tag = document.createElement("style");
        tag.textContent = css;
        document.head.append(tag);
      });
    }, stylesheet);

    await page.setViewportSize({ width: 740, height: 420 });
    await ready(page);
    for (const id of FIGURES) {
      await expect(page.locator(`.figure-body[data-slot="${id}"][data-state=ready]`)).toBeVisible();
    }
    await settled(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    const wide = await page.evaluate(() =>
      Math.round(document.querySelector(".report-visual svg").getBoundingClientRect().width));

    await page.setViewportSize({ width: 320, height: 512 });
    await expect(page.locator(".report-content[data-state=ready]")).toBeVisible();
    for (const id of FIGURES) {
      await expect(page.locator(`.figure-body[data-slot="${id}"]`)).toBeVisible();
    }
    await settled(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    // The plots were redrawn for the narrower viewport rather than merely
    // clipped by their frame: a figure kept at its old width would leave the
    // reader scrolling inside every figure on a phone.
    const narrow = await page.evaluate(() =>
      Math.round(document.querySelector(".report-visual svg").getBoundingClientRect().width));
    expect(narrow).toBeLessThan(wide);
    expect(narrow).toBeLessThanOrEqual(320);
  });
}

test("changing the year never puts a loading message over a drawn figure", async ({ page }) => {
  await ready(page);

  // Watch the whole report for a status node appearing inside a slot that is
  // already showing a figure: that is what pushes the page down and pulls it
  // back up a moment later.
  await page.evaluate(() => {
    window.__intrusions = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const added of record.addedNodes) {
          if (added.nodeType !== 1 || !added.matches?.("[data-report-status]")) continue;
          const slot = added.closest("[data-slot]");
          if (slot) window.__intrusions.push(`${slot.dataset.slot}: ${added.textContent.trim()}`);
        }
      }
    });
    observer.observe(document.querySelector(".report-content"), { childList: true, subtree: true });
  });

  const heights = () => page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll("[data-slot]")].map((slot) =>
      [slot.dataset.slot, Math.round(slot.getBoundingClientRect().height)])));
  const before = await heights();

  for (const year of [2000, 1975, 2050, 2023]) {
    await selectYear(page, year);
  }
  await expect(page.locator('.figure-body[data-slot="age-structure"][data-state=ready]')).toBeVisible();

  expect(await page.evaluate(() => window.__intrusions)).toEqual([]);
  // Every figure keeps its height across the year changes, so nothing reflows.
  expect(await heights()).toEqual(before);
});

test("an open disclosure and the selected year survive a refresh of another figure", async ({ page }) => {
  await ready(page);
  const disclosure = page.locator('figure[data-figure="fertility-longevity"] details').first();
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveAttribute("open", "");
  await selectYear(page, 2000);
  await expect(page.locator('figure[data-figure="age-structure"] .values .yr').first()).toHaveText("2000");
  await expect(page.locator('figure[data-figure="fertility-longevity"] details').first()).toHaveAttribute("open", "");
});
