"""Focused fail-closed coverage for the offline public-site orchestrator."""

from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
from types import SimpleNamespace
import subprocess

import pytest

from pulse import public
from pulse.catalog import public_dataset_closure
from pulse.datasets import DatasetError


DATASET_ID = "public-dataset"
SOURCE_ID = "public-source"
LFS_POINTER = b"version https://git-lfs.github.com/spec/v1\noid sha256:" + b"0" * 64 + b"\nsize 4\n"


def _declarations(*, dataset_visibility: str = "public", source_visibility: str = "public"):
    dataset = SimpleNamespace(
        dataset_id=DATASET_ID,
        source_id=SOURCE_ID,
        visibility=dataset_visibility,
    )
    source = SimpleNamespace(source_id=SOURCE_ID, visibility=source_visibility)
    return {DATASET_ID: dataset}, {SOURCE_ID: source}


def _inputs(tmp_path: Path) -> tuple[Path, Path]:
    archive = tmp_path / "snapshots/public"
    publish = tmp_path / "publish/public"
    raw = archive / SOURCE_ID / "acq-one-deadbeef0000/raw.parquet"
    raw.parent.mkdir(parents=True)
    raw.write_bytes(b"PAR1 deterministic snapshot bytes")
    manifest = {
        "schema_id": "pulse.snapshot",
        "schema_version": "1.0.0",
        "source_id": SOURCE_ID,
        "acquisition_id": "acq-one",
        "snapshot_id": "acq-one-deadbeef0000",
        "acquired_at": "2026-09-10T13:30:40Z",
        "source_data_date": "2026-08-01",
        "source_urls": ["https://example.test/data"],
        "artifacts": [{"path": "raw.parquet", "sha256": sha256(raw.read_bytes()).hexdigest()}],
        "observed_schema_sha256": "a" * 64,
        "decoder_version": "fixture-v1",
        "tool_versions": {"fixture": "1"},
        "licence": "Open test licence",
        "attribution": "Test source",
    }
    (raw.parent / "snapshot.json").write_text(
        json.dumps(manifest, sort_keys=True) + "\n", encoding="utf-8"
    )
    parquet = publish / "data" / DATASET_ID / "dataset.parquet"
    parquet.parent.mkdir(parents=True)
    parquet.write_bytes(b"PAR1 deterministic publication bytes")
    return archive, publish


def _patch_declarations(
    monkeypatch: pytest.MonkeyPatch,
    *,
    datasets: dict[str, object],
    sources: dict[str, object],
) -> None:
    monkeypatch.setattr(public, "discover_datasets", lambda: datasets)
    monkeypatch.setattr(public, "discover_sources", lambda: sources)


def test_public_closure_includes_only_explicit_public_report_datasets(tmp_path: Path) -> None:
    reports = tmp_path / "reports"
    public_report = reports / "public/report.yml"
    private_report = reports / "private/report.yml"
    public_report.parent.mkdir(parents=True)
    private_report.parent.mkdir(parents=True)
    public_report.write_text(
        "visibility: public\ndatasets: [public-dataset, shared-dataset]\n",
        encoding="utf-8",
    )
    private_report.write_text(
        "visibility: private\ndatasets: [private-dataset, shared-dataset]\n",
        encoding="utf-8",
    )

    assert public_dataset_closure(reports) == ("public-dataset", "shared-dataset")


def test_public_boundary_accepts_complete_positive_public_lineage(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    archive, publish = _inputs(tmp_path)
    datasets, sources = _declarations()
    _patch_declarations(monkeypatch, datasets=datasets, sources=sources)

    selected, selected_sources, timestamp = public._validate_public_inputs(
        (DATASET_ID,), archive_root=archive, publish_root=publish
    )

    assert selected == datasets
    assert selected_sources == sources
    assert timestamp == "2026-09-10T13:30:40Z"


@pytest.mark.parametrize("state", ("missing-dataset", "private-dataset", "missing-source", "private-source"))
def test_public_lineage_failures_are_rejected_before_building(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, state: str
) -> None:
    archive, publish = _inputs(tmp_path)
    datasets, sources = _declarations(
        dataset_visibility="private" if state == "private-dataset" else "public",
        source_visibility="private" if state == "private-source" else "public",
    )
    if state == "missing-dataset":
        datasets = {}
    if state == "missing-source":
        sources = {}
    _patch_declarations(monkeypatch, datasets=datasets, sources=sources)

    with pytest.raises(public.PublicBuildError, match="unavailable public (?:dataset|source lineage)"):
        public._validate_public_inputs((DATASET_ID,), archive_root=archive, publish_root=publish)


@pytest.mark.parametrize("pointer", ("publication", "snapshot"))
def test_public_boundary_rejects_unresolved_lfs_objects_actionably(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, pointer: str
) -> None:
    archive, publish = _inputs(tmp_path)
    datasets, sources = _declarations()
    _patch_declarations(monkeypatch, datasets=datasets, sources=sources)
    target = (
        publish / "data" / DATASET_ID / "dataset.parquet"
        if pointer == "publication"
        else next((archive / SOURCE_ID).glob("*/raw.parquet"))
    )
    target.write_bytes(LFS_POINTER)

    with pytest.raises(public.PublicBuildError, match="materialize Git LFS objects first"):
        public._validate_public_inputs((DATASET_ID,), archive_root=archive, publish_root=publish)


def _git(repository: Path, *arguments: str) -> str:
    return subprocess.run(
        ["git", *arguments],
        cwd=repository,
        text=True,
        capture_output=True,
        check=True,
    ).stdout


def _repository(tmp_path: Path) -> Path:
    repository = tmp_path / "repository"
    repository.mkdir()
    _git(repository, "init", "-b", "main")
    _git(repository, "config", "user.name", "Pulse Test")
    _git(repository, "config", "user.email", "pulse@example.test")
    (repository / "tracked.txt").write_text("baseline\n", encoding="utf-8")
    _git(repository, "add", "-A")
    _git(repository, "commit", "-m", "baseline")
    return repository


def test_failed_candidate_build_retains_predecessor_and_repository_state(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repository = _repository(tmp_path)
    output = tmp_path / "existing-site"
    output.mkdir()
    predecessor = output / "artifact-inventory.json"
    predecessor.write_text("predecessor\n", encoding="utf-8")
    declaration = SimpleNamespace(dataset_id=DATASET_ID)
    monkeypatch.setattr(public, "ROOT", repository)
    monkeypatch.setattr(public, "public_dataset_closure", lambda: (DATASET_ID,))
    monkeypatch.setattr(
        public,
        "_validate_public_inputs",
        lambda *_args, **_kwargs: ({DATASET_ID: declaration}, {}, "2026-09-10T13:30:40Z"),
    )

    def reject_candidate(*_args, **_kwargs):
        raise DatasetError("candidate rejected safely")

    monkeypatch.setattr(public, "build_dataset", reject_candidate)
    before = _git(repository, "status", "--porcelain", "--untracked-files=all")

    with pytest.raises(public.PublicBuildError, match="candidate rejected safely"):
        public.build_public_site(
            output=output,
            archive_root=tmp_path / "archive",
            committed_publish_root=tmp_path / "publish",
        )

    assert predecessor.read_text(encoding="utf-8") == "predecessor\n"
    assert _git(repository, "status", "--porcelain", "--untracked-files=all") == before


def test_public_orchestrator_replay_is_byte_equivalent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repository = _repository(tmp_path)
    archive, publish = _inputs(tmp_path)
    datasets, sources = _declarations()
    _patch_declarations(monkeypatch, datasets=datasets, sources=sources)
    monkeypatch.setattr(public, "ROOT", repository)
    monkeypatch.setattr(public, "public_dataset_closure", lambda: (DATASET_ID,))
    build_times = iter(("2026-09-11T08:00:00Z", "2026-09-11T09:00:00Z"))
    monkeypatch.setattr(public, "_utc_now", lambda: next(build_times))

    def deterministic_dataset(_declaration, *, publish_root: Path, attempted_at: str, **_options):
        publish_root.mkdir(parents=True)
        (publish_root / "dataset.parquet").write_bytes(b"rebuilt-publication")
        (publish_root / "attempt.txt").write_text(attempted_at + "\n", encoding="utf-8")

    def deterministic_site(*, publish_root: Path, output: Path, generated_at: str, **_options):
        output.mkdir(parents=True)
        payload = (publish_root / "data" / DATASET_ID / "dataset.parquet").read_bytes()
        (output / "site.bin").write_bytes(payload)
        (output / "generated-at.txt").write_text(generated_at + "\n", encoding="utf-8")

    monkeypatch.setattr(public, "build_dataset", deterministic_dataset)
    monkeypatch.setattr(public, "run_public_site_build", deterministic_site)
    first, second = tmp_path / "first", tmp_path / "second"

    public.build_public_site(output=first, archive_root=archive, committed_publish_root=publish)
    public.build_public_site(output=second, archive_root=archive, committed_publish_root=publish)

    assert (first / "site.bin").read_bytes() == (second / "site.bin").read_bytes()
    assert (first / "generated-at.txt").read_text(encoding="utf-8") == "2026-09-11T08:00:00Z\n"
    assert (second / "generated-at.txt").read_text(encoding="utf-8") == "2026-09-11T09:00:00Z\n"
    assert _git(repository, "status", "--porcelain", "--untracked-files=all") == ""
