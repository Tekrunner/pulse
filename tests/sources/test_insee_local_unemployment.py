"""Offline contract coverage for the INSEE localised unemployment rate source.

The territorial scope is the point of this source, so the tests concentrate on
the ways a territory can go missing, move, or silently change identity.
"""

from __future__ import annotations

import json
from pathlib import Path
import shutil
import xml.etree.ElementTree as ElementTree

import pytest

from pulse.archive import archive_rows
from pulse.contracts.snapshot import validate_snapshot_manifest
from pulse.sources import (
    SourceAcquisitionError,
    acquire_from_adapter,
    discover_sources,
    load_source_declaration,
)


SOURCE_ID = "insee-local-unemployment"
DECLARED_SERIES = 115
DECLARED_DEPARTEMENTS = 100
FIXTURE_OBSERVATIONS_PER_SERIES = 8


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
        declaration, fixture=fixture or declaration.path.parent / "fixture.xml", live=False
    )


def _mutated(declaration, tmp_path: Path, mutate) -> Path:
    tree = ElementTree.parse(declaration.path.parent / "fixture.xml")
    mutate(tree.getroot())
    fixture = tmp_path / "fixture.xml"
    tree.write(fixture, encoding="utf-8", xml_declaration=True)
    return fixture


def _series(root) -> list:
    return [element for element in root.iter() if element.tag == "Series"]


def test_fixture_acquisition_is_offline_faithful_and_quarter_ended(declaration, offline) -> None:
    acquired = _acquire(declaration)

    assert acquired.source_urls == [declaration.configuration["url"]]
    assert len(acquired.rows) == DECLARED_SERIES * FIXTURE_OBSERVATIONS_PER_SERIES
    assert acquired.source_data_date == "2026-03-31"
    assert all(assertion["passed"] for assertion in acquired.assertions)


def test_declared_territorial_scope_is_covered_exactly_once(declaration, offline) -> None:
    rows = _acquire(declaration).rows

    declared = {entry["id"]: entry["ref_area"] for entry in declaration.configuration["series"]}
    assert {row["IDBANK"] for row in rows} == set(declared)
    assert {row["REF_AREA"] for row in rows} == set(declared.values())
    assert sum(1 for area in declared.values() if area.startswith("D")) == DECLARED_DEPARTEMENTS
    # Mayotte has no localised series, so the national reference here is France
    # excluding Mayotte rather than the France-entiere basis used nationally.
    assert "D976" not in set(declared.values())
    assert "FR-D976" in set(declared.values())


def test_every_declared_provider_field_survives_acquisition_unrenamed(declaration, offline) -> None:
    row = _acquire(declaration).rows[0]

    assert set(declaration.snapshot_contract["required_fields"]) <= set(row)
    assert {"TITLE_EN", "DECIMALS"} <= set(row)
    assert all(isinstance(value, str) for value in row.values())


def test_live_access_requires_an_explicit_opt_in(declaration, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(declaration, fixture=None, live=False)


def test_a_missing_territory_is_rejected_without_a_snapshot(
    declaration, offline, tmp_path: Path
) -> None:
    def drop_a_departement(root) -> None:
        victim = next(item for item in _series(root) if item.attrib["REF_AREA"] == "D75")
        next(parent for parent in root.iter() if victim in list(parent)).remove(victim)

    with pytest.raises(SourceAcquisitionError, match="territorial scope does not match"):
        _acquire(declaration, _mutated(declaration, tmp_path, drop_a_departement))


def test_a_series_moved_to_another_territory_is_rejected(
    declaration, offline, tmp_path: Path
) -> None:
    def move_a_departement(root) -> None:
        next(item for item in _series(root) if item.attrib["REF_AREA"] == "D75").set(
            "REF_AREA", "D93"
        )

    with pytest.raises(SourceAcquisitionError, match="another territory"):
        _acquire(declaration, _mutated(declaration, tmp_path, move_a_departement))


def test_a_retitled_series_is_rejected(declaration, offline, tmp_path: Path) -> None:
    def retitle(root) -> None:
        _series(root)[0].set("TITLE_FR", "Taux de chomage localise - retitled upstream")

    with pytest.raises(SourceAcquisitionError, match="renamed"):
        _acquire(declaration, _mutated(declaration, tmp_path, retitle))


def test_an_impossible_rate_is_suspect_rather_than_rejected(
    declaration, offline, tmp_path: Path
) -> None:
    def implausible(root) -> None:
        _series(root)[0][0].set("OBS_VALUE", "410.0")

    acquired = _acquire(declaration, _mutated(declaration, tmp_path, implausible))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_rate_lies_within_zero_and_one_hundred"]
    assert len(acquired.rows) == DECLARED_SERIES * FIXTURE_OBSERVATIONS_PER_SERIES


def test_a_territory_lagging_the_others_is_suspect_rather_than_rejected(
    declaration, offline, tmp_path: Path
) -> None:
    """A partial release is usable, but a reader must be told it is partial."""

    def drop_latest_observation(root) -> None:
        series = _series(root)[0]
        series.remove(series[0])

    acquired = _acquire(declaration, _mutated(declaration, tmp_path, drop_latest_observation))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_territory_shares_the_latest_period"]
    assert acquired.rows


def test_snapshot_archives_a_manifest_that_matches_its_raw_parquet(
    declaration, offline, tmp_path: Path
) -> None:
    acquired = _acquire(declaration)

    snapshot, no_op = archive_rows(
        root=tmp_path,
        source_id=SOURCE_ID,
        acquisition_id="acq-test-insee-local-unemployment",
        acquired_at="2026-09-14T08:00:00Z",
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
    assert manifest.source_data_date == "2026-03-31"


def test_declaration_carries_its_own_later_quarterly_schedule(tmp_path: Path) -> None:
    package = tmp_path / SOURCE_ID
    shutil.copytree(Path("sources") / SOURCE_ID, package)

    declaration = load_source_declaration(package / "source.yaml")

    # Localised rates trail the national ILO release, so this source declares a
    # later deadline than insee-labour-market rather than sharing one.
    assert declaration.publication_schedule == {
        "period": "quarterly",
        "expected_within_days": 85,
        "grace_days": 14,
    }
    national = discover_sources()["insee-labour-market"].publication_schedule
    assert declaration.publication_schedule["expected_within_days"] > national["expected_within_days"]
