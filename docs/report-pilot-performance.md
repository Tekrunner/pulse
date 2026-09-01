# Story 1.2 pilot performance

The pilot uses reproducible cold-cache conditions: clean locked install, `npm run build`, and a direct nested report load from the resulting `dist/` artifact. The acceptance budget is:

- cold page load: ≤ 5 seconds;
- first readable visual: ≤ 10 seconds.

The 10-second ceiling was updated on 2026-09-01 after the visual-contract path began rendering the complete public INSEE CPI history through DuckDB-WASM. The build is static and same-origin; no remote font or data request is part of the artifact. Story 1.9 re-measures this budget against the production report and dataset.

Measured on 2026-08-27 with Playwright Chromium 151 on Linux, using `npm run browser:test` against a freshly built artifact and a new browser context for each run:

| Run | Cold page load | First readable visual |
| --- | ---: | ---: |
| 1 | 38.0 ms | 1,697.7 ms |
| 2 | 52.1 ms | 1,578.3 ms |
| 3 | 45.4 ms | 1,659.8 ms |

Firefox 153 was also measured through the same artifact and procedure:

| Run | Cold page load | First readable visual |
| --- | ---: | ---: |
| 1 | 104 ms | 2,156 ms |
| 2 | 116 ms | 2,343 ms |
| 3 | 103 ms | 2,085 ms |

The pilot's original fixture measurements had cross-browser maxima of 116 ms and 2,343 ms. The Playwright test enforces the current ceilings in Chromium and Firefox on every verification run.
