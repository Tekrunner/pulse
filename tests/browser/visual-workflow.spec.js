import { expect, test } from "@playwright/test";

test("INSEE conformance records desktop, narrow, and 400% reflow evidence", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("reports/french-consumer-prices");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: testInfo.outputPath("insee-desktop-ready.png"), fullPage: true });

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('figure[data-state="ready"]')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("insee-narrow-landscape-ready.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.body.style.zoom = "400%"; });
  await expect(page.getByRole("heading", { name: "Consumer prices in France" })).toBeVisible();
  await expect(page.locator('figure[data-figure="1"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("insee-400-percent-reflow.png") });
});

for (const [scenario, selector] of [
  ["loading", '.report-content[data-state="loading"]'],
  ["empty", '.report-content[data-state="empty"]'],
  ["query", '.report-content[data-state="query-error"]'],
  ["schema", 'figure[data-state="schema-error"]'],
  ["render", 'figure[data-state="render-error"]'],
  ["status-suspect", '[data-qualification]'],
  ["status-stale", '[data-qualification]'],
]) {
  test(`INSEE conformance records the ${scenario} rendered state`, async ({
    page,
  }, testInfo) => {
    await page.goto(`reports/french-consumer-prices?scenario=${scenario}`);
    await expect(page.locator(selector).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: testInfo.outputPath(`insee-${scenario}.png`), fullPage: true });
  });
}
