# OECD participation rate comparison dataset contract

One row per calendar quarter, OECD reference area and sex, carrying the
harmonised labour force participation rate for people aged 15 or over,
seasonally adjusted. 45 reference areas and three sex breakdowns, from 2000-Q1.

## Which French series this one may sit beside

This rate is a share of everyone **aged 15 or over**. The French participation
rates in `french-labour-market-quarterly` are published on two bases: all ages,
and **15 to 64**.

The **all-ages** French rate is the same 15-or-over basis as this one. Measured
across all 94 shared quarters, France here and
`french-labour-market-quarterly.participation_rate_pct` differ by at most **0.7
points**, average **0.49**, and coincide exactly in 4 quarters — that residue is
OECD harmonisation, not a different population. It is small enough to compare and
large enough that the two must not be presented as the same number.

The French **15-to-64** rate is a genuinely different basis: it excludes the
retired population and runs about **18 points higher** (75.4 against 56.9 in
2026-Q2). Placing it on the same axis as this rate would manufacture an enormous
gap out of nothing but the denominator.

## Sex is a dimension, not three columns

Men, women and both together are the same measure of the same
population, so a reader switching between them switches a filter rather than a
metric. `sex` is therefore `all`, `men` or `women`, and the grain is `(period,
reference_area_code, sex)`.

The gap between men's and women's participation — the thing a reader actually
wants — is a **difference between two published rates**, not a published figure.
Whatever computes it owns that subtraction and should say so.

## Membership is a declared classification

As in `oecd-unemployment-comparison`, and from the same package-owned list:
`reference_area_kind` is `member` (one of the 38 OECD economies), `aggregate`
(`EA`, `EU`, `OECD` — computed areas that must never be ranked among countries),
or `non-member` (here Brazil, Bulgaria, Croatia and Romania).

Unlike the monthly unemployment dataflow, this quarterly one **does** carry
Switzerland and New Zealand, so `every-oecd-member-is-present` requires all 38
with no exceptions. The two tables therefore disagree about which members are
available, which is a provider fact a consumer has to present rather than
reconcile.

## Sex coverage is complete only where it is tested

Checked against the full history: 96 of 4,373 area-quarter cells carry a total
without a men/women split — 54 for Brazil, 28 for Croatia and 14 for the OECD
aggregate between 2007 and 2010. None belong to the five default comparators,
which are complete across every quarter they report.

The `sex-split-is-complete-outside-known-gaps` test therefore excludes those
three areas and covers every other one. Asserting completeness across every area would be permanently red, which
would make the signal meaningless rather than informative — and the failure it
is meant to catch is a participation gap that cannot be drawn for a country the
report defaults to showing.

## The edge is ragged

Areas reach the publication edge at different speeds, so the latest quarter
present differs by country. A consumer must handle that rather than assume a
rectangle.

## Validations

- `(period, reference_area_code, sex)` is unique; no column is ever null.
- Every rate lies within 0 to 100.
- Every `reference_area_kind` is `member`, `aggregate` or `non-member`; every
  `sex` is `all`, `men` or `women`.
- France, Germany, the United Kingdom, Italy and Spain each carry all three sex
  breakdowns in every quarter they report.
- Every one of the 38 listed OECD members appears.

## Lineage

Source: `oecd-participation-rate`, snapshot format `parquet`. CC BY 4.0.
Attribution: *Source: OECD, Labour force participation rate. This is an
adaptation of an original work by the OECD.* The adaptation disclaimer is
required by the licence and must survive into anything published from this
table.
