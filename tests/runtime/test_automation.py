from __future__ import annotations

import json
from pathlib import Path

import pytest

from pulse import automation
from pulse.archive import AcquisitionIntegrityError
from pulse.automation import acquisition_id_for, refresh_source
from pulse.datasets import DatasetError
from pulse.sources import AdapterAcquisition, SourceAcquisitionError


def test_logical_run_identity_is_opaque_stable_and_source_scoped() -> None:
    first = acquisition_id_for("example-source", "github-run-42")

    assert first == acquisition_id_for("example-source", "github-run-42")
    assert first != acquisition_id_for("other-source", "github-run-42")
    assert "github" not in first and first.startswith("acq-")
    with pytest.raises(ValueError, match="non-empty"):
        acquisition_id_for("example-source", "")


def test_refresh_discovers_only_dependents_and_continues_siblings(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = type("Source", (), {
        "source_id": "example-source",
        "licence": "Open",
        "attribution": "Example",
    })()
    dependents = {
        "first": type("Dataset", (), {"dataset_id": "first", "source_id": "example-source"})(),
        "other": type("Dataset", (), {"dataset_id": "other", "source_id": "other-source"})(),
        "second": type("Dataset", (), {"dataset_id": "second", "source_id": "example-source"})(),
    }
    calls: list[str] = []
    monkeypatch.setattr(automation, "discover_sources", lambda _root: {"example-source": source})
    monkeypatch.setattr(automation, "discover_datasets", lambda _root: dependents)
    monkeypatch.setattr(
        automation,
        "acquire_from_adapter",
        lambda *_args, **_kwargs: AdapterAcquisition(
            [{"value": "1"}], "2026-09-01", ["https://example.test/data"], "v1"
        ),
    )
    monkeypatch.setattr(
        automation,
        "archive_rows",
        lambda **_kwargs: (tmp_path / "archive/example-source/acq-one-hash", False),
    )

    def build(declaration, **_kwargs):
        calls.append(declaration.dataset_id)
        if declaration.dataset_id == "first":
            raise DatasetError("unsafe detail")
        return type("Manifest", (), {"status": {"state": "succeeded"}})()

    monkeypatch.setattr(automation, "build_dataset", build)
    outcome = refresh_source(
        "example-source",
        logical_run_key="42",
        archive_root=tmp_path / "archive",
        build_root=tmp_path / "build",
        publish_root=tmp_path / "publish",
        sources_root=tmp_path / "sources",
        datasets_root=tmp_path / "datasets",
    )

    assert calls == ["first", "second"]
    assert outcome.failed
    assert [item.dataset_id for item in outcome.datasets] == ["first", "second"]
    assert "unsafe detail" not in outcome.datasets[0].error


def test_acquisition_failure_is_persisted_without_leaking_detail(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = type("Source", (), {"source_id": "example-source"})()
    monkeypatch.setattr(automation, "discover_sources", lambda _root: {"example-source": source})
    monkeypatch.setattr(
        automation,
        "acquire_from_adapter",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError("secret upstream body")),
    )
    outcome = refresh_source(
        "example-source",
        logical_run_key="42",
        archive_root=tmp_path / "archive",
        sources_root=tmp_path / "sources",
        datasets_root=tmp_path / "datasets",
    )

    target = tmp_path / "archive/example-source"
    written = json.loads((target / "diagnostic.json").read_text(encoding="utf-8"))
    assert outcome.failed and not outcome.datasets
    assert written["stage"] == "acquire"
    assert "secret" not in written["message"]
    assert (target / "attempt.json").is_file()


@pytest.mark.parametrize(
    ("retryable", "expected_code"),
    ((True, "upstream_unavailable"), (False, "source_response_rejected")),
)
def test_typed_acquisition_failure_drives_published_retry_classification(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    retryable: bool,
    expected_code: str,
) -> None:
    source = type("Source", (), {"source_id": "example-source"})()
    monkeypatch.setattr(automation, "discover_sources", lambda _root: {"example-source": source})
    monkeypatch.setattr(
        automation,
        "acquire_from_adapter",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            SourceAcquisitionError("safe adapter detail", retryable=retryable)
        ),
    )

    outcome = refresh_source(
        "example-source",
        logical_run_key="42",
        archive_root=tmp_path / "archive",
        sources_root=tmp_path / "sources",
        datasets_root=tmp_path / "datasets",
    )

    written = json.loads(
        (tmp_path / "archive/example-source/diagnostic.json").read_text(encoding="utf-8")
    )
    assert outcome.failed
    assert written["code"] == expected_code
    assert written["retryable"] is retryable


def test_conflicting_retry_is_a_safe_snapshot_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = type("Source", (), {
        "source_id": "example-source",
        "licence": "Open",
        "attribution": "Example",
    })()
    monkeypatch.setattr(automation, "discover_sources", lambda _root: {"example-source": source})
    monkeypatch.setattr(
        automation,
        "acquire_from_adapter",
        lambda *_args, **_kwargs: AdapterAcquisition(
            [{"value": "2"}], None, ["https://example.test/data"], "v1"
        ),
    )
    monkeypatch.setattr(
        automation,
        "archive_rows",
        lambda **_kwargs: (_ for _ in ()).throw(AcquisitionIntegrityError("unsafe hash")),
    )
    outcome = refresh_source(
        "example-source",
        logical_run_key="42",
        archive_root=tmp_path / "archive",
        sources_root=tmp_path / "sources",
        datasets_root=tmp_path / "datasets",
    )

    failure = json.loads(
        (tmp_path / "archive/example-source/diagnostic.json").read_text(encoding="utf-8")
    )
    assert outcome.failed and failure["stage"] == "snapshot"
    assert failure["code"] == "acquisition_integrity_conflict"
    assert "unsafe hash" not in failure["message"]


def test_matching_retry_skips_dependents_and_leaves_success_sidecars_byte_identical(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = type("Source", (), {
        "source_id": "example-source",
        "licence": "Open",
        "attribution": "Example",
    })()
    snapshot = tmp_path / "archive/example-source/acq-existing-hash"
    snapshot.mkdir(parents=True)
    (snapshot / "snapshot.json").write_text(
        json.dumps({"acquired_at": "2026-09-01T06:17:00Z"}), encoding="utf-8"
    )
    source_root = tmp_path / "archive/example-source"
    attempt_path = source_root / "attempt.json"
    attempt_path.write_text(
        '{"attempted_at":"2026-09-01T06:17:00Z","schema_id":"pulse.attempt","schema_version":"1.0.0"}\n',
        encoding="utf-8",
    )
    before = attempt_path.read_bytes()
    monkeypatch.setattr(automation, "discover_sources", lambda _root: {"example-source": source})
    monkeypatch.setattr(
        automation,
        "acquire_from_adapter",
        lambda *_args, **_kwargs: AdapterAcquisition(
            [{"value": "1"}], None, ["https://example.test/data"], "v1"
        ),
    )
    monkeypatch.setattr(automation, "archive_rows", lambda **_kwargs: (snapshot, True))
    monkeypatch.setattr(
        automation, "_write_json", lambda *_args, **_kwargs: pytest.fail("retry wrote a sidecar")
    )
    monkeypatch.setattr(
        automation, "discover_datasets", lambda _root: pytest.fail("retry rebuilt dependents")
    )

    outcome = refresh_source(
        "example-source",
        logical_run_key="42",
        archive_root=tmp_path / "archive",
        sources_root=tmp_path / "sources",
        datasets_root=tmp_path / "datasets",
    )

    assert outcome.no_op and not outcome.datasets
    assert attempt_path.read_bytes() == before
    assert not (source_root / "diagnostic.json").exists()


def test_out_of_order_matching_retry_preserves_newer_failure_sidecars(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = type("Source", (), {
        "source_id": "example-source",
        "licence": "Open",
        "attribution": "Example",
    })()
    snapshot = tmp_path / "archive/example-source/acq-older-hash"
    snapshot.mkdir(parents=True)
    source_root = snapshot.parent
    attempt_path = source_root / "attempt.json"
    diagnostic_path = source_root / "diagnostic.json"
    attempt_path.write_text(
        json.dumps(
            {
                "schema_id": "pulse.attempt",
                "schema_version": "1.0.0",
                "attempted_at": "2026-10-23T06:17:00Z",
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    diagnostic_path.write_text(
        json.dumps(
            {
                "schema_id": "pulse.diagnostic",
                "schema_version": "1.0.0",
                "stage": "acquire",
                "code": "upstream_unavailable",
                "message": "source acquisition failed safely",
                "retryable": True,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    before_attempt = attempt_path.read_bytes()
    before_diagnostic = diagnostic_path.read_bytes()
    monkeypatch.setattr(automation, "discover_sources", lambda _root: {"example-source": source})
    monkeypatch.setattr(
        automation,
        "acquire_from_adapter",
        lambda *_args, **_kwargs: AdapterAcquisition(
            [{"value": "1"}], None, ["https://example.test/data"], "v1"
        ),
    )
    monkeypatch.setattr(automation, "archive_rows", lambda **_kwargs: (snapshot, True))
    monkeypatch.setattr(
        automation, "_write_json", lambda *_args, **_kwargs: pytest.fail("retry wrote a sidecar")
    )
    monkeypatch.setattr(
        automation, "discover_datasets", lambda _root: pytest.fail("retry rebuilt dependents")
    )

    outcome = refresh_source(
        "example-source",
        logical_run_key="older-run",
        archive_root=tmp_path / "archive",
        sources_root=tmp_path / "sources",
        datasets_root=tmp_path / "datasets",
    )

    assert outcome.no_op
    assert attempt_path.read_bytes() == before_attempt
    assert diagnostic_path.read_bytes() == before_diagnostic


def test_new_success_records_attempt_and_clears_obsolete_source_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = type("Source", (), {
        "source_id": "example-source",
        "licence": "Open",
        "attribution": "Example",
    })()
    source_root = tmp_path / "archive/example-source"
    source_root.mkdir(parents=True)
    diagnostic_path = source_root / "diagnostic.json"
    diagnostic_path.write_text("obsolete failure\n", encoding="utf-8")
    snapshot = source_root / "acq-new-hash"
    monkeypatch.setattr(automation, "discover_sources", lambda _root: {"example-source": source})
    monkeypatch.setattr(automation, "discover_datasets", lambda _root: {})
    monkeypatch.setattr(
        automation,
        "acquire_from_adapter",
        lambda *_args, **_kwargs: AdapterAcquisition(
            [{"value": "1"}], None, ["https://example.test/data"], "v1"
        ),
    )
    monkeypatch.setattr(automation, "archive_rows", lambda **_kwargs: (snapshot, False))
    monkeypatch.setattr(automation, "utc_now", lambda: "2026-11-23T06:17:00Z")

    outcome = refresh_source(
        "example-source",
        logical_run_key="new-run",
        archive_root=tmp_path / "archive",
        sources_root=tmp_path / "sources",
        datasets_root=tmp_path / "datasets",
    )

    written = json.loads((source_root / "attempt.json").read_text(encoding="utf-8"))
    assert not outcome.no_op and not outcome.failed
    assert written["attempted_at"] == "2026-11-23T06:17:00Z"
    assert not diagnostic_path.exists()
