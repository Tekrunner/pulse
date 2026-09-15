"""Faithful acquisition of IGN departement boundaries from the Geoplateforme WFS.

GeoJSON is nested and a snapshot row is flat, so each feature becomes one row
carrying its provider properties under their own names plus the feature's `type`,
`id` and `geometry` members. The geometry is kept as its exact JSON value:
compacted whitespace, unchanged coordinates, unchanged member order. Simplifying
geometry, projecting it, or converting it to any other topology is an analytical
and presentational decision that belongs to a dataset and a visual.
"""

import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pulse.sources import AdapterAcquisition, SourceAcquisitionError


DECODER_VERSION = "ign-geoplateforme-wfs-geojson-v1"
MEDIA_TYPE = "application/json"
EDITION = re.compile(r"^\d{4}$")
# Boundaries are read for a whole reference year, so the represented period ends
# with that year. `pulse` advances one period from the represented date to find
# the publication deadline.
PROPERTY_FIELDS = (
    "cleabs",
    "nom_officiel",
    "nom_officiel_en_majuscules",
    "code_insee",
    "code_insee_de_la_region",
    "code_siren",
)


def _read(url: str, *, fixture: Path | None, live: bool) -> str:
    if fixture is not None:
        try:
            return fixture.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as error:
            raise SourceAcquisitionError("recorded source fixture could not be read") from error
    if not live:
        raise SourceAcquisitionError("live acquisition is opt-in")
    request = Request(url, headers={"Accept": MEDIA_TYPE})
    try:
        # Boundary payloads are large and the Geoplateforme is not fast; 120
        # seconds reflects an 18-second measured response with ample headroom.
        with urlopen(request, timeout=120) as response:  # nosec B310: declared public HTTPS URL
            return response.read().decode("utf-8")
    except HTTPError as error:
        raise SourceAcquisitionError(
            "IGN Geoplateforme HTTP request failed",
            retryable=error.code == 429 or error.code >= 500,
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise SourceAcquisitionError("IGN Geoplateforme transport failed", retryable=True) from error
    except UnicodeDecodeError as error:
        raise SourceAcquisitionError("IGN Geoplateforme response is not valid UTF-8") from error


def _represented_date(configuration: dict) -> str:
    edition = str(configuration.get("edition", ""))
    if not EDITION.fullmatch(edition):
        raise SourceAcquisitionError("source declaration carries no four-digit edition year")
    if edition not in str(configuration.get("layer", "")) or edition not in configuration["url"]:
        raise SourceAcquisitionError("declared edition does not match the declared layer or URL")
    return f"{edition}-12-31"


def acquire(configuration, *, fixture: Path | None, live: bool) -> AdapterAcquisition:
    represented = _represented_date(configuration)
    try:
        payload = json.loads(_read(configuration["url"], fixture=fixture, live=live))
    except json.JSONDecodeError as error:
        raise SourceAcquisitionError("IGN Geoplateforme response is not well-formed JSON") from error
    if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
        raise SourceAcquisitionError("IGN Geoplateforme response is not a GeoJSON FeatureCollection")
    features = payload.get("features")
    if not isinstance(features, list) or not features:
        raise SourceAcquisitionError("IGN Geoplateforme response carries no features")

    rows: list[dict[str, str]] = []
    codes: list[str] = []
    for feature in features:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise SourceAcquisitionError("IGN Geoplateforme returned a non-Feature member")
        properties, geometry = feature.get("properties"), feature.get("geometry")
        if not isinstance(properties, dict) or not isinstance(geometry, dict):
            raise SourceAcquisitionError("IGN Geoplateforme returned a feature without properties or geometry")
        code = properties.get("code_insee")
        if not isinstance(code, str) or not code:
            raise SourceAcquisitionError("IGN Geoplateforme returned a feature without a departement code")
        codes.append(code)
        row = {
            "type": str(feature["type"]),
            "id": str(feature.get("id", "")),
            # Compact separators only; coordinates, member order and precision
            # are exactly what the provider sent.
            "geometry": json.dumps(geometry, ensure_ascii=False, separators=(",", ":"), allow_nan=False),
        }
        for name, value in properties.items():
            row[str(name)] = "" if value is None else str(value)
        rows.append(row)

    missing = [field for field in PROPERTY_FIELDS if field not in rows[0]]
    if missing:
        raise SourceAcquisitionError("IGN Geoplateforme response omits a declared provider property")
    if len(set(codes)) != len(codes):
        raise SourceAcquisitionError("IGN Geoplateforme returned a duplicate departement code")

    required = list(configuration.get("required_departement_codes", []))
    absent = [code for code in required if code not in set(codes)]
    if absent:
        raise SourceAcquisitionError("IGN Geoplateforme response omits a required departement")

    expected = configuration.get("expected_feature_count")
    return AdapterAcquisition(
        rows,
        represented,
        [configuration["url"]],
        DECODER_VERSION,
        assertions=(
            {
                "check": "feature_count_matches_the_declared_edition",
                "passed": expected is None or len(rows) == int(expected),
            },
            {
                "check": "every_geometry_is_a_polygon_or_multipolygon",
                "passed": all(
                    json.loads(row["geometry"]).get("type") in {"Polygon", "MultiPolygon"}
                    for row in rows
                ),
            },
            {
                "check": "every_departement_falls_inside_one_french_territorial_box",
                "passed": all(_within_one_territory(json.loads(row["geometry"])) for row in rows),
            },
            {
                "check": "every_departement_carries_a_region_code",
                "passed": all(row.get("code_insee_de_la_region") for row in rows),
            },
        ),
    )


# One box per French territory, as (west, south, east, north) in EPSG:4326.
# Each is generous enough to tolerate any real boundary revision and far too
# tight to accept a departement from a different territory. A single box round
# all of France would not be: it would have to stretch from Guyane to La Reunion,
# and swapped latitude and longitude for a metropolitan departement would fall
# inside it unnoticed, which is exactly the mistake worth catching.
_TERRITORIES = (
    (-5.5, 41.0, 10.0, 51.5),      # Metropolitan France, Corsica included
    (-63.5, 14.0, -60.5, 16.6),    # Guadeloupe and Martinique
    (-55.0, 2.0, -51.0, 6.0),      # Guyane
    (55.0, -21.5, 56.0, -20.7),    # La Reunion
    (44.9, -13.1, 45.4, -12.6),    # Mayotte
)


def _within_one_territory(geometry: dict) -> bool:
    positions = list(_positions(geometry.get("coordinates")))
    if not positions:
        return False
    west = min(longitude for longitude, _ in positions)
    east = max(longitude for longitude, _ in positions)
    south = min(latitude for _, latitude in positions)
    north = max(latitude for _, latitude in positions)
    return any(
        box[0] <= west and east <= box[2] and box[1] <= south and north <= box[3]
        for box in _TERRITORIES
    )


def _positions(coordinates):
    if not isinstance(coordinates, list):
        return
    if len(coordinates) >= 2 and all(isinstance(value, (int, float)) for value in coordinates[:2]):
        yield float(coordinates[0]), float(coordinates[1])
        return
    for child in coordinates:
        yield from _positions(child)
