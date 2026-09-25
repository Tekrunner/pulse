"""Offline contract coverage for the INSEE quarterly national-accounts GDP source.

Every test runs against the recorded fixture with the network severed, so a
regression here is a regression in the adapter rather than in the provider.
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


SOURCE_ID = "insee-quarterly-national-accounts"
DECLARED_SERIES = {"011794860", "011794859", "011794844"}


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


def _mutated(declaration, tmp_path: Path, transform) -> Path:
    fixture = tmp_path / "fixture.xml"
    text = (declaration.path.parent / "fixture.xml").read_text(encoding="utf-8")
    fixture.write_text(transform(text), encoding="utf-8")
    return fixture


def test_fixture_acquisition_is_offline_faithful_and_quarter_ended(declaration, offline) -> None:
    acquired = _acquire(declaration)

    assert acquired.source_urls == [declaration.configuration["url"]]
    assert {row["IDBANK"] for row in acquired.rows} == DECLARED_SERIES
    assert acquired.source_data_date == "2026-06-30"
    assert all(assertion["passed"] for assertion in acquired.assertions)


def test_every_declared_provider_field_survives_acquisition_unrenamed(declaration, offline) -> None:
    rows = _acquire(declaration).rows

    required = set(declaration.snapshot_contract["required_fields"])
    assert all(required <= set(row) for row in rows)
    assert {"TITLE_EN", "OBS_STATUS", "DECIMALS"} <= set(rows[0])
    assert all(isinstance(value, str) for row in rows for value in row.values())


def test_live_access_requires_an_explicit_opt_in(declaration, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(declaration, fixture=None, live=False)


def _drop_first_series(text: str) -> str:
    first = text.index("<Series ")
    return text[:first] + text[text.index("</Series>", first) + len("</Series>"):]


def _duplicate_first_series(text: str) -> str:
    first = text.index("<Series ")
    end = text.index("</Series>", first) + len("</Series>")
    return text[:end] + text[first:end] + text[end:]


@pytest.mark.parametrize(
    ("transform", "expected"),
    (
        (_drop_first_series, "scope does not match"),
        (_duplicate_first_series, "duplicate"),
        (lambda text: text.replace("Valeur aux prix courants", "Valeur renamed upstream"), "renamed"),
        (lambda text: text.replace('TIME_PERIOD="2026-Q2"', 'TIME_PERIOD="2026-06"', 1), "period format"),
        (lambda _text: "this is not the SDMX response", "well-formed"),
    ),
)
def test_incompatible_provider_responses_are_rejected_without_a_snapshot(
    declaration, offline, tmp_path: Path, transform, expected: str
) -> None:
    with pytest.raises(SourceAcquisitionError, match=expected):
        _acquire(declaration, _mutated(declaration, tmp_path, transform))


def test_a_series_left_a_quarter_behind_is_suspect(declaration, offline, tmp_path: Path) -> None:
    def drop_latest_of_first_series(text: str) -> str:
        first = text.index("<Series ")
        latest = text.index('<Obs TIME_PERIOD="2026-Q2"', first)
        return text[:latest] + text[text.index("/>", latest) + 2:]

    acquired = _acquire(declaration, _mutated(declaration, tmp_path, drop_latest_of_first_series))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_declared_series_reaches_the_same_latest_quarter"]
    assert acquired.source_data_date == "2026-06-30"


def test_a_non_positive_level_is_suspect_rather_than_rejected(
    declaration, offline, tmp_path: Path
) -> None:
    def zero_a_level(text: str) -> str:
        series = text.index('IDBANK="011794859"')
        at = text.index('OBS_VALUE="', series) + len('OBS_VALUE="')
        return text[:at] + "0" + text[text.index('"', at):]

    acquired = _acquire(declaration, _mutated(declaration, tmp_path, zero_a_level))

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_gdp_level_is_positive"]
    assert acquired.rows


def test_snapshot_archives_a_manifest_that_matches_its_raw_parquet(
    declaration, offline, tmp_path: Path
) -> None:
    acquired = _acquire(declaration)

    snapshot, no_op = archive_rows(
        root=tmp_path,
        source_id=SOURCE_ID,
        acquisition_id="acq-test-insee-quarterly-national-accounts",
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
    assert manifest.source_data_date == "2026-06-30"
    assert (snapshot / manifest.artifacts[0]["path"]).exists()


def test_declaration_carries_a_quarterly_schedule_and_no_placeholders(tmp_path: Path) -> None:
    package = tmp_path / SOURCE_ID
    shutil.copytree(Path("sources") / SOURCE_ID, package)

    declaration = load_source_declaration(package / "source.yaml")

    assert declaration.publication_schedule == {
        "period": "quarterly",
        "expected_within_days": 31,
        "grace_days": 7,
    }
    assert declaration.visibility == "public"
    assert declaration.configuration["url"].startswith("https://")
