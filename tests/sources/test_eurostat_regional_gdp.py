"""Offline contract coverage for the Eurostat regional GDP source.

Every test runs against the recorded response, trimmed to a handful of regions
from 2019, with the network severed.
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


SOURCE_ID = "eurostat-regional-gdp"


@pytest.fixture(name="declaration")
def _declaration():
    return discover_sources()[SOURCE_ID]


@pytest.fixture(name="offline")
def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "socket.create_connection",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("network")),
    )


def _lines(declaration) -> list[str]:
    return (declaration.path.parent / "fixture.csv").read_text(encoding="utf-8").splitlines()


def _acquire(declaration, lines: list[str] | None = None, tmp_path: Path | None = None):
    fixture = declaration.path.parent / "fixture.csv"
    if lines is not None:
        fixture = tmp_path / "fixture.csv"
        fixture.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return acquire_from_adapter(declaration, fixture=fixture, live=False)


def _replace(lines: list[str], match: str, field: int, value: str) -> list[str]:
    changed = list(lines)
    index = next(position for position, line in enumerate(changed) if match in line)
    fields = changed[index].split(",")
    fields[field] = value
    changed[index] = ",".join(fields)
    return changed


def test_fixture_acquisition_is_offline_faithful_and_year_ended(declaration, offline) -> None:
    acquired = _acquire(declaration)

    assert acquired.source_urls == [declaration.configuration["url"]]
    assert acquired.source_data_date == "2024-12-31"
    assert all(assertion["passed"] for assertion in acquired.assertions)
    assert {row["unit"] for row in acquired.rows} == {"EUR_HAB", "MIO_EUR", "PPS_EU27_2020_HAB"}


def test_every_provider_column_survives_as_a_string(declaration, offline) -> None:
    row = next(row for row in _acquire(declaration).rows if row["geo"] == "FR101")

    assert set(declaration.snapshot_contract["required_fields"]) <= set(row)
    assert all(isinstance(value, str) for value in row.values())


def test_withheld_and_zero_values_are_not_suspect(declaration, offline) -> None:
    rows = _acquire(declaration).rows

    assert any(row["geo"] == "HUZZZ" and row["OBS_VALUE"] == "0" for row in rows)
    assert all(assertion["passed"] for assertion in _acquire(declaration).assertions)


def test_live_access_requires_an_explicit_opt_in(declaration, offline) -> None:
    with pytest.raises(SourceAcquisitionError, match="opt-in"):
        acquire_from_adapter(declaration, fixture=None, live=False)


@pytest.mark.parametrize(
    ("mutate", "expected"),
    (
        (lambda lines: [line for line in lines if ",MIO_EUR," not in line], "declared unit"),
        (lambda lines: _replace(lines, ",EUR_HAB,FR101,2024,", 3, "EUR_HAB_2015"), "declared unit"),
        (lambda lines: lines + [lines[1]], "repeats"),
        (lambda lines: _replace(lines, ",EUR_HAB,FR101,2024,", 5, "2024-Q4"), "non-annual"),
        (lambda lines: [lines[0].replace(",geo,", ",region,")] + lines[1:], "missing declared"),
        (lambda lines: lines[:1], "no observations"),
    ),
)
def test_incompatible_provider_responses_are_rejected_without_a_snapshot(
    declaration, offline, tmp_path: Path, mutate, expected: str
) -> None:
    with pytest.raises(SourceAcquisitionError, match=expected):
        _acquire(declaration, mutate(_lines(declaration)), tmp_path)


def test_an_unexplained_empty_value_is_suspect(declaration, offline, tmp_path: Path) -> None:
    lines = _replace(_lines(declaration), ",EUR_HAB,FR101,2020,", 6, "")

    acquired = _acquire(declaration, lines, tmp_path)

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_empty_value_carries_a_status_or_flag"]


def test_a_negative_value_is_suspect_rather_than_rejected(declaration, offline, tmp_path: Path) -> None:
    lines = _replace(_lines(declaration), ",EUR_HAB,FR101,2023,", 6, "-5")

    acquired = _acquire(declaration, lines, tmp_path)

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["every_published_value_is_non_negative"]


def test_an_edge_set_by_one_early_country_is_suspect(declaration, offline, tmp_path: Path) -> None:
    lines = _lines(declaration)
    early = next(line for line in lines if ",EUR_HAB,FR,2024," in line).replace(",2024,", ",2025,")

    acquired = _acquire(declaration, lines + [early], tmp_path)

    failed = [item["check"] for item in acquired.assertions if not item["passed"]]
    assert failed == ["most_countries_publish_the_latest_year"]
    assert acquired.source_data_date == "2025-12-31"


def test_snapshot_archives_a_manifest_that_matches_its_raw_parquet(
    declaration, offline, tmp_path: Path
) -> None:
    acquired = _acquire(declaration)

    snapshot, no_op = archive_rows(
        root=tmp_path,
        source_id=SOURCE_ID,
        acquisition_id="acq-test-eurostat-regional-gdp",
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
    assert manifest.source_data_date == "2024-12-31"


def test_declaration_carries_an_annual_schedule_and_no_placeholders(tmp_path: Path) -> None:
    package = tmp_path / SOURCE_ID
    shutil.copytree(Path("sources") / SOURCE_ID, package)

    declaration = load_source_declaration(package / "source.yaml")

    assert declaration.publication_schedule == {
        "period": "annual",
        "expected_within_days": 411,
        "grace_days": 14,
    }
    assert declaration.visibility == "public"
    assert "__" not in (package / "source.yaml").read_text(encoding="utf-8")
