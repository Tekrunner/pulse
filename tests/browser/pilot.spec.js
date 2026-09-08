import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:3101";

test("nested report directly loads local DuckDB assets and published INSEE rows", async ({
  page,
}) => {
  const external = [];
  const localAssets = new Set();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) external.push(url.href);
  });
  page.on("response", (response) => {
    for (const asset of [
      "duckdb-browser-eh.worker.js",
      "duckdb-eh.wasm",
      "parquet.duckdb_extension.wasm",
      "browser-data.json",
      "dataset.parquet",
    ]) {
      if (response.url().endsWith(asset) && response.ok())
        localAssets.add(asset);
    }
  });
  let workerCount = 0;
  page.on("worker", () => {
    workerCount += 1;
  });
  await page.goto("reports/report", { waitUntil: "networkidle" });
  await expect(page.locator("[data-state=ready]")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator(".accessible-data tbody tr")).toHaveCount(367);
  expect(external).toEqual([]);
  expect([...localAssets].sort()).toEqual([
    "browser-data.json",
    "dataset.parquet",
    "duckdb-browser-eh.worker.js",
    "duckdb-eh.wasm",
    "parquet.duckdb_extension.wasm",
  ]);
  expect(workerCount).toBe(1);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-state=ready]")).toBeVisible({
    timeout: 10_000,
  });
});

test("pilot navigation resolves the nested route and owns one worker per page session", async ({
  page,
}) => {
  await page.goto("");
  await page
    .getByRole("link", { name: "Open the French macroeconomic pilot" })
    .click();
  await expect(page).toHaveURL(/\/pulse\/reports\/report$/);
  await expect(page.locator("[data-state=ready]")).toBeVisible({
    timeout: 10_000,
  });
  expect(page.workers()).toHaveLength(1);
  await page.goBack();
  expect(page.workers()).toHaveLength(0);
  await page
    .getByRole("link", { name: "Open the French macroeconomic pilot" })
    .click();
  await expect(page.locator("[data-state=ready]")).toBeVisible({
    timeout: 10_000,
  });
  expect(page.workers()).toHaveLength(1);
});

for (const [scenario, state] of [
  ["loading", "loading"],
  ["empty", "empty"],
  ["startup", "startup-error"],
  ["query", "query-error"],
  ["schema", "schema-error"],
  ["render", "render-error"],
]) {
  test(`shows the ${state} state safely`, async ({ page }) => {
    await page.goto(`reports/report?scenario=${scenario}`);
    await expect(page.locator(`[data-state="${state}"]`)).toBeVisible(
      scenario === "render" ? { timeout: 10_000 } : undefined,
    );
    await expect(page.locator(".visual-slot")).not.toContainText(
      /stack|password|token|\/home\//i,
    );
  });
}

test("interactive visual is keyboard-operable and remains readable when narrow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto("reports/report");
  await expect(page.locator("[data-state=ready]")).toBeVisible({
    timeout: 10_000,
  });
  const slider = page.getByRole("slider", { name: "Selected observation" });
  await slider.focus();
  const before = await page.locator("output").textContent();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("output")).not.toHaveText(before);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await slider.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).transitionDuration),
    ),
  ).toBeLessThanOrEqual(0.000001);
});

test("unchanged client and visual modules execute in the Vite harness", async ({
  page,
}) => {
  await page.goto(`${origin}/vite/`);
  await expect(page.locator("[data-portable-ready]")).toHaveText(
    "2024-Q4: 104.4 index points",
  );
  await expect(page.locator("svg[role=img]")).toBeVisible();
});

test("cold-cache performance stays within the recorded budget", async ({
  browser,
}) => {
  const measurements = [];
  for (let run = 0; run < 3; run += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${origin}/pulse/reports/report`);
    await expect(page.locator("[data-state=ready]")).toBeVisible({
      timeout: 10_000,
    });
    measurements.push(
      await page.evaluate(() => ({
        coldLoadMs: performance.getEntriesByType("navigation")[0].duration,
        firstReadableMs: performance.getEntriesByName(
          "pulse:first-readable-visual",
        )[0].startTime,
      })),
    );
    await context.close();
  }
  console.log(`PULSE_PERFORMANCE ${JSON.stringify(measurements)}`);
  expect(
    Math.max(...measurements.map((item) => item.coldLoadMs)),
  ).toBeLessThanOrEqual(5000);
  expect(
    Math.max(...measurements.map((item) => item.firstReadableMs)),
  ).toBeLessThanOrEqual(10_000);
});

test("complete French consumer-price report renders four real-data figures", async ({
  page,
}) => {
  await page.goto("reports/french-consumer-prices", {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator(".cpi-report figure")).toHaveCount(4);
  await expect(page.locator(".cpi-report")).not.toContainText(
    /representative|reconstruct/i,
  );
  await expect(
    page.getByRole("heading", { name: /What is carrying the annual rate/ }),
  ).toBeVisible();
  await expect(page.locator(".calculator-result strong")).toContainText("€");
});

test("report exploration keeps period-keyed selection and accessible equivalents", async ({
  page,
}) => {
  await page.goto("reports/french-consumer-prices");
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({
    timeout: 10_000,
  });
  const slider = page.getByRole("slider", { name: "Observation month" });
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  const selected = await page
    .locator(".observation-control output")
    .textContent();
  await page.locator('.period-field label', { hasText: '2 years' }).click();
  await expect(page.locator(".report-content[data-state=ready]")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator(".observation-control output")).toContainText(
    selected.slice(0, 7),
  );
  await page
    .locator(".cpi-report figure")
    .first()
    .getByText("Provenance, query and data table")
    .click();
  await expect(
    page.locator(".cpi-report figure").first().locator("caption"),
  ).toBeVisible();
});

for (const [scenario, state] of [
  [null, "ready"],
  ["loading", "loading"],
  ["empty", "empty"],
  ["query", "query-error"],
]) {
  test(`complete report explicitly renders the ${state} report state`, async ({
    page,
  }) => {
    const suffix = scenario ? `?scenario=${scenario}` : "";
    await page.goto(`reports/french-consumer-prices${suffix}`);
    await expect(
      page.locator(`.report-content[data-state="${state}"]`),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("navigation", { name: "Report navigation" }),
    ).toBeVisible();
    if (state === "loading") {
      await expect(page.locator(".report-content")).toHaveAttribute(
        "aria-busy",
        "true",
      );
      await expect(page.locator(".state-skeleton")).toHaveCount(3);
    }
    if (state === "empty")
      await expect(
        page.getByRole("button", { name: "Show the last five years" }),
      ).toBeVisible();
    if (state === "query-error") {
      await expect(page.locator(".report-content")).toContainText(
        "query_failed · insee_cpi_monthly + insee_cpi_category_analysis",
      );
      await expect(
        page.getByRole("button", { name: "Retry the query" }),
      ).toBeVisible();
    }
  });
}

test("complete report isolates a schema contract failure and retains its table", async ({
  page,
}) => {
  await page.goto("reports/french-consumer-prices?scenario=schema");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible(
    { timeout: 10_000 },
  );
  const failed = page.locator('figure[data-state="schema-error"]');
  await expect(failed).toHaveCount(1);
  await expect(failed.getByRole("alert")).toContainText(
    "Visual contract failure · contribution-stack@1.0.0 · row 0 · services_pp: expected number",
  );
  await expect(failed.locator("table.accessible-data")).toHaveCount(1);
  await expect(page.locator('figure[data-state="ready"]')).toHaveCount(3);
  await expect(
    page.getByRole("navigation", { name: "Report navigation" }),
  ).toBeVisible();
});

test("complete report isolates a render failure and retains its table", async ({
  page,
}) => {
  await page.goto("reports/french-consumer-prices?scenario=render");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible(
    { timeout: 10_000 },
  );
  const failed = page.locator('figure[data-state="render-error"]');
  await expect(failed).toHaveCount(1);
  await expect(failed.getByRole("alert")).toContainText(
    "keeps the accessible table",
  );
  await expect(failed.locator("table.accessible-data")).toHaveCount(1);
  await expect(page.locator('figure[data-state="ready"]')).toHaveCount(3);
  await expect(
    page.getByRole("navigation", { name: "Report navigation" }),
  ).toBeVisible();
});

test("complete report retains context and period-keyed selection after a later query failure", async ({
  page,
}) => {
  await page.goto("reports/french-consumer-prices?scenario=query-after-ready");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible(
    { timeout: 10_000 },
  );
  const slider = page.getByRole("slider", { name: "Observation month" });
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  const selected = (
    await page.locator(".observation-control output").textContent()
  ).slice(0, 7);
  await page.locator('.period-field label', { hasText: '2 years' }).click();
  await expect(
    page.locator('.report-content[data-state="query-error"]'),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".report-content")).toContainText(
    `Selection ${selected} retained`,
  );
  await expect(page.locator(".report-content")).toContainText(
    "Last successful month:",
  );
  await expect(
    page.getByRole("navigation", { name: "Report navigation" }),
  ).toBeVisible();
});

test("French CPI report preserves exact pinned July 2026 decimals and negative values", async ({
  page,
}) => {
  await page.goto("reports/french-consumer-prices");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible(
    { timeout: 10_000 },
  );
  await expect(
    page.getByRole("heading", { name: "Consumer prices in France" }),
  ).toBeVisible();
  await expect(
    page.getByText("Standing report · France · monthly"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Where prices stand" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.load("15px Inter"));
  expect(await page.evaluate(() => document.fonts.check("15px Inter"))).toBe(true);
  expect(
    await page.locator(".cpi-report").evaluate((node) => getComputedStyle(node).fontFamily),
  ).toContain("Inter");

  await page
    .locator('figure[data-figure="1"] .segments label', { hasText: "Services" })
    .click();
  await expect(
    page.locator('figure[data-figure="1"] .selected-readout').first(),
  ).toHaveText("+2.2% y/y");
  await expect(
    page.locator('figure[data-figure="2"] .contribution-callout'),
  ).toContainText("Services+1.1 pp");
  await expect(
    page.locator('figure[data-figure="2"] .contribution-callout'),
  ).toContainText("Energy+1.0 pp");
  await expect(
    page.locator('figure[data-figure="3"] [data-category="services"]'),
  ).toContainText("Basket share 52.0% in Jul 2026 (2026 weights)");
  expect(
    new Set(
      await page
        .locator('figure[data-figure="4"] .index-chip')
        .allTextContents(),
    ),
  ).toEqual(
    new Set([
      "Headline 102.67",
      "Food 101.29",
      "Services 103.97",
      "Manufactured 97.72",
      "Energy 111.75",
      "Rents 101.60",
    ]),
  );

  await page
    .locator('figure[data-figure="1"] .segments label', {
      hasText: "Manufactured products",
    })
    .click();
  await expect(
    page.locator('figure[data-figure="1"] .selected-readout').first(),
  ).toHaveText("−0.7% y/y");
});

async function clickPlotAt(page, locator, fraction, padLeft, padRight) {
  await locator.scrollIntoViewIfNeeded();
  // Position the hit below the sticky controls; dispatching to a covered SVG
  // would test the controls instead of the user's chart interaction.
  await locator.evaluate((svg) => {
    const box = svg.getBoundingClientRect();
    window.scrollBy(0, box.top + box.height / 2 - innerHeight * 0.7);
  });
  const geometry = await locator.evaluate((svg) => ({
    viewBoxWidth: svg.viewBox.baseVal.width,
    viewBoxHeight: svg.viewBox.baseVal.height,
  }));
  const box = await locator.boundingBox();
  const inner = geometry.viewBoxWidth - padLeft - padRight;
  const x =
    box.x + ((padLeft + inner * fraction) / geometry.viewBoxWidth) * box.width;
  const beforeScroll = await page.evaluate(() => window.scrollY);
  await page.mouse.click(
    x,
    box.y + Math.min(box.height / 2, geometry.viewBoxHeight / 2),
  );
  return beforeScroll;
}

test("every report plot maps left, middle and right clicks through its own margins", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("reports/french-consumer-prices");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible(
    { timeout: 10_000 },
  );
  const expected = [
    [0, "2021-08"],
    [29 / 59, "2024-01"],
    [30 / 59, "2024-02"],
    [1, "2026-07"],
  ];
  const selectors = [
    ['figure[data-figure="1"] svg[data-plot-pad-left]', 44, 14],
    ['figure[data-figure="2"] svg[data-plot-pad-left]', 44, 14],
    [
      'figure[data-figure="3"] [data-category="services"] > .report-visual:not(.weight-staircase) > svg[data-plot-pad-left]',
      34,
      22,
    ],
    [
      'figure[data-figure="3"] [data-category="services"] .weight-staircase svg[data-plot-pad-left]',
      34,
      22,
    ],
    ['figure[data-figure="4"] svg[data-plot-pad-left]', 44, 14],
  ];
  for (const [selector, padLeft, padRight] of selectors) {
    for (const [fraction, period] of expected) {
      const plot = page.locator(selector);
      const beforeScroll = await clickPlotAt(page, plot, fraction, padLeft, padRight);
      await expect(page.locator(".observation-control output")).toContainText(
        period,
      );
      await page.waitForTimeout(650);
      const afterScroll = await page.evaluate(() => window.scrollY);
      expect(Math.abs(afterScroll - beforeScroll)).toBeLessThanOrEqual(1);
    }
  }
});

test("figure selection retains open disclosures and slider focus", async ({
  page,
}) => {
  await page.goto("reports/french-consumer-prices");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible(
    { timeout: 10_000 },
  );
  const disclosure = page.locator('figure[data-figure="2"] details');
  await disclosure.locator("summary").click();
  const plot = page.locator('figure[data-figure="2"] svg[data-plot-pad-left]');
  await clickPlotAt(page, plot, 0.25, 44, 14);
  await expect(page.locator('figure[data-figure="2"] details')).toHaveAttribute(
    "open",
    "",
  );
  await expect(
    page.locator('figure:not([data-figure="2"]) details[open]'),
  ).toHaveCount(0);
  const slider = page.getByRole("slider", { name: "Observation month" });
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toBeFocused();
});

test("all report controls preserve the viewport and keyboard focus", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("reports/french-consumer-prices");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible({ timeout: 10000 });
  await page.locator('figure[data-figure="2"]').scrollIntoViewIfNeeded();
  const actions = [
    ["component-services", (control) => control.uncheck()],
    ["component-services", (control) => control.check()],
    ["period-two-years", (control) => control.locator('..').click()],
    ["period-five-years", (control) => control.locator('..').click()],
    ["Start-month", (control) => control.selectOption("09")],
    ["Start-year", (control) => control.selectOption("2022")],
    ["End-month", (control) => control.selectOption("06")],
    ["End-year", (control) => control.selectOption("2025")],
    ["lead-services", (control) => control.locator('..').click()],
    ["lead-headline", (control) => control.locator('..').click()],
    ["calculator-amount", (control) => control.fill("125")],
    ["In this month-month", (control) => control.selectOption("06")],
    ["In this month-year", (control) => control.selectOption("2024")],
    ["Expressed in this month’s euros-month", (control) => control.selectOption("05")],
    ["Expressed in this month’s euros-year", (control) => control.selectOption("2025")],
    ["calculator-swap", (control) => control.click()],
  ];
  for (const [key, action] of actions) {
    const control = page.locator(`[data-control="${key}"]`);
    const target = await control.getAttribute('type') === 'radio' ? control.locator('..') : control;
    await target.scrollIntoViewIfNeeded();
    await control.focus();
    const before = await page.evaluate(() => window.scrollY);
    await action(control);
    await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible();
    await page.waitForTimeout(650);
    expect(Math.abs(await page.evaluate(() => window.scrollY) - before), key).toBeLessThanOrEqual(1);
    await expect(control, key).toBeFocused();
  }
  const amount = page.locator('[data-control="calculator-amount"]');
  await amount.focus();
  await amount.press("End");
  await page.keyboard.type(".50");
  await expect(amount).toHaveValue("125.50");
});

test("calculator uses full headline history and component controls stay interactive", async ({
  page,
}) => {
  await page.goto("reports/french-consumer-prices");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible(
    { timeout: 10_000 },
  );
  await expect(page.locator(".calculator-result strong")).toHaveText("€102.10");
  await expect(page.locator(".calculator")).toContainText(
    "€100.00 in Jul 2025 has the same purchasing power as €102.10 in Jul 2026, on index levels of 100.56 and 102.67 (Base 2025 = 100).",
  );
  await expect(page.locator(".calculator-result small")).toHaveText(
    "+2.1% over 12 months · +2.1% a year",
  );
  await page
    .getByRole("button", { name: "Swap the origin and target months" })
    .click();
  await expect(page.locator(".calculator-result strong")).toHaveText("€97.94");

  await page.getByLabel("Services", { exact: true }).first().uncheck();
  await expect(
    page.locator('figure[data-figure="3"] [data-category="services"]'),
  ).toHaveCount(0);
  for (const name of ["Food", "Manufactured products", "Energy", "Rents paid"])
    await page.getByLabel(name, { exact: true }).first().uncheck();
  await expect(page.locator('figure[data-figure="3"]')).toContainText(
    "No components selected; headline remains available in the other figures.",
  );
  await expect(page.locator('figure[data-figure="4"] .index-chip')).toHaveCount(
    1,
  );
  await expect(
    page.locator('figure[data-figure="4"] .index-chip'),
  ).toContainText("Headline 102.67");
});

test("loaded report remeasures charts when resized without page overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("reports/french-consumer-prices");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.locator('figure[data-figure="1"] .chart-wrapper').evaluate((wrapper) => {
      const svg = wrapper.querySelector('svg');
      return Math.abs(Number(svg?.getAttribute('width')) - Math.max(320, Math.round(wrapper.getBoundingClientRect().width)));
    })).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('figure[data-state="ready"]')).toHaveCount(4);
    await page.screenshot({ path: testInfo.outputPath(`report-${width}.png`), fullPage: true });
  }
});

test("desktop exploration controls keep period, observation and component controls together", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("reports/french-consumer-prices");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible(
    { timeout: 10_000 },
  );
  const layout = await page.locator(".exploration").evaluate((controls) => {
    const period = controls
      .querySelector(".period-field")
      .getBoundingClientRect();
    const observation = controls
      .querySelector(".observation-control")
      .getBoundingClientRect();
    const components = controls
      .querySelector(".component-field")
      .getBoundingClientRect();
    return {
      children: controls.children.length,
      periodTop: period.top,
      observationTop: observation.top,
      componentsTop: components.top,
      observationWidth: observation.width,
    };
  });
  expect(layout.children).toBe(3);
  expect(layout.observationWidth).toBeGreaterThanOrEqual(220);
  expect(Math.abs(layout.periodTop - layout.observationTop)).toBeLessThan(140);
  expect(Math.abs(layout.componentsTop - layout.observationTop)).toBeLessThan(
    140,
  );
});
