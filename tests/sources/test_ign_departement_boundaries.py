"""Offline contract coverage for the IGN departement boundary source.

This source exists so a choropleth can be drawn, so the tests concentrate on the
two ways that can quietly fail: a territory missing its geometry, and geometry
that is no longer where France is.
"""

from __future__ import annotations

import json
from pathlib import Path
import shutil

import pytest

from pulse.archive import archive_rows
from pulse.contracts.snapshot import validate_snapshot_manifest
from pulse.sources import (
    SourceAcquisitionError,
    acquire_from_adapter,
    discover_sources,
    load_source_declaration,
)


SOURCE_ID = "ign-departement-boundaries"
EXPECTED_FEATURES = 101


@pytest.fixture(name="declaration")
def _declaration():
    return discover_sources()[SOURCE_ID]


@pytest.fixture(name="offline")
def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "socket.create_connection",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("network")),
    )


def _acquire(declaration, fixture: Path | None = None):
    return acquire_from_adapter(
        declaration, fixture=fixture or declaration.path.parent / "fixture.json", live=False
    )


def _rewritten(declaration, tmp_path: Path, mutate) -> Path:
    payload = json.loads((declaration.path.parent / "fixture.json").read_text(encoding="utf-8"))
    mutate(payload)
    fixture = tmp_path / "fixture.json"
    fixture.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return fixture


def test_fixture_acquisition_is_offline_and_covers_every_departement(declaration, offline) -> None:
    acquired = _acquire(declaration)

    assert acquired.source_urls == [declaration.configuration["url"]]
    assert len(acquired.rows) == EXPECTED_FEATURES
    assert all(assertion["passed"] for assertion in acquired.assertions)
    required = set(declaration.configuration["required_departement_codes"])
    assert {row["code_insee"] for row in acquired.rows} >= required


def test_represented_date_comes_from_the_pinned_edition_not_the_clock(declaration, offline) -> None:
    edition = declaration.configuration["edition"]

    assert _acquire(declaration).source_data_date == f"{edition}-12-31"
    # The three places the edition appears must agree, or a bump could half-land.
    assert edition in declaration.configuration["layer"]
    assert edition in declaration.configuration["url"]


def test_provider_property_names_survive_and_geometry_is_kept_verbatim(declaration, offline) -> None:
    row = _acquire(declaration).rows[0]

    assert set(declaration.snapshot_contract["required_fields"]) <= set(row)
    # Provider property names are not renamed, including the ones no consumer
    # here needs.
    assert {"nom_officiel_en_majuscules", "code_siren", "cleabs"} <= set(row)
    geometry = json.loads(row["geometry"])
    assert geometry["type"] in {"Polygon", "MultiPolygon"}
    assert geometry["coordinates"]


def test_geometry_joins_to_the_localised_unemployment_territories(declaration, offline) -> None:
    """The choropleth has holes unless every rated territory has a shape."""
    rated = {
        entry["ref_area"][1:]
        for entry in discover_sources()["insee-local-unemployment"].configuration["series"]
        if entry["ref_area"].startswith("D")
    }

    shapes = {row["code_insee"] for row in _acquire(declaration).rows}

    assert rated <= shapes
    # Mayotte has geometry but no localised rate. That surplus is expected and
    # must be handled by a dataset rather than mistaken for a mismatch.
    assert shapes - rated == {"976"}


def test_live_access_requires_an_explicit_opt_in(declaration, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(declaration, fixture=None, live=False)


def test_a_missing_departement_is_rejected_without_a_snapshot(
    declaration, offline, tmp_path: Path
) -> None:
    def drop_a_departement(payload) -> None:
        payload["features"] = [
            feature
            for feature in payload["features"]
            if feature["properties"]["code_insee"] != "2A"
        ]

    with pytest.raises(SourceAcquisitionError, match="omits a required departement"):
        _acquire(declaration, _rewritten(declaration, tmp_path, drop_a_departement))


def test_a_duplicate_departement_is_rejected(declaration, offline, tmp_path: Path) -> None:
    def duplicate(payload) -> None:
        payload["features"].append(payload["features"][0])

    with pytest.raises(SourceAcquisitionError, match="duplicate departement"):
        _acquire(declaration, _rewritten(declaration, tmp_path, duplicate))


@pytest.mark.parametrize(
    ("mutation", "expected"),
    (
        ("not-a-collection", "FeatureCollection"),
        ("no-features", "carries no features"),
        ("no-geometry", "without properties or geometry"),
    ),
)
def test_structurally_incompatible_responses_are_rejected(
    declaration, offline, tmp_path: Path, mutation: str, expected: str
) -> None:
    def mutate(payload) -> None:
        if mutation == "not-a-collection":
            payload["type"] = "Feature"
        elif mutation == "no-features":
            payload["features"] = []
        else:
            payload["features"][0].pop("geometry")

    with pytest.raises(SourceAcquisitionError, match=expected):
        _acquire(declaration, _rewritten(declaration, tmp_path, mutate))


def test_geometry_outside_france_is_suspect_rather_than_rejected(
    declaration, offline, tmp_path: Path
) -> None:
    """Swapped axis order or a wrong projection must be visible, not silent."""

    def swap_axis_order(payload) -> None:
        geometry = payload["features"][0]["geometry"]
        geometry["coordinates"] = [
            [[[latitude, longitude] for longitude, latitude in ring] for ring in polygon]
            for polygon in geometry["coordinates"]
        ]

    acquired = _acquire(declaration, _rewritten(declaration, tmp_path, swap_axis_order))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_departement_falls_inside_one_french_territorial_box"]
    assert len(acquired.rows) == EXPECTED_FEATURES


def test_an_unexpected_feature_count_is_suspect_rather_than_rejected(
    declaration, offline, tmp_path: Path
) -> None:
    def add_a_territory(payload) -> None:
        extra = json.loads(json.dumps(payload["features"][0]))
        extra["properties"]["code_insee"] = "999"
        extra["properties"]["cleabs"] = "DEPARTEM0000000000000999"
        payload["features"].append(extra)

    acquired = _acquire(declaration, _rewritten(declaration, tmp_path, add_a_territory))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["feature_count_matches_the_declared_edition"]
    assert len(acquired.rows) == EXPECTED_FEATURES + 1


def test_snapshot_archives_a_manifest_that_matches_its_raw_parquet(
    declaration, offline, tmp_path: Path
) -> None:
    acquired = _acquire(declaration)

    snapshot, no_op = archive_rows(
        root=tmp_path,
        source_id=SOURCE_ID,
        acquisition_id=f"acq-test-{SOURCE_ID}",
        acquired_at="2026-09-14T06:00:00Z",
        source_data_date=acquired.source_data_date,
        source_urls=acquired.source_urls,
        rows=acquired.rows,
        decoder_version=acquired.decoder_version,
        licence=declaration.licence,
        attribution=declaration.attribution,
        assertions=acquired.assertions,
    )

    assert no_op is False
    manifest = validate_snapshot_manifest(
        json.loads((snapshot / "snapshot.json").read_text(encoding="utf-8"))
    )
    assert manifest.format == "parquet"
    assert manifest.source_data_date == acquired.source_data_date


def test_declaration_carries_an_annual_schedule_and_no_placeholders(tmp_path: Path) -> None:
    package = tmp_path / SOURCE_ID
    shutil.copytree(Path("sources") / SOURCE_ID, package)

    declaration = load_source_declaration(package / "source.yaml")

    assert declaration.publication_schedule == {
        "period": "annual",
        "expected_within_days": 0,
        "grace_days": 60,
    }
    assert declaration.configuration["url"].startswith("https://")
