"""Offline contract coverage for the INSEE annual national-accounts source.

Every test runs against the recorded fixtures with the network severed, so a
regression here is a regression in the adapter rather than in the provider.
The fixtures are the provider's own responses trimmed to a handful of series:
the whole GDP dataflow, seven branch-account series (including one unmaintained
branch copy) and three employment series.
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


SOURCE_ID = "insee-annual-national-accounts"
DATAFLOWS = ("CNA-2020-PIB", "CNA-2020-CPEB", "CNA-2020-EMPLOI")


@pytest.fixture(name="declaration")
def _declaration():
    return discover_sources()[SOURCE_ID]


@pytest.fixture(name="offline")
def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "socket.create_connection",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("network")),
    )


def _fixture(declaration) -> Path:
    return declaration.path.parent / "fixture"


def _acquire(declaration, fixture: Path | None = None):
    return acquire_from_adapter(declaration, fixture=fixture or _fixture(declaration), live=False)


def _copy_fixture(declaration, tmp_path: Path) -> Path:
    target = tmp_path / "fixture"
    shutil.copytree(_fixture(declaration), target)
    return target


def test_fixture_acquisition_is_offline_faithful_and_year_ended(declaration, offline) -> None:
    acquired = _acquire(declaration)

    assert acquired.source_urls == [
        f"https://bdm.insee.fr/series/sdmx/data/{dataflow}" for dataflow in DATAFLOWS
    ]
    assert acquired.source_data_date == "2025-12-31"
    assert all(assertion["passed"] for assertion in acquired.assertions)
    assert {row["IDBANK"] for row in acquired.rows} >= {"011793334", "011793486", "011793739"}


def test_every_provider_field_survives_acquisition_unrenamed(declaration, offline) -> None:
    rows = _acquire(declaration).rows

    required = set(declaration.snapshot_contract["required_fields"])
    assert all(required <= set(row) for row in rows)
    assert all(isinstance(value, str) for row in rows for value in row.values())
    # Each row keeps its own dataflow's dimensions and no other's.
    branch = next(row for row in rows if "CNA_ACTIVITE" in row and "CNA_TYPE_EMP" not in row)
    employment = next(row for row in rows if "CNA_TYPE_EMP" in row)
    gdp = next(row for row in rows if "CNA_PRODUIT" in row)
    assert {"OPERATION", "PRIX_REF", "TITLE_EN", "OBS_STATUS"} <= set(branch)
    assert "CNA_ACTIVITE" not in gdp
    assert "OPERATION" not in employment


def test_an_unmaintained_branch_copy_does_not_make_the_snapshot_suspect(declaration, offline) -> None:
    rows = _acquire(declaration).rows

    stale = {row["TIME_PERIOD"] for row in rows if row.get("CNA_ACTIVITE") == "A38-FZ"}
    assert max(stale) < "2025"
    assert all(assertion["passed"] for assertion in _acquire(declaration).assertions)


def test_live_access_requires_an_explicit_opt_in(declaration, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(declaration, fixture=None, live=False)


def _mutate(path: Path, mutation: str) -> None:
    text = path.read_text(encoding="utf-8")
    first = text.index("<Series ")
    end = text.index("</Series>", first) + len("</Series>")
    second = text.index("<Series ", first + 1)
    mutated = {
        "wrong-dataflow": text.replace('id="CNA-2020-CPEB"', 'id="CNA-2020-TEI"'),
        "duplicate-series": text[:second] + text[first:end] + text[second:],
        "no-series": text[:first] + text[text.rindex("</Series>") + len("</Series>"):],
        "quarterly-period": text.replace('TIME_PERIOD="2024"', 'TIME_PERIOD="2024-Q4"', 1),
        "not-xml": "this is not the SDMX response",
    }[mutation]
    path.write_text(mutated, encoding="utf-8")


@pytest.mark.parametrize(
    ("mutation", "expected"),
    (
        ("wrong-dataflow", "does not answer the declared dataflow"),
        ("duplicate-series", "duplicate"),
        ("no-series", "without series"),
        ("quarterly-period", "unexpected period format"),
        ("not-xml", "well-formed"),
    ),
)
def test_incompatible_provider_responses_are_rejected_without_a_snapshot(
    declaration, offline, tmp_path: Path, mutation: str, expected: str
) -> None:
    fixture = _copy_fixture(declaration, tmp_path)
    _mutate(fixture / "CNA-2020-CPEB.xml", mutation)

    with pytest.raises(SourceAcquisitionError, match=expected):
        _acquire(declaration, fixture)


def test_a_missing_dataflow_response_is_rejected(declaration, offline, tmp_path: Path) -> None:
    fixture = _copy_fixture(declaration, tmp_path)
    (fixture / "CNA-2020-EMPLOI.xml").unlink()

    with pytest.raises(SourceAcquisitionError, match="could not be read"):
        _acquire(declaration, fixture)


def test_a_total_economy_series_that_did_not_advance_is_suspect(
    declaration, offline, tmp_path: Path
) -> None:
    """A release that left the total economy behind keeps the snapshot usable but suspect."""
    fixture = _copy_fixture(declaration, tmp_path)
    path = fixture / "CNA-2020-EMPLOI.xml"
    text = path.read_text(encoding="utf-8")
    start = text.index("<Series ")
    latest = text.index('<Obs TIME_PERIOD="2025"', start)
    path.write_text(text[:latest] + text[text.index("/>", latest) + 2:], encoding="utf-8")

    acquired = _acquire(declaration, fixture)

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_total_economy_series_reaches_the_latest_year"]
    assert acquired.rows


def test_a_non_numeric_value_is_suspect_rather_than_rejected(
    declaration, offline, tmp_path: Path
) -> None:
    fixture = _copy_fixture(declaration, tmp_path)
    path = fixture / "CNA-2020-PIB.xml"
    text = path.read_text(encoding="utf-8")
    at = text.index('OBS_VALUE="') + len('OBS_VALUE="')
    path.write_text(text[:at] + "n.d." + text[text.index('"', at):], encoding="utf-8")

    acquired = _acquire(declaration, fixture)

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_observation_value_is_numeric"]


def test_snapshot_archives_a_manifest_that_matches_its_raw_parquet(
    declaration, offline, tmp_path: Path
) -> None:
    acquired = _acquire(declaration)

    snapshot, no_op = archive_rows(
        root=tmp_path,
        source_id=SOURCE_ID,
        acquisition_id="acq-test-insee-annual-national-accounts",
        acquired_at="2026-09-22T08:00:00Z",
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
    assert manifest.source_data_date == "2025-12-31"
    assert (snapshot / manifest.artifacts[0]["path"]).exists()


def test_declaration_carries_an_annual_schedule_and_no_placeholders(tmp_path: Path) -> None:
    package = tmp_path / SOURCE_ID
    shutil.copytree(Path("sources") / SOURCE_ID, package)

    declaration = load_source_declaration(package / "source.yaml")

    assert declaration.publication_schedule == {
        "period": "annual",
        "expected_within_days": 150,
        "grace_days": 14,
    }
    assert declaration.visibility == "public"
    assert [entry["id"] for entry in declaration.configuration["dataflows"]] == list(DATAFLOWS)
