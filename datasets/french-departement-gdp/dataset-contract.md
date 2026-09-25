# GDP by French departement dataset contract

`dataset-contract.yaml` is authoritative. This file records what a consumer has
to know that a schema cannot say.

## What this table is

One row per French departement and year from 2000 to the latest year Eurostat
publishes, of GDP at current market prices: in millions of euros, per
inhabitant in euros and in purchasing power standards, and per inhabitant
relative to France in the same year. All 101 departements, overseas included,
appear in every year (`every_departement_is_published_every_year`).

## Where it comes from

The `eurostat-regional-gdp` snapshot, dataset `nama_10r_3gdp`, units `MIO_EUR`,
`EUR_HAB` and `PPS_EU27_2020_HAB`, restricted to the French NUTS 3 regions and
to France as a whole for the index. The regional accounts are compiled by INSEE
and transmitted to Eurostat.

Eurostat codes French NUTS 3 regions by NUTS code. Each is one departement, and
`dbt/seeds/nuts3_departements.csv` declares the INSEE departement code of each
(`FR101` Paris is `75`, `FRM01` Corse-du-Sud is `2A`, `FRY50` Mayotte is `976`).
`every_french_nuts3_region_is_declared` fails the build if a NUTS revision
introduces a code the seed does not declare.

## Definitions

- **GDP per inhabitant** divides the departement's GDP by its average
  population in the year.
- **Purchasing power standards** convert at EU-wide parities based on the EU27
  from 2020. There is no separate parity per departement: within France every
  departement is converted at the same national rate, so PPS changes the level
  but not the ranking of departements in a year.
- **The index** divides a departement's GDP per inhabitant by France's in the
  same year, France = 100. It removes nominal growth and inflation, so years
  can be compared on it.

## What the period means

`period` is 1 January of the year whose GDP the row carries.

## Provider quirks

- **GDP is counted where it is produced, population where people live.**
  Departements that import commuters record high GDP per inhabitant, and those
  that export them low. On the 2024 figures Paris stood at about 314 and
  Hauts-de-Seine at about 281, against 30.8 for Mayotte: a spread driven by
  workplace location as much as by output per worker.
- **Mayotte's per-inhabitant figures start in 2014**, although its GDP in euros
  starts in 2000; the per-inhabitant columns are null before then
  (`only_mayotte_lacks_per_inhabitant_figures`).
- **Recent years are provisional.** Eurostat flags them `p`, carried in
  `is_provisional`.
- **Extra-regio GDP is excluded.** `FRZZZ` is not a departement; departements
  add up to France within half a percent (`departements_add_up_to_france`).

## Limitations

- Current prices only: the table has no volume series, so growth in real terms
  cannot be computed per departement.
- GDP per inhabitant is not income per inhabitant; the commuting effect above
  makes it a poor proxy for residents' living standards in the Paris region.
- The latest year trails the national accounts by a year or more.

## Licence and attribution

Eurostat's reuse policy (Commission Decision 2011/833/EU): reuse is authorised
for commercial and non-commercial purposes provided the source is
acknowledged. Attribution: "Source: Eurostat, gross domestic product at current
market prices by NUTS 3 region (nama_10r_3gdp)."
