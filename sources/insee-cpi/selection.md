# INSEE CPI selection for the first French macro report

## Selected slice

Pulse selects three current INSEE BDM/SDMX **Base 2025** monthly series for all
households, France, and excluding tobacco: `011814056` (CPI level), `011814058`
(year-on-year inflation), and `011814057` (month-on-month movement). Together they
are the first report's headline CPI slice. The source package retains the provider
rows and fields intact; this selection does not create an analytical model or
report-specific calculations.

## Why this source

INSEE is France's national statistical institute and its BDM catalogue is an
authoritative, public, long-running source. The selected monthly series supplies the
first report's CPI level-of-interest (headline inflation), year-on-year movement,
French coverage, and monthly granularity. Base 2025 is deliberately selected because
Base 2015 CPI series stopped after December 2025; the catalogue notes Base 2025 was
introduced in January 2026 and is mostly backcast to 1996.

The BDM/SDMX response is public HTTPS JSON, requires no account or credential, and
can be decoded faithfully into a raw Parquet snapshot. Pulse fetches monthly after
the CPI release. Its freshness expectation is the next monthly publication, rather
than merely the next attempted fetch. This is suitable for an independently
scheduled source and remains replayable from committed raw snapshots.

## Rights and attribution

The declared reuse terms are **Licence Ouverte / Open Licence 2.0**. Published work
must retain: “Source: INSEE, Indice des prix à la consommation (IPC), Base 2025.”

## Scope boundary

This is a source decision for the first French macroeconomic report only. It does
not make INSEE the default provider for future reports; later report planning must
evaluate authority, coverage, granularity, stability, format, access constraints,
licence, attribution, cadence, and publication timing again.

## Access references

- [INSEE CPI level 011814056](https://www.insee.fr/fr/statistiques/serie/011814056)
- [INSEE CPI year-on-year 011814058](https://www.insee.fr/fr/statistiques/serie/011814058)
- [INSEE CPI month-on-month 011814057](https://www.insee.fr/fr/statistiques/serie/011814057)
- [INSEE BDM/SDMX web-service guide](https://www.insee.fr/fr/statistiques/fichier/2862759/BDM_serviceweb_SDMX_V2_2_guideutilisation.pdf)
- [INSEE Open Licence](https://www.insee.fr/fr/information/2388574)
