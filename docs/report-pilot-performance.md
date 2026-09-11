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

## Production public-artifact gate

Story 1.9 applies the same cold-cache procedure to the complete artifact made
by `uv run --no-sync pulse public build --output dist`: direct navigation to
`/pulse/reports/french-consumer-prices`, an empty browser cache, the committed
report-facing Parquet, and the same-origin DuckDB worker, WASM, extension, and
catalogs. Chromium and Firefox both remain gated at 5 seconds for page load and
10 seconds for the first readable visual. The checked-in Playwright suite also
covers direct links, reloads, keyboard/accessibility behavior, isolated query
and rendering failures, and byte-range delivery from the production artifact.

The artifact carries a sorted SHA-256 inventory, while `system:site` status
records generation, validity, build, and deployment preparation. GitHub Pages
deployment itself is intentionally workflow evidence, because writing its
result back into `dist/` would change the bytes that were already verified.

Measured on 2026-09-10 against the production artifact:

| Browser | Run | Cold page load | First readable visual |
| --- | ---: | ---: | ---: |
| Chromium | 1 | 63.4 ms | 1,919.8 ms |
| Chromium | 2 | 58.0 ms | 1,950.8 ms |
| Chromium | 3 | 61.4 ms | 1,946.7 ms |
| Firefox | 1 | 198 ms | 3,660 ms |
| Firefox | 2 | 195 ms | 3,770 ms |
| Firefox | 3 | 162 ms | 3,688 ms |
