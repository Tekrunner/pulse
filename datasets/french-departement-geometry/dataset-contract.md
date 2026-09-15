# French departement geometry dataset contract

One row per French departement, carrying its administrative boundary as a
GeoJSON geometry object and the bounding box of that boundary. 101 rows, keyed
by the INSEE departement code.

This table is reference geometry, not measurement. It exists so a rate can be
drawn on a shape.

## Nothing is simplified here

The generalisation decision was made at acquisition, where the provider's own
*Petite Échelle* layer was taken instead of the full-detail one: identical
coverage and identical keys at 1.78 MB rather than 20.3 MB. The geometry column
is therefore exactly what IGN published, in EPSG:4326, and this package has no
further generalisation to make.

Simplifying further was rejected on two grounds. It would mean publishing
boundaries the provider never drew, under IGN's attribution. And it would
require a DuckDB spatial extension, which this build cannot load without network
access — a dependency that would make an offline, reproducible build impossible.

## The bounding box is not an analytical claim

`bbox_west`, `bbox_south`, `bbox_east` and `bbox_north` are the extent of the
stored geometry, computed by flattening the MultiPolygon's coordinate nesting.
They exist so a map can frame one departement, or a chosen set of them, without
parsing every coordinate in the browser first. They assert nothing the geometry
does not already contain.

## The join key

`departement_code` is the bare INSEE code, matching
`french-departement-unemployment.territory_code` exactly — including `2A` and
`2B` for Corsica and the three-digit overseas codes. This is why IGN was chosen
over Eurostat GISCO, whose NUTS-3 features cover the same 101 territories but
carry no INSEE code, and would have forced a hand-maintained crosswalk into the
pipeline.

## Coverage surplus

This table has 101 rows; only 100 departements carry a localised unemployment
rate. **Mayotte (976) has geometry but no rate**, because INSEE publishes no
localised series for it. That surplus is expected, and a choropleth must decide
explicitly what to render for Mayotte rather than discovering the gap at draw
time. The `every-rated-departement-has-a-shape` test guards the other direction:
every rated departement always has a shape, so the map can never have a hole.

## No time dimension

The table describes administrative geography for one pinned IGN COG edition. Its
represented period is taken from the snapshot's own represented date — the end
of that edition's reference year — rather than from any column here. A row is
current for the whole of that year. Bumping the edition is a deliberate change
to `sources/ign-departement-boundaries/source.yaml`, not something a schedule
does on its own.

## Validations

- `departement_code` is unique and never null; no column is ever null.
- Every geometry is a `Polygon` or a `MultiPolygon`.
- Every bounding box has west below east and south below north.
- Every departement carrying a localised unemployment rate has a shape here.

## Lineage

Source: `ign-departement-boundaries`, snapshot format `parquet`. Licence Ouverte
/ Open Licence 2.0. Attribution: *Source: IGN, ADMIN EXPRESS COG CARTO, edition
2026.*
