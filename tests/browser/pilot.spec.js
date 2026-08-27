import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:3101";

test("nested report directly loads local DuckDB assets and fixture rows", async ({ page }) => {
  const external = [];
  const localAssets = new Set();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) external.push(url.href);
  });
  page.on("response", (response) => {
    for (const asset of ["duckdb-browser-eh.worker.js", "duckdb-eh.wasm", "parquet.duckdb_extension.wasm", "manifest.json", "macro.parquet"]) {
      if (response.url().endsWith(asset) && response.ok()) localAssets.add(asset);
    }
  });
  let workerCount = 0;
  page.on("worker", () => { workerCount += 1; });
  await page.goto("reports/report", { waitUntil: "networkidle" });
  await expect(page.locator("[data-state=ready]")).toBeVisible();
  await expect(page.locator(".accessible-data tbody tr")).toHaveCount(4);
  expect(external).toEqual([]);
  expect([...localAssets].sort()).toEqual(["duckdb-browser-eh.worker.js", "duckdb-eh.wasm", "macro.parquet", "manifest.json", "parquet.duckdb_extension.wasm"]);
  expect(workerCount).toBe(1);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-state=ready]")).toBeVisible();
});

test("pilot navigation resolves the nested route and owns one worker per page session", async ({ page }) => {
  await page.goto("");
  await page.getByRole("link", { name: "Open the French macroeconomic pilot" }).click();
  await expect(page).toHaveURL(/\/pulse\/reports\/report$/);
  await expect(page.locator("[data-state=ready]")).toBeVisible();
  expect(page.workers()).toHaveLength(1);
  await page.goBack();
  expect(page.workers()).toHaveLength(0);
  await page.getByRole("link", { name: "Open the French macroeconomic pilot" }).click();
  await expect(page.locator("[data-state=ready]")).toBeVisible();
  expect(page.workers()).toHaveLength(1);
});

for (const [scenario, state] of [["loading", "loading"], ["empty", "empty"], ["startup", "startup-error"], ["query", "query-error"], ["schema", "schema-error"], ["render", "render-error"]]) {
  test(`shows the ${state} state safely`, async ({ page }) => {
    await page.goto(`reports/report?scenario=${scenario}`);
    await expect(page.locator(`[data-state="${state}"]`)).toBeVisible();
    await expect(page.locator(".visual-slot")).not.toContainText(/stack|password|token|\/home\//i);
  });
}

test("interactive visual is keyboard-operable and remains readable when narrow", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto("reports/report");
  await expect(page.locator("[data-state=ready]")).toBeVisible();
  const slider = page.getByRole("slider", { name: "Selected observation" });
  await slider.focus();
  const before = await page.locator("output").textContent();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("output")).not.toHaveText(before);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await slider.evaluate((node) => Number.parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThanOrEqual(0.000001);
});

test("unchanged client and visual modules execute in the Vite harness", async ({ page }) => {
  await page.goto(`${origin}/vite/`);
  await expect(page.locator("[data-portable-ready]" )).toHaveText("2024-Q4: 104.4 index points");
  await expect(page.locator("svg[role=img]")).toBeVisible();
});

test("cold-cache performance stays within the recorded budget", async ({ browser }) => {
  const measurements = [];
  for (let run = 0; run < 3; run += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${origin}/pulse/reports/report`);
    await expect(page.locator("[data-state=ready]")).toBeVisible();
    measurements.push(await page.evaluate(() => ({
      coldLoadMs: performance.getEntriesByType("navigation")[0].duration,
      firstReadableMs: performance.getEntriesByName("pulse:first-readable-visual")[0].startTime,
    })));
    await context.close();
  }
  console.log(`PULSE_PERFORMANCE ${JSON.stringify(measurements)}`);
  expect(Math.max(...measurements.map((item) => item.coldLoadMs))).toBeLessThanOrEqual(5000);
  expect(Math.max(...measurements.map((item) => item.firstReadableMs))).toBeLessThanOrEqual(3000);
});
