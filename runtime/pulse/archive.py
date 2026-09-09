"""Immutable raw snapshot archive with retry-integrity semantics."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
from typing import Any
import uuid

import dlt
import duckdb

from pulse.contracts.snapshot import (
    SNAPSHOT_SCHEMA_ID, SNAPSHOT_SCHEMA_VERSION, ContractError, SnapshotManifest,
    validate_snapshot_manifest,
)


class ArchiveError(RuntimeError):
    """A snapshot could not be accepted without violating archive invariants."""


class AcquisitionIntegrityError(ArchiveError):
    """An acquisition ID was reused for different content."""


def issue_acquisition_id() -> str:
    return f"acq-{uuid.uuid4().hex}"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def reject_lfs_pointer(path: Path) -> None:
    try:
        prefix = path.read_bytes()[:128]
    except OSError as error:
        raise ArchiveError("raw snapshot is unavailable") from error
    if prefix.startswith(b"version https://git-lfs.github.com/spec/v1"):
        raise ArchiveError("raw snapshot is an unresolved Git LFS pointer; materialize LFS objects first")


def _schema_hash(rows: list[dict[str, Any]]) -> str:
    fields: dict[str, set[str]] = {}
    for row in rows:
        for key, value in row.items():
            fields.setdefault(key, set()).add(type(value).__name__)
    canonical = json.dumps({key: sorted(value) for key, value in sorted(fields.items())}, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def _write_parquet(rows: list[dict[str, Any]], destination: Path) -> None:
    # Build from adapter-provided Python types. JSON auto-detection would silently
    # reinterpret provider strings such as ISO-looking attributes as dates.
    columns = sorted({key for row in rows for key in row})
    if not columns:
        raise ArchiveError("cannot archive provider rows without fields")

    def sql_type(column: str) -> str:
        types = {type(row[column]) for row in rows if row.get(column) is not None}
        if not types or types == {str}:
            return "VARCHAR"
        if types <= {bool}:
            return "BOOLEAN"
        if types <= {int}:
            return "BIGINT"
        if types <= {int, float}:
            return "DOUBLE"
        raise ArchiveError(f"provider field '{column}' has incompatible row types")

    def quoted(identifier: str) -> str:
        return '"' + identifier.replace('"', '""') + '"'

    def literal(text: str) -> str:
        return "'" + text.replace("'", "''") + "'"

    definitions = ", ".join(f"{quoted(column)} {sql_type(column)}" for column in columns)
    # Load through newline-delimited JSON rather than a row-at-a-time INSERT.
    # Per-value binding makes DuckDB test every value for pandas support, and a
    # failed optional import is never cached, so each check re-walked sys.path:
    # 178k lookups for one acquisition. DuckDB reads the file in one pass
    # instead, and the declared column types keep the explicit typing above --
    # JSON auto-detection is never consulted. CSV cannot express the difference
    # between an empty string and a null, so it is not usable here.
    declared = ", ".join(f"{literal(column)}: {literal(sql_type(column))}" for column in columns)
    connection = duckdb.connect()
    staging = Path(tempfile.mkdtemp(prefix=".rows-"))
    try:
        payload = staging / "rows.json"
        try:
            with payload.open("w", encoding="utf-8") as handle:
                for row in rows:
                    # allow_nan=False: NaN and Infinity are not JSON, and emitting
                    # them would hand read_json a value it cannot round-trip. Fail
                    # loudly instead of archiving a silently altered observation.
                    handle.write(
                        json.dumps(
                            {column: row.get(column) for column in columns},
                            ensure_ascii=False,
                            allow_nan=False,
                        )
                        + "\n"
                    )
        except ValueError as error:
            raise ArchiveError("provider rows contain a value that is not representable") from error
        connection.execute(f"CREATE TABLE source_rows ({definitions})")
        connection.execute(
            f"INSERT INTO source_rows SELECT {', '.join(quoted(column) for column in columns)} "
            f"FROM read_json({literal(payload.as_posix())}, "
            f"format='newline_delimited', columns={{{declared}}})"
        )
        connection.execute("COPY source_rows TO ? (FORMAT PARQUET)", [str(destination)])
    finally:
        connection.close()
        shutil.rmtree(staging, ignore_errors=True)


def archive_rows(*, root: Path, source_id: str, acquisition_id: str, acquired_at: str, source_data_date: str | None, source_urls: list[str], rows: list[dict[str, Any]], decoder_version: str, licence: str, attribution: str) -> tuple[Path, bool]:
    if not rows:
        raise ArchiveError("cannot archive an empty provider response")
    archive_root = root / source_id
    archive_root.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".snapshot-", dir=archive_root))
    try:
        raw = staging / "raw.parquet"
        _write_parquet(rows, raw)
        raw_hash = _sha256(raw)
        snapshot_id = f"{acquisition_id}-{raw_hash[:12]}"
        target = archive_root / snapshot_id
        manifest = SnapshotManifest(
            schema_id=SNAPSHOT_SCHEMA_ID, schema_version=SNAPSHOT_SCHEMA_VERSION, source_id=source_id,
            acquisition_id=acquisition_id, snapshot_id=snapshot_id, acquired_at=acquired_at,
            source_data_date=source_data_date, source_urls=source_urls,
            artifacts=[{"path": "raw.parquet", "sha256": raw_hash}], observed_schema_sha256=_schema_hash(rows),
            decoder_version=decoder_version, tool_versions={"dlt": dlt.__version__, "duckdb": duckdb.__version__},
            licence=licence, attribution=attribution,
        )
        validate_snapshot_manifest(manifest.to_dict())
        for existing in archive_root.glob("*/snapshot.json"):
            existing_manifest = validate_snapshot_manifest(json.loads(existing.read_text(encoding="utf-8")))
            if existing_manifest.acquisition_id == acquisition_id:
                if existing_manifest.artifacts[0]["sha256"] == raw_hash:
                    return existing.parent, True
                raise AcquisitionIntegrityError("acquisition-integrity conflict: acquisition ID has different content")
        (staging / "snapshot.json").write_text(json.dumps(manifest.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
        try:
            staging.replace(target)
        except FileExistsError:
            raise ArchiveError("snapshot target already exists; retry the acquisition")
        return target, False
    except (ContractError, duckdb.Error, OSError) as error:
        if isinstance(error, ArchiveError):
            raise
        raise ArchiveError("could not create a compliant immutable snapshot") from error
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
