# INSEE CPI category-analysis dataset contract

This independent dataset consumes the expanded INSEE Base-2025 CPI snapshot. It
publishes monthly food, energy, and actual-rent indices; comparable annual
changes; official INSEE contributions for the available broad components; and
annual basket-weight context.

Annual weights are joined using the latest reference year not after the
represented calendar year. They remain annual context rather than monthly
observations. Output ends at the latest common complete provider month; missing
asynchronous observations are not imputed.

INSEE does not publish a compatible annual-change series for actual rents in
this selection. `actual_rent_annual_change_pct` is therefore calculated by
Pulse as `(index[t] / index[t-12] - 1) * 100`.
`actual_rent_pulse_contribution_pct_points` is calculated as
`actual_rent_weight / 10000 * actual_rent_annual_change_pct`. It is an
approximation, not an official INSEE contribution, and supports no causal claim.
The four separately named `*_official_contribution_pct_points` columns are
provider-published values.

The committed YAML contract is the report-facing semantic authority. Generated
`dataset.json` adds selected-snapshot lineage, represented period, content hash,
visibility, and test status.
