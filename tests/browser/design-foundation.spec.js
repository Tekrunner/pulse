import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:3101";
const states = ["ready", "loading", "empty", "suspect", "stale", "query-error", "schema-error", "render-error", "engine-error"];

test.describe("design foundation", () => {
  test("normal visual has contrast, provenance, keyboard selection, focus, reflow, motion, and idempotent cleanup", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/vite/?design-foundation`);
    const visual = page.locator(".pulse-visual-template");
    await expect(page.getByRole("heading", { name: "Foundation indicator" })).toBeVisible();
    await expect(page.getByText("Source: Synthetic source")).toBeVisible();
    await expect(page.getByRole("table", { name: "Accessible data" })).toBeVisible();
    const first = page.getByRole("button", { name: "First: 12" });
    const second = page.getByRole("button", { name: "Second: 18" });
    await first.focus(); await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Selected: Second, 18")).toBeVisible();
    await expect(second).toBeFocused();
    expect(await visual.evaluate((node) => {
      const luminance = (value) => value.match(/\d+/g).map(Number).slice(0, 3).map((channel) => { const s = channel / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0);
      const [light, dark] = [luminance(getComputedStyle(node).color), luminance(getComputedStyle(node).backgroundColor)].sort((a, b) => b - a);
      return (light + .05) / (dark + .05);
    })).toBeGreaterThanOrEqual(4.5);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(visual).toBeVisible();
    await page.evaluate(() => { document.body.style.zoom = "200%"; });
    await expect(page.getByRole("table", { name: "Accessible data" })).toBeVisible();
    await page.setViewportSize({ width: 480, height: 320 });
    await expect(second).toBeVisible();
    expect(await visual.evaluate((node) => Number.parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThanOrEqual(.001);
    expect(await page.evaluate(() => { let calls = 0; const visual = window.renderDesignFoundationVisual({ onCleanup: () => { calls += 1; } }); visual.cleanup(); visual.cleanup(); return calls; })).toBe(1);
  });

  for (const state of states) test(`state ${state} has a named non-colour cue, provenance, and data equivalent`, async ({ page }) => {
    await page.goto(`${origin}/vite/?design-foundation`);
    await page.evaluate((state) => {
      document.querySelector(".pulse-visual-template")?.remove();
      const rows = state === "ready" || state === "suspect" || state === "stale" ? [{ label: "Known", value: 1 }] : [];
      document.querySelector("#app").append(window.renderDesignFoundationVisual({ rows, state, provenance: { label: "Synthetic source" } }));
    }, state);
    const visual = page.locator(`.pulse-visual-template[data-state="${state}"]`);
    await expect(visual).toBeVisible();
    await expect(visual.getByText("Source: Synthetic source")).toBeVisible();
    await expect(visual.getByRole("table", { name: "Accessible data" })).toBeVisible();
    if (state !== "ready") await expect(visual.getByRole("status")).toContainText(/◆/);
  });
});
