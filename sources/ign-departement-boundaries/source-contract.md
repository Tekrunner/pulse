# IGN departement boundary snapshot contract

This public acquisition package fetches one credential-free WFS 2.0.0
`GetFeature` request against the French state Geoplateforme and archives the
101 departement boundaries of the ADMIN EXPRESS COG CARTO *Petite Echelle*
layer: the 96 metropolitan departements including Corse-du-Sud and Haute-Corse,
and the five overseas departements 971, 972, 973, 974 and 976.

This is a reference layer, not a statistical series. It exists so that a
departement-level choropleth can be drawn, and every acquisition decision below
follows from that.

## Why this layer, this generalisation, and a pinned edition

- **IGN, not a derived redistribution.** IGN is the legal authority for French
  administrative boundaries, and its features carry `code_insee` directly, so
  the geometry joins to INSEE's localised unemployment series with no
  correspondence table anywhere in the pipeline. Eurostat GISCO NUTS-3 geometry
  covers exactly the same 101 territories but carries only a NUTS identifier and
  a name, which would force either a hand-maintained crosswalk or a name match
  against strings observed to contain typographic apostrophes and trailing
  whitespace. The OpenStreetMap redistribution on data.gouv.fr has not been
  refreshed since 2018, is served over plain HTTP from a contributor-operated
  host, and is ODbL, whose share-alike term no statistical source here imposes.
  `geo.api.gouv.fr` has the right keys but no longer returns geometry at all,
  which was confirmed against the live API on 2026-09-14 rather than inferred
  from its documentation.
- **Petite Echelle, not full detail.** Measured on 2026-09-14: the small-scale
  layer returns the same 101 features with the same properties in 1.78 MB,
  against 20.3 MB for `ADMINEXPRESS-COG-CARTO.LATEST`. Snapshots are committed
  to this repository, so an eleven-fold size difference for identical coverage
  and identical keys is decisive. It is a resolution choice about what is worth
  archiving, not a simplification performed here: no geometry is altered.
- **A dated edition, not the moving `LATEST` alias.** The WFS exposes
  `ADMINEXPRESS-COG-CARTO-PE.2025`, `.2026` and `.LATEST`. The dated edition is
  pinned in `source.yaml`, so the represented year is a declared fact rather
  than a guess about whatever the provider happened to be serving when the job
  ran. The WFS response itself carries no edition or date field, so with
  `LATEST` there would be nothing from which to derive `source_data_date`
  honestly.

## What a row is

GeoJSON is nested and a snapshot row is flat. Each feature becomes one row
carrying every provider property under its own name — `cleabs`, `nom_officiel`,
`nom_officiel_en_majuscules`, `code_insee`, `code_insee_de_la_region`,
`code_siren` — plus the feature's own `type` and `id` members and its
`geometry`. The geometry is stored as the exact JSON value of the feature's
`geometry` member: whitespace is compacted, and coordinates, member order and
precision are unchanged. Nothing is renamed and nothing is dropped.

Simplifying geometry, reprojecting it, converting it to TopoJSON, dropping
overseas departements into an inset, or classifying rates into bands are
analytical and presentational decisions that belong to a dataset and a visual.

`source_data_date` is `<edition>-12-31`, the end of the reference year the
pinned edition describes, and the adapter refuses to run unless that edition
year appears in both the declared layer and the declared URL, so the three
cannot drift apart silently.

## Scheduling evidence

- **Provider access and native scope.** `https://data.geopf.fr/wfs/ows` with
  `TYPENAMES=ADMINEXPRESS-COG-CARTO-PE.2026:departement`, checked 2026-09-14.
  The WFS `GetCapabilities` document was read the same day to confirm which
  editions and layers exist; the request returned `numberMatched` 101 and
  `numberReturned` 101 in about 18 seconds, which is why the adapter's timeout
  is 120 seconds rather than the 30 used for the statistical sources.
- **Licence and attribution.** Licence Ouverte / Open Licence 2.0, the licence
  recorded for the IGN ADMIN EXPRESS dataset on data.gouv.fr, checked
  2026-09-14. Reuse, adaptation and redistribution are permitted on condition of
  attributing IGN and the date of last update; there is no share-alike term.
- **Publication cadence and window.** The data.gouv.fr record describes ADMIN
  EXPRESS as updated monthly, while the COG editions this package pins are
  annual. Those are two different things, and the monthly figure is not evidence
  for any deadline here: a pinned edition does not advance at all.
- **Provider timezone.** Europe/Paris.
- **Declared expected deadline and grace — an explicit human decision.** The
  provider publishes no calendar stating when a given year's COG edition
  appears, so no deadline could be derived from provider evidence alone. The
  scheduling decision recorded here is therefore deliberate rather than
  inferred: `period: annual`, `expected_within_days: 0`, `grace_days: 60`. With
  the represented date at the end of the pinned edition's year, that places the
  deadline 60 days after the end of the *following* year — 2028-02-29 for the
  2026 edition. The intent is a reminder, not a freshness alarm: a boundary file
  a year old is not stale in any sense that matters to a reader, but an edition
  three years behind the statistics it is joined to would be, and this deadline
  surfaces that before it happens.
- **UTC workflow cron derivation.** `0 6 15 3 *`. One run a year, on 15 March,
  by which date IGN has published the current year's COG edition. Because the
  edition is pinned, that run is a liveness check rather than a refresh: it
  confirms the provider still serves the pinned edition and that its content
  still satisfies the declared scope. 06:00 UTC is outside the Paris working day
  in both CET and CEST. Bumping the pinned edition is a separate, deliberate
  change to `source.yaml`, not something the schedule does on its own.

Reuse is under Licence Ouverte / Open Licence 2.0 with the attribution declared
in `source.yaml`. The only durable output owned here is faithful raw Parquet
plus the generic immutable `snapshot.json` manifest.
