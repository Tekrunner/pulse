import { expect, test } from "@playwright/test";
import { publishedRows } from "./published-data.mjs";

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
 * Every expectation below is read from the served Parquet and formatted the way
 * the shipped formatters print it, never restated as a literal: a new UN, Eurostat
 * or WHO release moves these values, and the gate in front of deployment must
 * move with them. The default observation year is the provider's last
 * estimated year, which is itself read from the data.
 */
const people = (thousands, { signed = false } = {}) => {
  if (thousands === null || thousands === undefined) return "—";
  const sign = thousands < 0 ? "−" : signed && thousands > 0 ? "+" : "";
  const size = Math.abs(thousands);
  if (size >= 1000000) return `${sign}${(size / 1000000).toFixed(2)}bn`;
  if (size >= 1000) return `${sign}${(size / 1000).toFixed(size >= 10000 ? 1 : 2)}M`;
  return `${sign}${Math.round(size * 10) / 10}k`;
};
const signedFixed = (value, digits, suffix) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}${suffix}`;
const year = (period) => period.slice(0, 4);

const INDICATORS = "world-demography-indicators";
const [BOUNDARY] = publishedRows(
  [INDICATORS],
  `SELECT max(period) AS period FROM "${INDICATORS}"
    WHERE location_kind = 'world' AND series_kind = 'estimate'`,
).map((row) => row.period);
const [WORLD] = publishedRows(
  [INDICATORS],
  `SELECT population_thousands, population_growth_rate_pct FROM "${INDICATORS}"
    WHERE location_kind = 'world' AND period = DATE '${BOUNDARY}'`,
);
const [PEAK] = publishedRows(
  [INDICATORS],
  `SELECT period, population_thousands FROM "${INDICATORS}"
    WHERE location_kind = 'world' ORDER BY population_thousands DESC LIMIT 1`,
);
// France, Germany and the United Kingdom are the report's default countries.
// Japan is added because Eurostat publishes no gross flows for it, which is a
// fact about the provider's coverage rather than about any one release.
const countries = Object.fromEntries(
  publishedRows(
    [INDICATORS],
    `SELECT * FROM "${INDICATORS}" WHERE period = DATE '${BOUNDARY}'
       AND iso3_code IN ('FRA', 'DEU', 'GBR', 'JPN')`,
  ).map((row) => [row.iso3_code, row]),
);
const flowsAt = (dataset, column, iso3) =>
  publishedRows(
    [dataset],
    `SELECT max(period) AS latest,
            max(CASE WHEN period = DATE '${BOUNDARY}' THEN ${column} END) AS value
       FROM "${dataset}" WHERE iso3_code = '${iso3}'`,
  )[0];
const flow = ({ value }) => (value === null ? "not published" : people(value / 1000));
const HEALTHY = Object.fromEntries(
  publishedRows(
    ["healthy-life-expectancy"],
    `SELECT iso3_code, max(period) AS latest, arg_max(healthy_life_expectancy_years, period) AS value,
            max(CASE WHEN period = DATE '${BOUNDARY}' THEN healthy_life_expectancy_years END) AS at_boundary
       FROM "healthy-life-expectancy" WHERE sex = 'total' AND iso3_code IN ('FRA', 'DEU', 'GBR')
      GROUP BY iso3_code`,
  ).map((row) => [row.iso3_code, row]),
);
const FRANCE_AGE = publishedRows(
  ["world-demography-age-structure"],
  `SELECT age_grouping, age_start, population_male_thousands AS male,
          population_female_thousands AS female, population_total_thousands AS total,
          share_of_population_pct AS share
     FROM "world-demography-age-structure"
    WHERE iso3_code = 'FRA' AND period = DATE '${BOUNDARY}' ORDER BY age_grouping, age_start`,
);
const edgeOf = (dataset) =>
  year(publishedRows([dataset], `SELECT max(period) AS period FROM "${dataset}"`)[0].period);

const AT_BOUNDARY = {
  year: year(BOUNDARY),
  world: {
    population: people(WORLD.population_thousands),
    rate: `${signedFixed(WORLD.population_growth_rate_pct, 2, "%")} a year`,
  },
  france: {
    population: people(countries.FRA.population_thousands),
    fertility: countries.FRA.total_fertility_rate.toFixed(2),
    life: countries.FRA.life_expectancy_years.toFixed(1),
  },
  germany: {
    population: people(countries.DEU.population_thousands),
    natural: people(countries.DEU.natural_change_thousands, { signed: true }),
    migration: people(countries.DEU.net_migration_thousands, { signed: true }),
    change: people(countries.DEU.population_change_thousands, { signed: true }),
    naturalRate: signedFixed(countries.DEU.natural_change_rate_per_1000, 1, "‰"),
    migrationRate: signedFixed(countries.DEU.net_migration_rate_per_1000, 1, "‰"),
  },
  britain: { population: people(countries.GBR.population_thousands) },
  flows: {
    germanyIn: flow(flowsAt("european-immigration-flows", "immigration_persons", "DEU")),
    germanyOut: flow(flowsAt("european-emigration-flows", "emigration_persons", "DEU")),
    britain: flowsAt("european-immigration-flows", "immigration_persons", "GBR"),
  },
  franceAge: (() => {
    const fiveYear = FRANCE_AGE.filter((band) => band.age_grouping === "five-year");
    const broad = FRANCE_AGE.filter((band) => band.age_grouping === "broad");
    return {
      total: people(fiveYear.reduce((sum, band) => sum + band.total, 0)),
      widest: people(fiveYear.reduce((largest, band) => Math.max(largest, band.male, band.female), 1)),
      broad: broad.map((band) => `${band.share.toFixed(1)}%`),
    };
  })(),
};
const JAPAN = {
  id: String(countries.JPN.location_id),
  name: countries.JPN.location_name,
  natural: people(countries.JPN.natural_change_thousands, { signed: true }),
};

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
  await expect(strip(page, "world-population-path")).toContainText(AT_BOUNDARY.world.population);
  await expect(strip(page, "world-population-path")).toContainText(AT_BOUNDARY.world.rate);
  await expect(strip(page, "world-population-path").locator(".yr")).toHaveText(AT_BOUNDARY.year);

  const countries = strip(page, "country-population-paths");
  await expect(countries).toContainText(AT_BOUNDARY.france.population);
  await expect(countries).toContainText(AT_BOUNDARY.germany.population);
  await expect(countries).toContainText(AT_BOUNDARY.britain.population);

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
  await expect(germany).toContainText(AT_BOUNDARY.germany.natural);
  await expect(germany).toContainText(AT_BOUNDARY.germany.migration);
  await expect(germany).toContainText(AT_BOUNDARY.germany.change);

  await segment(page, "unit-per-1000").click();
  await expect(panelStrip(page, "change-composition", "Germany")).toContainText(AT_BOUNDARY.germany.naturalRate);
  await expect(panelStrip(page, "change-composition", "Germany")).toContainText(AT_BOUNDARY.germany.migrationRate);
  // Population change is dropped in rate mode: the provider publishes no rate for it.
  await expect(panelStrip(page, "change-composition", "Germany")).not.toContainText("Population change");
});

test("a flow that stops says where, and a country outside the collection says so", async ({ page }) => {
  await ready(page);
  // The United Kingdom left Eurostat's collection, so its flows stop; the panel
  // says where rather than drawing a value it does not have.
  const britain = panel(page, "migration-flows", "United Kingdom");
  const britainFlows = AT_BOUNDARY.flows.britain;
  await expect(britain).toContainText(flow(britainFlows));
  if (britainFlows.value === null) await expect(britain).toContainText(`to ${year(britainFlows.latest)}`);

  const germany = panelStrip(page, "migration-flows", "Germany");
  await expect(germany).toContainText(AT_BOUNDARY.flows.germanyIn);
  await expect(germany).toContainText(AT_BOUNDARY.flows.germanyOut);

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
  await expect(panel(page, "fertility-longevity", "Total fertility rate")).toContainText(AT_BOUNDARY.france.fertility);
  await expect(panel(page, "fertility-longevity", "Life expectancy at birth")).toContainText(AT_BOUNDARY.france.life);
  const healthy = panel(page, "fertility-longevity", "Healthy life expectancy");
  const france = HEALTHY.FRA;
  if (france.at_boundary === null) {
    await expect(healthy).toContainText("not published");
    await expect(healthy).toContainText(`— to ${year(france.latest)}`);
  } else {
    test.info().annotations.push({
      type: "data",
      description: "WHO publishes healthy life expectancy at the UN boundary year, so no series stops early",
    });
  }

  // At France's last WHO year every default country reads its own value.
  await selectYear(page, Number(year(france.latest)));
  for (const iso3 of ["FRA", "DEU", "GBR"])
    if (HEALTHY[iso3].latest === france.latest)
      await expect(healthy).toContainText(HEALTHY[iso3].value.toFixed(1));
});

test("the age structure follows the year selected anywhere on the page", async ({ page }) => {
  await ready(page);
  const france = panel(page, "age-structure", "France");
  await expect(france.locator(".values")).toContainText(AT_BOUNDARY.franceAge.total);
  await expect(france.locator(".values")).toContainText(AT_BOUNDARY.franceAge.widest);
  expect(AT_BOUNDARY.franceAge.broad.length).toBeGreaterThan(0);
  for (const share of AT_BOUNDARY.franceAge.broad)
    await expect(france.locator(".broad-bands")).toContainText(share);

  // Clicking a point on another figure moves this one too.
  const plot = page.locator('figure[data-figure="world-population-path"] svg').first();
  const box = await plot.boundingBox();
  await plot.click({ position: { x: box.width * 0.2, y: box.height * 0.4 } });
  await expect(page.locator('figure[data-figure="age-structure"] .values .yr').first()).not.toHaveText(AT_BOUNDARY.year);
});

test("the projection range is the 95% interval, and the peak is a mark", async ({ page }) => {
  await ready(page);
  await selectYear(page, 2050);
  await expect(strip(page, "world-population-path")).toContainText("95% interval");

  await segment(page, "scenario-medium").click();
  await expect(page.locator(`.figure-body[data-slot="world-population-path"][data-state=ready]`)).toBeVisible({ timeout: 30_000 });
  await expect(strip(page, "world-population-path")).not.toContainText("95% interval");

  await selectYear(page, Number(year(PEAK.period)));
  await expect(strip(page, "world-population-path")).toContainText(people(PEAK.population_thousands));
  await expect(page.locator('figure[data-figure="world-population-path"] .plot-overlay')).toContainText(`peak · ${year(PEAK.period)}`);
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
  await expect(header).toContainText(`estimates to ${AT_BOUNDARY.year}`);
  await expect(header).toContainText("Eurostat migration flows");
  await expect(header).toContainText(`to ${edgeOf("european-immigration-flows")}`);
  await expect(header).toContainText("WHO healthy life expectancy");
  await expect(header).toContainText(`to ${edgeOf("healthy-life-expectancy")}`);
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

    // A figure that fits the page but scrolls inside its own frame is what
    // the page-level assertion above cannot see, and it is what a phone
    // reader actually meets. The frames keep `overflow-x: auto` as a
    // backstop; nothing is supposed to reach it.
    expect(await page.evaluate(() => [...document.querySelectorAll(".figure-body, .multiple-panel")]
      .filter((frame) => frame.scrollWidth > frame.clientWidth + 1)
      .map((frame) => `${frame.dataset.slot ?? frame.querySelector(".multiple-title")?.textContent}: ${frame.scrollWidth} in ${frame.clientWidth}`)))
      .toEqual([]);

    // A visual draws its marks in the coordinate space of the width it was
    // given and puts the labels beside them in that same space, but only the
    // SVG rescales. Drawn at one width and rendered at another, every mark
    // slides away from its own label -- which is how the age bands ended up
    // over the men's bars.
    expect(await page.evaluate(() => [...document.querySelectorAll(".report-visual svg")]
      .map((svg) => ({ drawn: svg.viewBox.baseVal.width, rendered: svg.getBoundingClientRect().width }))
      .filter(({ drawn, rendered }) => Math.abs(drawn - rendered) > 1)
      .map(({ drawn, rendered }) => `drawn ${drawn}, rendered ${Math.round(rendered)}`)))
      .toEqual([]);
  });
}

// The year control is the one control a reader holds rather than clicks, and
// a drag survives only if the element under the pointer survives with it.
// Rebuilding the bar on every tick removed it, which Firefox on Android reads
// as the gesture ending: the slider could not be moved at all.
test("dragging the year never replaces the control being dragged", async ({ page }) => {
  await ready(page);
  const stable = await page.evaluate(async () => {
    const slider = document.querySelector('[data-control="observation-year"]');
    const before = slider;
    for (const year of [2020, 2010, 1999]) {
      slider.value = String(year);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resume) => setTimeout(resume, 60));
    }
    const after = document.querySelector('[data-control="observation-year"]');
    return { same: after === before, connected: before.isConnected, value: after.value, reading: document.querySelector(".observation-control output").textContent };
  });
  expect(stable).toEqual({ same: true, connected: true, value: "1999", reading: "1999" });
  await expect(page.locator('figure[data-figure="world-population-path"] .values .yr')).toHaveText("1999");
});

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

  for (const selected of [2000, 1975, 2050, Number(AT_BOUNDARY.year)]) {
    await selectYear(page, selected);
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
