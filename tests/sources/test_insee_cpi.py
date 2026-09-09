from __future__ import annotations

import hashlib
import json
from pathlib import Path
from urllib.error import HTTPError

import duckdb
import pytest

from pulse.archive import AcquisitionIntegrityError, archive_rows, reject_lfs_pointer
from pulse.cli import main
from pulse.contracts.snapshot import ContractError, validate_snapshot_manifest
from pulse.sources import (
    SourceDeclarationError,
    acquire_from_adapter,
    discover_sources,
    load_source_adapter,
    load_source_declaration,
)


FIXTURE = Path(__file__).parents[1] / "fixtures" / "insee-cpi" / "response.xml"
COMMITTED_SNAPSHOTS = Path(__file__).parents[2] / "snapshots" / "public" / "insee-cpi"
FIXTURE_PARQUET_SHA256 = "8106c9fd4a1e85b13b1a8ef3b8817208cbc72f5dd20943e4e90abf51865b2329"


def _write_snapshot_contract(package: Path, fields: str = "native: string") -> None:
    (package / "snapshot-contract.yaml").write_text(
        "contract_version: 1.0.0\n"
        "format: parquet\n"
        "compatible_additions: true\n"
        f"required_fields:\n  {fields}\n",
        encoding="utf-8",
    )


def _acquired():
    declaration = discover_sources()["insee-cpi"]
    return acquire_from_adapter(declaration, fixture=FIXTURE, live=False)


def _archive(root: Path, acquisition_id: str, rows: list[dict] | None = None):
    acquired = _acquired()
    return archive_rows(
        root=root,
        source_id="insee-cpi",
        acquisition_id=acquisition_id,
        acquired_at="2026-08-31T10:00:00Z",
        source_data_date=acquired.source_data_date,
        source_urls=acquired.source_urls,
        rows=rows or acquired.rows,
        decoder_version=acquired.decoder_version,
        licence="Licence Ouverte / Open Licence 2.0",
        attribution="Source: INSEE.",
    )


def test_discovery_keeps_provider_configuration_opaque() -> None:
    source = discover_sources()["insee-cpi"]
    assert source.visibility == "public"
    assert source.configuration["method"] == "INSEE BDM StructureSpecific SDMX-ML 2.1"
    assert [item["id"] for item in source.configuration["series"]] == [
        "011814056",
        "011814057",
        "011814058",
        "011813717",
        "011813718",
        "011813719",
        "011813864",
        "011813866",
        "011815633",
        "011814578",
        "011814509",
        "011815638",
        "011813664",
        "011813665",
        "011813666",
        "011813668",
        "011813906",
        "011813908",
        "011814579",
        "011813780",
        "011813782",
        "011814496",
    ]
    assert "measure" not in str(source.configuration)


def test_invalid_declaration_is_actionable(tmp_path: Path) -> None:
    declaration = tmp_path / "source.yaml"
    declaration.write_text("id: Insee CPI\n", encoding="utf-8")
    with pytest.raises(SourceDeclarationError, match="lowercase kebab-case"):
        load_source_declaration(declaration)


def test_shared_declaration_validation_does_not_impose_provider_shape(tmp_path: Path) -> None:
    declaration = tmp_path / "source.yaml"
    declaration.write_text(
        """id: another-source
name: Another public source
visibility: public
snapshot_contract: snapshot-contract.yaml
acquisition:
  provider_specific_key: anything
fetch_cadence: weekly
expected_publication_advance: weekly
publication_schedule: {period: monthly, expected_by_day_of_following_month: 15, grace_days: 7}
licence: Open licence
attribution: "Source: Example."
""",
        encoding="utf-8",
    )
    _write_snapshot_contract(tmp_path)
    loaded = load_source_declaration(declaration)
    assert loaded.configuration == {"provider_specific_key": "anything"}


def test_fixture_preserves_provider_attributes_as_strings() -> None:
    acquired = _acquired()
    assert acquired.source_data_date == "2026-08-01"
    assert {row["IDBANK"] for row in acquired.rows} == {
        item["id"] for item in discover_sources()["insee-cpi"].configuration["series"]
    }
    assert {"2025", "2026"} <= {
        row["TIME_PERIOD"] for row in acquired.rows if row["FREQ"] == "A"
    }
    headline_july = next(
        row for row in acquired.rows
        if row["IDBANK"] == "011814056" and row["TIME_PERIOD"] == "2026-07"
    )
    assert headline_july["OBS_VALUE"] == "102.67"
    assert headline_july["DATE_JO"] == "2026-08-15"
    assert all(isinstance(value, str) for row in acquired.rows for value in row.values())


def test_fixture_path_never_calls_network(monkeypatch: pytest.MonkeyPatch) -> None:
    declaration = discover_sources()["insee-cpi"]
    adapter = load_source_adapter(declaration)
    monkeypatch.setattr(adapter, "urlopen", lambda *args, **kwargs: pytest.fail("network called"))
    result = adapter.acquire(declaration.configuration, fixture=FIXTURE, live=False)
    assert result.rows


def test_http_failure_is_distinguishable_and_sanitized(monkeypatch: pytest.MonkeyPatch) -> None:
    declaration = discover_sources()["insee-cpi"]
    adapter = load_source_adapter(declaration)

    def fail(*args, **kwargs):
        raise HTTPError("https://example.invalid/private", 503, "unsafe upstream text", {}, None)

    monkeypatch.setattr(adapter, "urlopen", fail)
    with pytest.raises(adapter.InseeResponseError, match="HTTP request failed with status 503") as raised:
        adapter.acquire(declaration.configuration, fixture=None, live=True)
    assert "unsafe upstream text" not in str(raised.value)


def test_compatible_attribute_addition_is_preserved_and_changes_schema_hash(tmp_path: Path) -> None:
    baseline, _ = _archive(tmp_path / "baseline", "acq-baseline")
    payload = FIXTURE.read_text(encoding="utf-8").replace(
        'DECIMALS="2"', 'DECIMALS="2" PROVIDER_ADDITION="kept"', 1
    )
    evolved_fixture = tmp_path / "evolved.xml"
    evolved_fixture.write_text(payload, encoding="utf-8")
    declaration = discover_sources()["insee-cpi"]
    evolved = acquire_from_adapter(declaration, fixture=evolved_fixture, live=False)
    assert any(row.get("PROVIDER_ADDITION") == "kept" for row in evolved.rows)
    evolved_snapshot = archive_rows(
        root=tmp_path / "evolved",
        source_id=declaration.source_id,
        acquisition_id="acq-evolved",
        acquired_at="2026-08-31T10:00:00Z",
        source_data_date=evolved.source_data_date,
        source_urls=evolved.source_urls,
        rows=evolved.rows,
        decoder_version=evolved.decoder_version,
        licence=declaration.licence,
        attribution=declaration.attribution,
    )[0]
    baseline_manifest = json.loads((baseline / "snapshot.json").read_text())
    evolved_manifest = json.loads((evolved_snapshot / "snapshot.json").read_text())
    assert baseline_manifest["observed_schema_sha256"] != evolved_manifest["observed_schema_sha256"]


@pytest.mark.parametrize(
    ("old", "new", "message"),
    [
        (' IDBANK="011814057"', ' IDBANK="999999999"', "missing declared series 011814057"),
        (' TIME_PERIOD="2026-07"', ' PERIOD="2026-07"', "missing required TIME_PERIOD"),
        (' OBS_VALUE="102.67"', "", "missing required OBS_VALUE"),
    ],
)
def test_contract_failures_accept_no_rows(tmp_path: Path, old: str, new: str, message: str) -> None:
    broken = tmp_path / "broken.xml"
    broken.write_text(FIXTURE.read_text(encoding="utf-8").replace(old, new, 1), encoding="utf-8")
    declaration = discover_sources()["insee-cpi"]
    with pytest.raises(ValueError, match=message):
        acquire_from_adapter(declaration, fixture=broken, live=False)


def test_malformed_xml_is_rejected(tmp_path: Path) -> None:
    broken = tmp_path / "broken.xml"
    broken.write_text("<not-closed>", encoding="utf-8")
    with pytest.raises(ValueError, match="malformed SDMX-ML"):
        acquire_from_adapter(discover_sources()["insee-cpi"], fixture=broken, live=False)


def test_invalid_non_latest_period_is_rejected(tmp_path: Path) -> None:
    broken = tmp_path / "broken-period.xml"
    broken.write_text(
        FIXTURE.read_text(encoding="utf-8").replace(
            'TIME_PERIOD="2026-06"', 'TIME_PERIOD="0000-00"', 1
        ),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="monthly YYYY-MM"):
        acquire_from_adapter(discover_sources()["insee-cpi"], fixture=broken, live=False)


def test_archive_is_string_typed_deterministic_and_idempotent(tmp_path: Path) -> None:
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
    assert manifest["source_data_date"] == "2026-08-01"
    schema = duckdb.connect().execute(
        "DESCRIBE SELECT * FROM read_parquet(?)", [str(snapshot / "raw.parquet")]
    ).fetchall()
    assert {row[1] for row in schema} == {"VARCHAR"}


def test_fixture_acquisition_reproduces_committed_snapshot_bytes(tmp_path: Path) -> None:
    # Archive bytes are the inter-package contract: every snapshot.json records
    # this hash, and a dataset build consumes it. Determinism within one run
    # cannot catch a writer, DuckDB, or optional-dependency change that shifts
    # the encoding for everyone -- that surfaces later as an integrity conflict
    # against an acquisition ID that was previously fine. Pin it here instead.
    snapshot, _ = _archive(tmp_path, "acq-fixture-reproduction")
    produced = hashlib.sha256((snapshot / "raw.parquet").read_bytes()).hexdigest()
    assert produced == FIXTURE_PARQUET_SHA256
    committed = {
        json.loads(path.read_text(encoding="utf-8"))["artifacts"][0]["sha256"]
        for path in COMMITTED_SNAPSHOTS.glob("*/snapshot.json")
    }
    assert produced in committed, "fixture no longer reproduces any committed snapshot"


def test_conflict_does_not_replace_snapshot(tmp_path: Path) -> None:
    snapshot, _ = _archive(tmp_path, "acq-fixture-one")
    original = (snapshot / "raw.parquet").read_bytes()
    rows = _acquired().rows
    rows[0]["OBS_VALUE"] = "9.9"
    with pytest.raises(AcquisitionIntegrityError, match="acquisition-integrity conflict"):
        _archive(tmp_path, "acq-fixture-one", rows)
    assert (snapshot / "raw.parquet").read_bytes() == original


def test_later_duplicate_content_is_a_new_observation(tmp_path: Path) -> None:
    first, _ = _archive(tmp_path, "acq-fixture-one")
    later, _ = _archive(tmp_path, "acq-fixture-two")
    assert first != later
    assert json.loads((first / "snapshot.json").read_text())["artifacts"] == json.loads(
        (later / "snapshot.json").read_text()
    )["artifacts"]


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
    arguments = [
        "source",
        "acquire",
        "insee-cpi",
        "--fixture",
        str(FIXTURE),
        "--archive-root",
        str(tmp_path),
        "--acquisition-id",
        "acq-cli",
    ]
    assert main(arguments) == 0
    assert main(arguments) == 0
    assert "no-op" in capsys.readouterr().out


def test_cli_rejects_fixture_and_live_together() -> None:
    with pytest.raises(SystemExit) as raised:
        main(
            [
                "source",
                "acquire",
                "insee-cpi",
                "--fixture",
                str(FIXTURE),
                "--live",
            ]
        )
    assert raised.value.code == 2


def test_cli_dispatches_an_arbitrary_conforming_adapter(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package = tmp_path / "another-source"
    package.mkdir()
    declaration_path = package / "source.yaml"
    declaration_path.write_text(
        """id: another-source
name: Another source
visibility: public
snapshot_contract: snapshot-contract.yaml
acquisition: {native: value}
fetch_cadence: daily
expected_publication_advance: daily
publication_schedule: {period: monthly, expected_by_day_of_following_month: 15, grace_days: 7}
licence: Open
attribution: Example
""",
        encoding="utf-8",
    )
    _write_snapshot_contract(package)
    (package / "acquire.py").write_text(
        """from pulse.sources import AdapterAcquisition
def acquire(configuration, *, fixture, live):
    return AdapterAcquisition(rows=[{"native": str(configuration["native"])}], source_data_date=None, source_urls=["https://example.test/data"], decoder_version="example-v1")
""",
        encoding="utf-8",
    )
    declaration = load_source_declaration(declaration_path)
    monkeypatch.setattr("pulse.cli.discover_sources", lambda: {declaration.source_id: declaration})
    archive_root = tmp_path / "archive"
    assert main(
        ["source", "acquire", declaration.source_id, "--fixture", str(FIXTURE), "--archive-root", str(archive_root)]
    ) == 0
    assert next((archive_root / declaration.source_id).glob("*/snapshot.json")).is_file()


@pytest.mark.parametrize(
    ("rows_expression", "date_expression", "message"),
    [
        ('[{"native": "value"}]', '"2026-02-30"', "ISO calendar date"),
        ('[{"": "value"}]', "None", "field names must be non-empty strings"),
        ('[{1: "value"}]', "None", "field names must be non-empty strings"),
    ],
)
def test_cli_rejects_incompatible_adapter_output_before_archive_mutation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    rows_expression: str,
    date_expression: str,
    message: str,
) -> None:
    package = tmp_path / "invalid-adapter"
    package.mkdir()
    declaration_path = package / "source.yaml"
    declaration_path.write_text(
        """id: invalid-adapter
name: Invalid adapter
visibility: public
snapshot_contract: snapshot-contract.yaml
acquisition: {provider_native: value}
fetch_cadence: daily
expected_publication_advance: daily
publication_schedule: {period: monthly, expected_by_day_of_following_month: 15, grace_days: 7}
licence: Open
attribution: Example
""",
        encoding="utf-8",
    )
    _write_snapshot_contract(package)
    (package / "acquire.py").write_text(
        "from pulse.sources import AdapterAcquisition\n"
        "def acquire(configuration, *, fixture, live):\n"
        f"    return AdapterAcquisition(rows={rows_expression}, "
        f"source_data_date={date_expression}, "
        'source_urls=["https://example.test/data"], decoder_version="example-v1")\n',
        encoding="utf-8",
    )
    declaration = load_source_declaration(declaration_path)
    monkeypatch.setattr("pulse.cli.discover_sources", lambda: {declaration.source_id: declaration})
    archive_root = tmp_path / "archive"
    assert main(
        [
            "source",
            "acquire",
            declaration.source_id,
            "--fixture",
            str(FIXTURE),
            "--archive-root",
            str(archive_root),
        ]
    ) == 1
    assert message in capsys.readouterr().err
    assert not archive_root.exists()


def test_incompatible_adapter_fails_before_archive_mutation(tmp_path: Path) -> None:
    package = tmp_path / "broken-source"
    package.mkdir()
    declaration_path = package / "source.yaml"
    declaration_path.write_text(
        """id: broken-source
name: Broken source
visibility: public
snapshot_contract: snapshot-contract.yaml
acquisition: {native: value}
fetch_cadence: daily
expected_publication_advance: daily
publication_schedule: {period: monthly, expected_by_day_of_following_month: 15, grace_days: 7}
licence: Open
attribution: Example
""",
        encoding="utf-8",
    )
    _write_snapshot_contract(package)
    (package / "acquire.py").write_text("VALUE = 1\n", encoding="utf-8")
    with pytest.raises(SourceDeclarationError, match="must define callable acquire"):
        load_source_adapter(load_source_declaration(declaration_path))


def test_malformed_fixture_accepts_no_partial_snapshot(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    malformed = tmp_path / "malformed.xml"
    malformed.write_text("<broken>", encoding="utf-8")
    archive_root = tmp_path / "archive"
    assert main(
        ["source", "acquire", "insee-cpi", "--fixture", str(malformed), "--archive-root", str(archive_root)]
    ) == 1
    assert not archive_root.exists()
    assert "malformed SDMX-ML" in capsys.readouterr().err
