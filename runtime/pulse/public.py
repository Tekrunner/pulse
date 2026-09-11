"""Fail-closed, offline orchestration for the deployable public site."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

from pulse.archive import ArchiveError, reject_lfs_pointer
from pulse.catalog import public_dataset_closure
from pulse.contracts.snapshot import ContractError, validate_snapshot_manifest
from pulse.datasets import DatasetDeclaration, DatasetError, build_dataset, discover_datasets
from pulse.site import run_public_site_build
from pulse.sources import SourceDeclaration, SourceDeclarationError, discover_sources
from pulse.verify import ROOT, VerificationError


class PublicBuildError(RuntimeError):
    """The repository cannot produce a safe public artifact."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _git_state(root: Path) -> str:
    completed = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all"],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode:
        raise PublicBuildError("could not verify that the public build preserves repository files")
    return completed.stdout


def _validate_public_inputs(
    dataset_ids: tuple[str, ...], *, archive_root: Path, publish_root: Path
) -> tuple[dict[str, DatasetDeclaration], dict[str, SourceDeclaration], str]:
    try:
        datasets = discover_datasets()
        sources = discover_sources()
    except (DatasetError, SourceDeclarationError) as error:
        raise PublicBuildError(f"public declarations are invalid: {error}") from error

    timestamps: list[str] = []
    source_ids: set[str] = set()
    for dataset_id in dataset_ids:
        declaration = datasets.get(dataset_id)
        if declaration is None or declaration.visibility != "public":
            raise PublicBuildError(
                f"public report closure references unavailable public dataset '{dataset_id}'"
            )
        source = sources.get(declaration.source_id)
        if source is None or source.visibility != "public":
            raise PublicBuildError(
                f"public dataset '{dataset_id}' references unavailable public source lineage"
            )
        source_ids.add(source.source_id)

        # Published Parquet is canonical even though this profile rebuilds it.
        # Requiring it to be materialized catches incomplete clean clones before
        # any potentially expensive work starts.
        published = publish_root / "data" / dataset_id / "dataset.parquet"
        try:
            reject_lfs_pointer(published)
        except ArchiveError as error:
            raise PublicBuildError(
                f"public dataset '{dataset_id}' is unavailable; materialize Git LFS objects first"
            ) from error

    for source_id in sorted(source_ids):
        manifests = sorted((archive_root / source_id).glob("*/snapshot.json"))
        if not manifests:
            raise PublicBuildError(f"public source '{source_id}' has no committed snapshots")
        for manifest_path in manifests:
            try:
                manifest = validate_snapshot_manifest(
                    json.loads(manifest_path.read_text(encoding="utf-8"))
                )
                if manifest.source_id != source_id:
                    raise ContractError("snapshot identity disagrees with public source lineage")
                raw = manifest_path.parent / manifest.artifacts[0]["path"]
                reject_lfs_pointer(raw)
                if hashlib.sha256(raw.read_bytes()).hexdigest() != manifest.artifacts[0]["sha256"]:
                    raise ContractError("snapshot bytes disagree with their manifest")
            except (OSError, ValueError, ContractError, ArchiveError) as error:
                raise PublicBuildError(
                    f"public source '{source_id}' has an invalid or unresolved snapshot; "
                    "materialize Git LFS objects first"
                ) from error
            timestamps.append(manifest.acquired_at)
    return datasets, sources, max(timestamps)


def build_public_site(
    *,
    output: Path = ROOT / "dist",
    archive_root: Path = ROOT / "snapshots/public",
    committed_publish_root: Path = ROOT / "publish/public",
) -> Path:
    """Rebuild the explicit public closure and package one verified artifact."""
    before = _git_state(ROOT)
    try:
        dataset_ids = public_dataset_closure()
        datasets, _sources, _latest_snapshot_at = _validate_public_inputs(
            dataset_ids,
            archive_root=archive_root,
            publish_root=committed_publish_root,
        )
        generated_at = _utc_now()
        with tempfile.TemporaryDirectory(prefix="pulse-public-") as temporary:
            workspace = Path(temporary)
            rebuilt = workspace / "publish"
            build_root = workspace / "build"
            for dataset_id in dataset_ids:
                build_dataset(
                    datasets[dataset_id],
                    archive_root=archive_root.resolve(),
                    build_root=build_root,
                    publish_root=rebuilt / "data" / dataset_id,
                    attempted_at=generated_at,
                )
            run_public_site_build(
                archive_root=archive_root.resolve(),
                publish_root=rebuilt.resolve(),
                output=output.resolve(),
                generated_at=generated_at,
            )
    except PublicBuildError:
        raise
    except (ContractError, DatasetError, VerificationError, OSError) as error:
        raise PublicBuildError(str(error)) from error
    finally:
        after = _git_state(ROOT)
        if after != before:
            raise PublicBuildError("public build changed tracked or untracked repository files")
    return output
