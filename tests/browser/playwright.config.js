import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  fullyParallel: false,
  // The suites are isolated by browser context and only read the built artifacts.
  // Two workers keep Chromium and Firefox busy without overwhelming the two-core
  // GitHub runner or making the cold-cache performance check compete with a large
  // browser pool.
  workers: 2,
  reporter: "line",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  use: { baseURL: "http://127.0.0.1:3101/pulse/", trace: "retain-on-failure" },
  webServer: { command: "node tests/browser/serve-artifacts.mjs", cwd: resolve(import.meta.dirname, "../.."), url: "http://127.0.0.1:3101/pulse/", reuseExistingServer: false },
});
