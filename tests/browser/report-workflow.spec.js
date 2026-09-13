import { expect, test } from "@playwright/test";

test("report slot-local render failure preserves sibling visuals and navigation", async ({ page }) => {
  await page.goto("reports/french-consumer-prices?scenario=render");
  await expect(page.locator('figure[data-state="render-error"]')).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator('figure[data-state="ready"]')).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
  await expect(page.locator("details").first()).toBeEnabled();
});

test("report query failure after ready retains controls and interaction context", async ({ page }) => {
  await page.goto("reports/french-consumer-prices?scenario=query-after-ready");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  const control = page.locator("select").first();
  await control.focus();
  const value = await control.inputValue();
  await page.locator("select").nth(1).evaluate((element) => {
    element.selectedIndex = element.selectedIndex === 0 ? 1 : 0;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator('[data-state="query-error"]')).toBeVisible();
  await expect(control).toHaveValue(value);
  await expect(control).toBeFocused();
});

test("report remains usable in narrow landscape and at 400 percent reflow", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("reports/french-consumer-prices");
  await expect(page.locator('.report-content[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('figure[data-state="ready"]')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator("figure details table").first()).toBeAttached();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.body.style.zoom = "400%"; });
  await expect(page.getByRole("heading", { name: "Consumer prices in France" })).toBeVisible();
  await expect(page.locator('figure[data-figure="1"] details table')).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [scenario, selector] of [
  ["loading", '.report-content[data-state="loading"]'],
  ["empty", '.report-content[data-state="empty"]'],
  ["query", '.report-content[data-state="query-error"]'],
  ["schema", 'figure[data-state="schema-error"]'],
  ["render", 'figure[data-state="render-error"]'],
  ["status-suspect", "[data-qualification]"],
  ["status-stale", "[data-qualification]"],
]) {
  test(`report workflow exposes the accessible ${scenario} state`, async ({ page }) => {
    await page.goto(`reports/french-consumer-prices?scenario=${scenario}`);
    const state = page.locator(selector).first();
    await expect(state).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
  });
}
