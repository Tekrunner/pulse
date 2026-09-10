"""Source-neutral acquisition and dependent-dataset refresh orchestration."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import subprocess
from typing import Any

from pulse.archive import (
    AcquisitionIntegrityError,
    ArchiveError,
    archive_rows,
    utc_now,
)
from pulse.contracts.dataset import diagnostic
from pulse.contracts.status import attempt
from pulse.datasets import DatasetError, DatasetManifest, build_dataset, discover_datasets
from pulse.sources import (
    SourceAcquisitionError,
    SourceDeclarationError,
    acquire_from_adapter,
    discover_sources,
)


ROOT = Path(__file__).resolve().parents[2]


class RefreshError(RuntimeError):
    """A refresh completed with one or more safely recorded failures."""


class PublicationStagingError(RuntimeError):
    """A refresh artifact set could not be safely staged for publication."""


@dataclass(frozen=True)
class DatasetRefreshOutcome:
    dataset_id: str
    manifest: DatasetManifest | None
    error: str | None


@dataclass(frozen=True)
class RefreshOutcome:
    source_id: str
    acquisition_id: str
    snapshot: Path | None
    no_op: bool
    datasets: tuple[DatasetRefreshOutcome, ...]
    source_error: str | None = None
    orchestration_error: str | None = None

    @property
    def failed(self) -> bool:
        return (
            self.source_error is not None
            or self.orchestration_error is not None
            or any(item.error is not None for item in self.datasets)
        )


def acquisition_id_for(source_id: str, logical_run_key: str) -> str:
    """Derive one opaque acquisition identity for all attempts of a logical run."""
    if not isinstance(logical_run_key, str) or not logical_run_key.strip():
        raise ValueError("logical run key must be a non-empty string")
    if len(logical_run_key) > 512:
        raise ValueError("logical run key is too long")
    digest = hashlib.sha256(f"{source_id}\0{logical_run_key}".encode()).hexdigest()
    return f"acq-{digest[:32]}"


def publication_paths(
    source_id: str,
    *,
    repository_root: Path = ROOT,
    sources_root: Path = ROOT / "sources",
    datasets_root: Path = ROOT / "datasets",
    archive_root: Path = ROOT / "snapshots/public",
    publish_root: Path = ROOT / "publish/public/data",
) -> tuple[Path, ...]:
    """Resolve the only paths one source refresh is allowed to publish."""
    try:
        source = discover_sources(sources_root).get(source_id)
        datasets = discover_datasets(datasets_root)
    except (SourceDeclarationError, DatasetError) as error:
        raise PublicationStagingError("committed pipeline declarations are invalid") from error
    if source is None:
        raise PublicationStagingError(f"declared source '{source_id}' was not found")
    candidates = [archive_root / source.source_id]
    candidates.extend(
        publish_root / declaration.dataset_id
        for declaration in datasets.values()
        if declaration.source_id == source.source_id
    )
    root = repository_root.resolve()
    relative: list[Path] = []
    for candidate in candidates:
        try:
            path = candidate.resolve().relative_to(root)
        except ValueError as error:
            raise PublicationStagingError(
                "publication artifact paths must remain inside the repository"
            ) from error
        if not path.parts:
            raise PublicationStagingError("the repository root cannot be staged as an artifact")
        relative.append(path)
    return tuple(relative)


def stage_refresh_artifacts(
    source_id: str,
    *,
    repository_root: Path = ROOT,
    sources_root: Path = ROOT / "sources",
    datasets_root: Path = ROOT / "datasets",
    archive_root: Path = ROOT / "snapshots/public",
    publish_root: Path = ROOT / "publish/public/data",
) -> tuple[Path, ...]:
    """Stage only one source and its declared dependent publication directories."""
    paths = publication_paths(
        source_id,
        repository_root=repository_root,
        sources_root=sources_root,
        datasets_root=datasets_root,
        archive_root=archive_root,
        publish_root=publish_root,
    )
    included: list[Path] = []
    try:
        for path in paths:
            tracked = subprocess.run(
                ["git", "ls-files", "--error-unmatch", "--", path.as_posix()],
                cwd=repository_root,
                text=True,
                capture_output=True,
                check=False,
            ).returncode == 0
            if (repository_root / path).exists() or tracked:
                included.append(path)
    except OSError as error:
        raise PublicationStagingError("git could not inspect refresh artifacts") from error
    if not included:
        raise PublicationStagingError("refresh produced no declared artifact paths to stage")
    try:
        completed = subprocess.run(
            ["git", "add", "-A", "--", *(path.as_posix() for path in included)],
            cwd=repository_root,
            text=True,
            capture_output=True,
            check=False,
        )
    except OSError as error:
        raise PublicationStagingError("git could not stage refresh artifacts") from error
    if completed.returncode:
        raise PublicationStagingError("git rejected the scoped refresh artifact set")
    return tuple(included)


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _record_source_failure(
    target: Path, *, attempted_at: str, stage: str, code: str, message: str, retryable: bool
) -> None:
    _write_json(target / "attempt.json", attempt(attempted_at))
    _write_json(
        target / "diagnostic.json",
        diagnostic(stage, code, message, retryable=retryable),
    )


def _source_failure(error: BaseException) -> tuple[str, str, str, bool]:
    """Map internal failures onto a small, provider-neutral, publish-safe vocabulary."""
    if isinstance(error, AcquisitionIntegrityError):
        return (
            "snapshot",
            "acquisition_integrity_conflict",
            "the logical acquisition identity returned different content; retained prior artifacts",
            False,
        )
    if isinstance(error, ArchiveError):
        return (
            "snapshot",
            "snapshot_rejected",
            "the acquired response could not be archived safely; retained prior artifacts",
            False,
        )
    if isinstance(error, SourceDeclarationError):
        return (
            "acquire",
            "source_contract_invalid",
            "source acquisition could not satisfy its committed declaration",
            False,
        )
    if isinstance(error, SourceAcquisitionError):
        if error.retryable:
            return (
                "acquire",
                "upstream_unavailable",
                "source acquisition failed safely; retry when the upstream service is available",
                True,
            )
        return (
            "acquire",
            "source_response_rejected",
            "the upstream response did not satisfy the committed source contract",
            False,
        )
    return (
        "acquire",
        "source_response_rejected",
        "the upstream response did not satisfy the committed source contract",
        False,
    )


def refresh_source(
    source_id: str,
    *,
    logical_run_key: str,
    fixture: Path | None = None,
    live: bool = False,
    archive_root: Path = ROOT / "snapshots/public",
    build_root: Path = ROOT / "build/datasets/public",
    publish_root: Path = ROOT / "publish/public/data",
    sources_root: Path = ROOT / "sources",
    datasets_root: Path = ROOT / "datasets",
) -> RefreshOutcome:
    """Acquire one source and independently build only its declared dependents.

    A matching retry is a true no-op: it neither duplicates the immutable
    snapshot nor re-runs dependents whose inputs have already been processed.
    Every non-no-op dataset is attempted even when a sibling fails.
    """
    try:
        declaration = discover_sources(sources_root).get(source_id)
    except SourceDeclarationError as error:
        raise RefreshError("committed source declarations are invalid") from error
    if declaration is None:
        raise RefreshError(f"declared source '{source_id}' was not found")
    acquisition_id = acquisition_id_for(declaration.source_id, logical_run_key)
    attempted_at = utc_now()
    source_target = archive_root / declaration.source_id
    try:
        acquired = acquire_from_adapter(declaration, fixture=fixture, live=live)
        snapshot, no_op = archive_rows(
            root=archive_root,
            source_id=declaration.source_id,
            acquisition_id=acquisition_id,
            acquired_at=attempted_at,
            source_data_date=acquired.source_data_date,
            source_urls=acquired.source_urls,
            rows=acquired.rows,
            decoder_version=acquired.decoder_version,
            licence=declaration.licence,
            attribution=declaration.attribution,
        )
    except (SourceDeclarationError, ArchiveError, ValueError) as error:
        stage, code, message, retryable = _source_failure(error)
        _record_source_failure(
            source_target,
            attempted_at=attempted_at,
            stage=stage,
            code=code,
            message=message,
            retryable=retryable,
        )
        return RefreshOutcome(source_id, acquisition_id, None, False, (), message)

    if no_op:
        # A retry can arrive after a different, newer logical run. The archive
        # match proves only that this run already published its snapshot; it
        # must not regress or clear the source's current outcome sidecars.
        return RefreshOutcome(source_id, acquisition_id, snapshot, True, ())
    _write_json(source_target / "attempt.json", attempt(attempted_at))
    (source_target / "diagnostic.json").unlink(missing_ok=True)

    try:
        dependents = tuple(
            declaration
            for declaration in discover_datasets(datasets_root).values()
            if declaration.source_id == source_id
        )
    except DatasetError:
        # Discovery is an orchestration-level contract failure. The source is
        # still safely archived, and no unknown build target is guessed.
        return RefreshOutcome(
            source_id,
            acquisition_id,
            snapshot,
            False,
            (),
            None,
            "dependent dataset declarations are invalid; retained the archived snapshot",
        )

    outcomes: list[DatasetRefreshOutcome] = []
    for dependent in dependents:
        try:
            manifest = build_dataset(
                dependent,
                archive_root=archive_root,
                build_root=build_root,
                publish_root=publish_root / dependent.dataset_id,
                sources_root=sources_root,
            )
        except Exception:
            target = publish_root / dependent.dataset_id
            # build_dataset normally records its own stage-specific failure.
            # Preserve that richer artifact; only fill the gap if a failure
            # escaped before the dataset runtime could do so.
            if not (target / "diagnostic.json").is_file():
                try:
                    _write_json(target / "attempt.json", attempt(utc_now()))
                    _write_json(
                        target / "diagnostic.json",
                        diagnostic(
                            "transform",
                            "build_failed",
                            "dataset build failed safely; retained any prior usable publication",
                            retryable=True,
                        ),
                    )
                except OSError:
                    # The aggregate still reports failure and siblings continue;
                    # the writer validation will prevent an incomplete state
                    # from being committed.
                    pass
            outcomes.append(
                DatasetRefreshOutcome(
                    dependent.dataset_id,
                    None,
                    "dataset build failed safely; retained any prior usable publication",
                )
            )
        else:
            outcomes.append(DatasetRefreshOutcome(dependent.dataset_id, manifest, None))
    return RefreshOutcome(source_id, acquisition_id, snapshot, False, tuple(outcomes))
