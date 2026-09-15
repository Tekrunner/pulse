"""Offline contract coverage for the INSEE quarterly ILO labour-market source.

Every test runs against the recorded fixture with the network severed, so a
regression here is a regression in the adapter rather than in the provider.
"""

from __future__ import annotations

import json
from pathlib import Path
import xml.etree.ElementTree as ElementTree
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


SOURCE_ID = "insee-labour-market"
DECLARED_SERIES = 25
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


def test_fixture_acquisition_is_offline_faithful_and_quarter_ended(declaration, offline) -> None:
    acquired = _acquire(declaration)

    assert acquired.source_urls == [declaration.configuration["url"]]
    assert len(acquired.rows) == DECLARED_SERIES * FIXTURE_OBSERVATIONS_PER_SERIES
    # The represented date is the END of the greatest quarter, because the
    # publication deadline is derived by advancing from it by one period.
    assert acquired.source_data_date == "2026-06-30"
    assert all(assertion["passed"] for assertion in acquired.assertions)


def test_every_declared_provider_field_survives_acquisition_unrenamed(declaration, offline) -> None:
    row = _acquire(declaration).rows[0]

    required = set(declaration.snapshot_contract["required_fields"])
    assert required <= set(row)
    # Compatible provider additions are retained rather than dropped.
    assert {"TITLE_EN", "OBS_STATUS", "DECIMALS"} <= set(row)
    assert all(isinstance(value, str) for value in row.values())


def test_declared_scope_is_covered_exactly_once(declaration, offline) -> None:
    rows = _acquire(declaration).rows

    declared = {entry["id"] for entry in declaration.configuration["series"]}
    assert {row["IDBANK"] for row in rows} == declared
    assert len(declared) == DECLARED_SERIES


def test_live_access_requires_an_explicit_opt_in(declaration, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(declaration, fixture=None, live=False)


@pytest.mark.parametrize(
    ("mutation", "expected"),
    (
        ("drop-series", "scope does not match"),
        ("rename-series", "renamed"),
        ("duplicate-series", "duplicate"),
        ("not-xml", "well-formed"),
    ),
)
def test_incompatible_provider_responses_are_rejected_without_a_snapshot(
    declaration, offline, tmp_path: Path, mutation: str, expected: str
) -> None:
    original = (declaration.path.parent / "fixture.xml").read_text(encoding="utf-8")
    first = original.index("<Series ")
    second = original.index("<Series ", first + 1)
    end = original.index("</Series>", first) + len("</Series>")
    mutated = {
        "drop-series": original[:first] + original[end:],
        "rename-series": original.replace(
            'TITLE_FR="Taux de chômage au sens du BIT - Ensemble - France entière - Données CVS"',
            'TITLE_FR="Taux de chomage - Ensemble - renamed upstream"',
        ),
        "duplicate-series": original[:second] + original[first:end] + original[second:],
        "not-xml": "this is not the SDMX response",
    }[mutation]
    fixture = tmp_path / "fixture.xml"
    fixture.write_text(mutated, encoding="utf-8")

    with pytest.raises(SourceAcquisitionError, match=expected):
        _acquire(declaration, fixture)


def test_implausible_values_are_suspect_rather_than_rejected(
    declaration, offline, tmp_path: Path
) -> None:
    """A plausibility failure must keep the snapshot usable, not discard it."""
    tree = ElementTree.parse(declaration.path.parent / "fixture.xml")
    rate = next(
        element
        for element in tree.getroot().iter()
        if element.tag == "Series" and element.attrib["UNIT_MEASURE"] == "POURCENT"
    )
    # A rate above 100 is impossible, not merely surprising.
    rate[0].set("OBS_VALUE", "184.0")
    fixture = tmp_path / "fixture.xml"
    tree.write(fixture, encoding="utf-8", xml_declaration=True)

    acquired = _acquire(declaration, fixture)

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["percentage_observations_lie_within_zero_and_one_hundred"]
    assert acquired.rows


def test_snapshot_archives_a_manifest_that_matches_its_raw_parquet(
    declaration, offline, tmp_path: Path
) -> None:
    acquired = _acquire(declaration)

    snapshot, no_op = archive_rows(
        root=tmp_path,
        source_id=SOURCE_ID,
        acquisition_id="acq-test-insee-labour-market",
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
    assert manifest.source_data_date == "2026-06-30"
    assert (snapshot / manifest.artifacts[0]["path"]).exists()


def test_declaration_carries_a_quarterly_schedule_and_no_placeholders(tmp_path: Path) -> None:
    package = tmp_path / SOURCE_ID
    shutil.copytree(Path("sources") / SOURCE_ID, package)

    declaration = load_source_declaration(package / "source.yaml")

    assert declaration.publication_schedule == {
        "period": "quarterly",
        "expected_within_days": 45,
        "grace_days": 14,
    }
    assert declaration.visibility == "public"
    assert declaration.configuration["url"].startswith("https://")
