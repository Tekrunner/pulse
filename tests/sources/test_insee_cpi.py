from __future__ import annotations

import json
from pathlib import Path

import pytest

from pulse.archive import AcquisitionIntegrityError, archive_rows, reject_lfs_pointer
from pulse.cli import main
from pulse.contracts.snapshot import ContractError, validate_snapshot_manifest
from pulse.sources import SourceDeclarationError, discover_sources, load_source_adapter, load_source_declaration


FIXTURE = Path(__file__).parents[1] / "fixtures" / "insee-cpi" / "response.json"


def _rows() -> tuple[list[dict], str | None]:
    adapter = load_source_adapter(discover_sources()["insee-cpi"])
    return adapter.decode_response(json.loads(FIXTURE.read_text(encoding="utf-8")))


def _archive(root: Path, acquisition_id: str, rows: list[dict] | None = None):
    decoded, source_date = _rows()
    return archive_rows(
        root=root, source_id="insee-cpi", acquisition_id=acquisition_id,
        acquired_at="2026-08-28T10:00:00Z", source_data_date=source_date,
        source_urls=[
            "https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/011814056?format=sdmx-json",
            "https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/011814058?format=sdmx-json",
            "https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/011814057?format=sdmx-json",
        ],
        rows=rows or decoded, decoder_version=load_source_adapter(discover_sources()["insee-cpi"]).DECODER_VERSION,
        licence="Licence Ouverte / Open Licence 2.0", attribution="Source: INSEE.",
    )


def test_discovery_is_registry_free_and_complete() -> None:
    source = discover_sources()["insee-cpi"]
    assert source.visibility == "public"
    assert {(series["id"], series["measure"]) for series in source.selected_series} == {
        ("011814056", "cpi-level"), ("011814058", "cpi-year-on-year"), ("011814057", "cpi-month-on-month")
    }
    assert source.acquisition["method"] == "BDM/SDMX JSON series responses"


def test_invalid_declaration_is_actionable(tmp_path: Path) -> None:
    declaration = tmp_path / "source.yaml"
    declaration.write_text("id: Insee CPI\n", encoding="utf-8")
    with pytest.raises(SourceDeclarationError, match="lowercase kebab-case"):
        load_source_declaration(declaration)


def test_shared_declaration_validation_is_not_insee_specific(tmp_path: Path) -> None:
    declaration = tmp_path / "source.yaml"
    declaration.write_text(
        """id: another-source
name: Another public source
visibility: public
acquisition:
  method: JSON API
  urls: [https://example.test/data]
fetch_cadence: weekly
expected_publication_advance: weekly
licence: Open licence
attribution: "Source: Example."
selected_series:
  - id: example-series
    name: Example series
""",
        encoding="utf-8",
    )
    assert load_source_declaration(declaration).source_id == "another-source"


def test_fixture_faithfully_covers_each_selected_measure() -> None:
    source = discover_sources()["insee-cpi"]
    adapter = load_source_adapter(source)
    rows, _ = _rows()
    adapter.ensure_selected_series(rows, source.selected_series)
    assert {row["SERIES"] for row in rows} == {"011814056", "011814057", "011814058"}


def test_incomplete_series_response_is_rejected() -> None:
    source = discover_sources()["insee-cpi"]
    adapter = load_source_adapter(source)
    rows, _ = _rows()
    with pytest.raises(adapter.InseeResponseError, match="missing selected series 011814057"):
        adapter.ensure_selected_series([row for row in rows if row["SERIES"] != "011814057"], source.selected_series)


def test_archive_is_deterministic_and_idempotent(tmp_path: Path) -> None:
    snapshot, no_op = _archive(tmp_path, "acq-fixture-one")
    manifest_bytes = (snapshot / "snapshot.json").read_bytes()
    raw_bytes = (snapshot / "raw.parquet").read_bytes()
    repeat, no_op_repeat = _archive(tmp_path, "acq-fixture-one")
    assert not no_op
    assert no_op_repeat
    assert repeat == snapshot
    assert (snapshot / "snapshot.json").read_bytes() == manifest_bytes
    assert (snapshot / "raw.parquet").read_bytes() == raw_bytes
    manifest = json.loads(manifest_bytes)
    assert manifest["schema_id"] == "pulse.snapshot"
    assert manifest["source_data_date"] == "2026-06-01"
    assert manifest["artifacts"][0]["path"] == "raw.parquet"


def test_conflict_does_not_replace_snapshot(tmp_path: Path) -> None:
    snapshot, _ = _archive(tmp_path, "acq-fixture-one")
    original = (snapshot / "raw.parquet").read_bytes()
    rows, _ = _rows()
    rows[0]["OBS_VALUE"] = 9.9
    with pytest.raises(AcquisitionIntegrityError, match="acquisition-integrity conflict"):
        _archive(tmp_path, "acq-fixture-one", rows)
    assert (snapshot / "raw.parquet").read_bytes() == original


def test_later_duplicate_content_is_a_new_observation(tmp_path: Path) -> None:
    first, _ = _archive(tmp_path, "acq-fixture-one")
    later, _ = _archive(tmp_path, "acq-fixture-two")
    assert first != later
    assert json.loads((first / "snapshot.json").read_text())["artifacts"] == json.loads((later / "snapshot.json").read_text())["artifacts"]


def test_lfs_pointer_is_rejected(tmp_path: Path) -> None:
    pointer = tmp_path / "raw.parquet"
    pointer.write_text("version https://git-lfs.github.com/spec/v1\noid sha256:abc\n", encoding="utf-8")
    with pytest.raises(Exception, match="unresolved Git LFS pointer"):
        reject_lfs_pointer(pointer)


def test_manifest_rejects_unsupported_major_version(tmp_path: Path) -> None:
    snapshot, _ = _archive(tmp_path, "acq-fixture-one")
    manifest = json.loads((snapshot / "snapshot.json").read_text(encoding="utf-8"))
    manifest["schema_version"] = "2.0.0"
    with pytest.raises(ContractError, match="unsupported major version"):
        validate_snapshot_manifest(manifest)


def test_cli_fixture_is_offline_and_retryable(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    arguments = ["source", "acquire", "insee-cpi", "--fixture", str(FIXTURE), "--archive-root", str(tmp_path), "--acquisition-id", "acq-cli"]
    assert main(arguments) == 0
    assert main(arguments) == 0
    assert "no-op" in capsys.readouterr().out


def test_malformed_fixture_accepts_no_partial_snapshot(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    malformed = tmp_path / "malformed.json"
    malformed.write_text('{"data": "not rows"}', encoding="utf-8")
    archive_root = tmp_path / "archive"
    assert main(["source", "acquire", "insee-cpi", "--fixture", str(malformed), "--archive-root", str(archive_root)]) == 1
    assert not archive_root.exists()
    assert "non-empty object 'data' array" in capsys.readouterr().err
