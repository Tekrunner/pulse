import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  use: { baseURL: "http://127.0.0.1:3101/pulse/", trace: "retain-on-failure" },
  webServer: { command: "node tests/browser/serve-artifacts.mjs", cwd: resolve(import.meta.dirname, "../.."), url: "http://127.0.0.1:3101/pulse/", reuseExistingServer: false },
});
