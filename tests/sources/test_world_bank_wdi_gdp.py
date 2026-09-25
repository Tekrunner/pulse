"""Offline contract coverage for the World Bank WDI GDP source.

Every test runs against the recorded provider response with the network severed.
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


SOURCE_ID = "world-bank-wdi-gdp"
INDICATORS = {"NY.GDP.MKTP.CD", "NY.GDP.MKTP.KD", "NY.GDP.MKTP.CN", "NY.GDP.MKTP.KN", "NY.GDP.DEFL.ZS", "PA.NUS.FCRF"}


@pytest.fixture(name="declaration")
def _declaration():
    return discover_sources()[SOURCE_ID]


@pytest.fixture(name="offline")
def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "socket.create_connection",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("network")),
    )


def _payload(declaration) -> list:
    return json.loads((declaration.path.parent / "fixture.json").read_text(encoding="utf-8"))


def _acquire(declaration, payload=None, tmp_path: Path | None = None):
    fixture = declaration.path.parent / "fixture.json"
    if payload is not None:
        fixture = tmp_path / "fixture.json"
        fixture.write_text(payload if isinstance(payload, str) else json.dumps(payload), encoding="utf-8")
    return acquire_from_adapter(declaration, fixture=fixture, live=False)


def test_fixture_acquisition_is_offline_faithful_and_year_ended(declaration, offline) -> None:
    acquired = _acquire(declaration)

    assert acquired.source_urls == [declaration.configuration["url"]]
    assert {row["indicator.id"] for row in acquired.rows} == INDICATORS
    assert len(acquired.rows) == len(INDICATORS) * 66
    assert acquired.source_data_date == "2025-12-31"
    assert all(assertion["passed"] for assertion in acquired.assertions)


def test_provider_fields_are_flattened_with_their_own_names_and_types(declaration, offline) -> None:
    row = _acquire(declaration).rows[0]

    assert set(declaration.snapshot_contract["required_fields"]) <= set(row)
    assert isinstance(row["value"], float)
    assert isinstance(row["decimal"], int)
    assert row["countryiso3code"] == "FRA"


def test_live_access_requires_an_explicit_opt_in(declaration, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(declaration, fixture=None, live=False)


def _without_indicator(payload):
    payload[1] = [row for row in payload[1] if row["indicator"]["id"] != "PA.NUS.FCRF"]
    payload[0]["total"] = len(payload[1])
    return payload


def _renamed(payload):
    for row in payload[1]:
        if row["indicator"]["id"] == "NY.GDP.MKTP.CD":
            row["indicator"]["value"] = "GDP (current US$, renamed)"
    return payload


def _duplicated(payload):
    payload[1].append(dict(payload[1][0]))
    payload[0]["total"] = len(payload[1])
    return payload


def _truncated(payload):
    payload[0]["total"] = len(payload[1]) + 1
    return payload


def _other_country(payload):
    payload[1][0]["countryiso3code"] = "DEU"
    return payload


@pytest.mark.parametrize(
    ("mutation", "expected"),
    (
        (_without_indicator, "scope does not match"),
        (_renamed, "renamed"),
        (_duplicated, "duplicate"),
        (_truncated, "more than one page"),
        (_other_country, "another country"),
        (lambda _payload: [{"message": [{"id": "120", "value": "Invalid value"}]}], "incompatible"),
        (lambda _payload: "this is not JSON", "incompatible"),
    ),
)
def test_incompatible_provider_responses_are_rejected_without_a_snapshot(
    declaration, offline, tmp_path: Path, mutation, expected: str
) -> None:
    with pytest.raises(SourceAcquisitionError, match=expected):
        _acquire(declaration, mutation(_payload(declaration)), tmp_path)


def test_an_indicator_left_a_year_behind_is_suspect(declaration, offline, tmp_path: Path) -> None:
    payload = _payload(declaration)
    for row in payload[1]:
        if row["indicator"]["id"] == "PA.NUS.FCRF" and row["date"] == "2025":
            row["value"] = None

    acquired = _acquire(declaration, payload, tmp_path)

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_declared_indicator_reaches_the_latest_year"]
    assert acquired.source_data_date == "2025-12-31"


def test_a_non_positive_value_is_suspect_rather_than_rejected(declaration, offline, tmp_path: Path) -> None:
    payload = _payload(declaration)
    payload[1][5]["value"] = -1.0

    acquired = _acquire(declaration, payload, tmp_path)

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_published_value_is_positive"]


def test_snapshot_archives_a_manifest_that_matches_its_raw_parquet(
    declaration, offline, tmp_path: Path
) -> None:
    acquired = _acquire(declaration)

    snapshot, no_op = archive_rows(
        root=tmp_path,
        source_id=SOURCE_ID,
        acquisition_id="acq-test-world-bank-wdi-gdp",
        acquired_at="2026-09-23T08:00:00Z",
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
        "expected_within_days": 182,
        "grace_days": 21,
    }
    assert declaration.visibility == "public"
    assert declaration.configuration["url"].startswith("https://")
