# Approved research brief

## Decision

Choose between Observable Framework and Evidence as Pulse's report-site substrate.

## Hard gates

- Fully static output deployable to GitHub Pages.
- Client-side DuckDB-WASM over Parquet.
- Arbitrary HTML, SVG, CSS, and interaction without using a visualization library.
- Reproducible repository-first builds.
- Structural separation of public and private outputs remains possible.

## Weighted criteria

| Criterion | Weight |
| --- | ---: |
| Pulse visual-authoring and data-interface fit | 30% |
| Ecosystem health and five-year regret risk | 25% |
| Agent ergonomics, testing, and debuggability | 15% |
| DuckDB/data-delivery and performance fit | 15% |
| Deployment and operational simplicity | 10% |
| Migration-away cost | 5% |

## Evidence plan

1. Health and trajectory: activity over time, contributor concentration, issue and PR responsiveness, dependency freshness, organizational backing, roadmap signals, and activity moving elsewhere.
2. Current implementation reality: custom visual boundaries, state and interaction, DuckDB integration, testing, accessibility, generated-site performance, and framework-imposed friction.
3. Lock-in and failure modes: framework-specific surface, abandonment scenarios, migration cost, and cheapest exit path.

Standard preset: three parallel researchers, up to eight sources per dimension per round, up to two rounds, normal validation with two sources for any criterion that decides the winner.
