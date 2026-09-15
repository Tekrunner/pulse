from __future__ import annotations

import json
from pathlib import Path
import shutil

import pytest

from pulse.archive import AcquisitionIntegrityError, ArchiveError, archive_rows
from pulse.catalog import compile_status_catalog
from pulse.sources import (
    SourceDeclarationError,
    acquire_from_adapter,
    discover_sources,
    load_source_declaration,
)


ROOT = Path(__file__).parents[2]
SKILL_ASSETS = ROOT / ".agents/skills/pulse-add-source/assets"


def _configure_asset_schedule(package: Path) -> None:
    """Inject explicit test evidence; the shipped asset itself stays non-runnable."""
    declaration = package / "source.yaml"
    content = declaration.read_text(encoding="utf-8")
    replacements = {
        "__DOCUMENTED_FETCH_CADENCE__": "monthly, per test provider evidence",
        "__DOCUMENTED_EXPECTED_ADVANCE__": "monthly, per test provider evidence",
        "__DOCUMENTED_PERIOD__": "monthly",
        "__DOCUMENTED_DAYS_AFTER_PERIOD_END__": "11",
        "__EVIDENCED_GRACE_DAYS__": "3",
    }
    for placeholder, evidenced_value in replacements.items():
        content = content.replace(placeholder, evidenced_value)
    declaration.write_text(content, encoding="utf-8")


def _package(root: Path, source_id: str, *, snapshot_format: str = "original-file") -> Path:
    package = root / source_id
    package.mkdir(parents=True)
    (package / "source.yaml").write_text(
        f"""id: {source_id}
name: Neutral source
visibility: public
snapshot_contract: snapshot-contract.yaml
acquisition: {{url: https://example.test/data.csv}}
fetch_cadence: monthly
expected_publication_advance: monthly
publication_schedule: {{period: monthly, expected_within_days: 15, grace_days: 7}}
licence: Open
attribution: Example
""",
        encoding="utf-8",
    )
    required = "{}" if snapshot_format == "original-file" else "\n  value: string"
    (package / "snapshot-contract.yaml").write_text(
        f"contract_version: 1.0.0\nformat: {snapshot_format}\n"
        f"compatible_additions: true\nrequired_fields: {required}\n",
        encoding="utf-8",
    )
    return package


def test_original_file_snapshot_preserves_bytes_and_assertions(tmp_path: Path) -> None:
    payload = b"period,value\n2026-08,12.5\n"
    target, no_op = archive_rows(
        root=tmp_path,
        source_id="neutral-file",
        acquisition_id="acq-neutral",
        acquired_at="2026-09-12T10:00:00Z",
        source_data_date="2026-08-01",
        source_urls=["https://example.test/data.csv"],
        rows=None,
        original_bytes=payload,
        original_filename="provider-export.CSV",
        assertions=[{"check": "latest-period-advanced", "passed": False}],
        decoder_version="csv-v1",
        licence="Open",
        attribution="Example",
    )

    manifest = json.loads((target / "snapshot.json").read_text(encoding="utf-8"))
    assert not no_op
    assert manifest["format"] == "original-file"
    assert manifest["artifacts"][0]["path"] == "raw.csv"
    assert (target / "raw.csv").read_bytes() == payload
    assert manifest["assertions"] == [{"check": "latest-period-advanced", "passed": False}]


def test_original_file_lfs_pointer_is_rejected_without_snapshot(tmp_path: Path) -> None:
    with pytest.raises(ArchiveError, match="LFS pointer"):
        archive_rows(
            root=tmp_path,
            source_id="neutral-file",
            acquisition_id="acq-neutral",
            acquired_at="2026-09-12T10:00:00Z",
            source_data_date=None,
            source_urls=["https://example.test/data.csv"],
            rows=None,
            original_bytes=b"version https://git-lfs.github.com/spec/v1\n",
            original_filename="data.csv",
            decoder_version="csv-v1",
            licence="Open",
            attribution="Example",
        )
    assert not list((tmp_path / "neutral-file").glob("*/snapshot.json"))


def test_retry_with_changed_assertion_evidence_conflicts(tmp_path: Path) -> None:
    options = dict(
        root=tmp_path,
        source_id="neutral-file",
        acquisition_id="acq-neutral",
        acquired_at="2026-09-12T10:00:00Z",
        source_data_date="2026-08-01",
        source_urls=["https://example.test/data.csv"],
        rows=None,
        original_bytes=b"period,value\n2026-08,12.5\n",
        original_filename="data.csv",
        decoder_version="csv-v1",
        licence="Open",
        attribution="Example",
    )
    archive_rows(**options, assertions=[{"check": "plausibility", "passed": True}])
    with pytest.raises(AcquisitionIntegrityError, match="different content or evidence"):
        archive_rows(**options, assertions=[{"check": "plausibility", "passed": False}])


def test_discovery_rejects_identity_directory_collision(tmp_path: Path) -> None:
    _package(tmp_path, "wrong-directory")
    path = tmp_path / "wrong-directory/source.yaml"
    path.write_text(path.read_text(encoding="utf-8").replace("id: wrong-directory", "id: other-id"), encoding="utf-8")
    with pytest.raises(ValueError, match="match its package directory"):
        discover_sources(tmp_path)


def test_standalone_public_source_is_visible_and_suspect(tmp_path: Path) -> None:
    sources = tmp_path / "sources"
    _package(sources, "standalone-source")
    archive = tmp_path / "snapshots"
    archive_rows(
        root=archive,
        source_id="standalone-source",
        acquisition_id="acq-neutral",
        acquired_at="2026-09-12T10:00:00Z",
        source_data_date="2026-08-01",
        source_urls=["https://example.test/data.csv"],
        rows=None,
        original_bytes=b"period,value\n2026-08,12.5\n",
        original_filename="data.csv",
        assertions=({"check": "plausibility", "passed": False},),
        decoder_version="csv-v1",
        licence="Open",
        attribution="Example",
    )
    datasets = tmp_path / "datasets"
    datasets.mkdir()
    publish = tmp_path / "publish"
    (publish / "data").mkdir(parents=True)

    catalog = compile_status_catalog(
        sources_root=sources,
        datasets_root=datasets,
        archive_root=archive,
        publish_root=publish,
        generated_at="2026-09-12T10:00:00Z",
    )

    entry = catalog["pipelines"]["source:standalone-source"]
    assert entry["state"] == "suspect"
    assert entry["assertions"] == [{"check": "plausibility", "affectedColumns": []}]
    assert entry["latestUsableOutput"]["artifactKind"] == "snapshot"


def test_file_adapter_contract_accepts_only_original_bytes(tmp_path: Path) -> None:
    package = _package(tmp_path, "file-source")
    fixture = package / "fixture.csv"
    fixture.write_bytes(b"native,bytes\n")
    (package / "acquire.py").write_text(
        "from pulse.sources import AdapterAcquisition\n"
        "def acquire(configuration, *, fixture, live):\n"
        "    return AdapterAcquisition(None, None, [configuration['url']], 'v1', original_bytes=fixture.read_bytes(), original_filename=fixture.name)\n",
        encoding="utf-8",
    )
    acquired = acquire_from_adapter(load_source_declaration(package / "source.yaml"), fixture=fixture, live=False)
    assert acquired.original_bytes == b"native,bytes\n"


@pytest.mark.parametrize("asset", ("api-source", "file-source"))
def test_neutral_source_assets_require_schedule_evidence_before_use(
    tmp_path: Path, asset: str
) -> None:
    package = tmp_path / "source"
    shutil.copytree(SKILL_ASSETS / asset, package)

    with pytest.raises(SourceDeclarationError, match="unresolved placeholder"):
        load_source_declaration(package / "source.yaml")


def test_neutral_workflow_has_no_reusable_schedule_default() -> None:
    workflow = (SKILL_ASSETS / "source-refresh.yml").read_text(encoding="utf-8")

    assert 'cron: "__DERIVED_UTC_CRON__"' in workflow
    assert 'cron: "17 6 23 * *"' not in workflow


@pytest.mark.parametrize(
    ("asset", "source_id", "artifact"),
    (("api-source", "example-public-source", "raw.parquet"), ("file-source", "example-public-file", "raw.csv")),
)
def test_neutral_skill_assets_run_to_snapshot_without_datasets(
    tmp_path: Path, asset: str, source_id: str, artifact: str
) -> None:
    source_root = tmp_path / "sources"
    package = source_root / source_id
    shutil.copytree(SKILL_ASSETS / asset, package)
    _configure_asset_schedule(package)
    declaration = discover_sources(source_root)[source_id]
    acquired = acquire_from_adapter(
        declaration, fixture=package / ("fixture.json" if asset == "api-source" else "fixture.csv"), live=False
    )
    snapshot, _ = archive_rows(
        root=tmp_path / "archive",
        source_id=source_id,
        acquisition_id="acq-asset",
        acquired_at="2026-09-12T10:00:00Z",
        source_data_date=acquired.source_data_date,
        source_urls=acquired.source_urls,
        rows=acquired.rows,
        original_bytes=acquired.original_bytes,
        original_filename=acquired.original_filename,
        assertions=acquired.assertions,
        decoder_version=acquired.decoder_version,
        licence=declaration.licence,
        attribution=declaration.attribution,
    )
    assert (snapshot / artifact).is_file()
    assert not (tmp_path / "datasets").exists()
