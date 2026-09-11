from pathlib import Path
import subprocess

import pytest

from pulse import automation
from pulse import verify


ROOT = Path(__file__).parents[2]


def test_verify_workflow_materializes_lfs_before_reading_public_parquet() -> None:
    workflow = (ROOT / ".github/workflows/verify.yml").read_text(encoding="utf-8")

    assert "uses: actions/checkout@v4\n        with:\n          lfs: true" in workflow


def test_insee_workflow_satisfies_the_offline_writer_contract() -> None:
    verify._workflow_smoke()

    workflow = (ROOT / ".github/workflows/insee-cpi.yml").read_text(encoding="utf-8")
    assert "continue-on-error: true" in workflow
    assert "if: always()" in workflow
    assert "git diff --cached --quiet" in workflow
    assert "pulse source stage-publication insee-cpi" in workflow
    assert "publish/public/data" not in workflow
    assert "git add" not in workflow
    assert "--force" not in workflow
    assert "github.run_attempt" not in workflow


def test_pages_workflow_uploads_only_the_verified_latest_wins_artifact() -> None:
    verify._workflow_smoke()
    workflow = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")

    assert "pulse public build --output dist" in workflow
    assert workflow.index("pulse public build --output dist") < workflow.index("actions/upload-pages-artifact@v3")
    assert workflow.index("npm run public:verify") < workflow.index("actions/upload-pages-artifact@v3")
    assert workflow.index("actions/upload-pages-artifact@v3") < workflow.index("actions/deploy-pages@v4")
    assert "group: pulse-pages" in workflow
    assert "cancel-in-progress: true" in workflow
    assert "contents: write" not in workflow
    assert "git push" not in workflow


def _git(repository: Path, *arguments: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *arguments],
        cwd=repository,
        text=True,
        capture_output=True,
        check=check,
    )


def _init_repository(path: Path) -> None:
    path.mkdir(parents=True)
    _git(path, "init", "-b", "main")
    _git(path, "config", "user.name", "Pulse Test")
    _git(path, "config", "user.email", "pulse@example.test")


def _declarations(monkeypatch: pytest.MonkeyPatch) -> None:
    source = type("Source", (), {"source_id": "example-source"})()
    dependent = type(
        "Dataset", (), {"dataset_id": "example-dependent", "source_id": "example-source"}
    )()
    unrelated = type(
        "Dataset", (), {"dataset_id": "unrelated-dataset", "source_id": "other-source"}
    )()
    monkeypatch.setattr(
        automation, "discover_sources", lambda _root: {"example-source": source}
    )
    monkeypatch.setattr(
        automation,
        "discover_datasets",
        lambda _root: {
            "example-dependent": dependent,
            "unrelated-dataset": unrelated,
        },
    )


def test_declaration_scoped_staging_excludes_unrelated_changes_and_avoids_empty_commit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repository = tmp_path / "repository"
    _init_repository(repository)
    source_artifact = repository / "archive/example-source/attempt.json"
    dependent_artifact = repository / "published/example-dependent/dataset.json"
    unrelated_dataset = repository / "published/unrelated-dataset/dataset.json"
    unrelated_file = repository / "notes.txt"
    for path, content in (
        (source_artifact, "source-v1\n"),
        (dependent_artifact, "dependent-v1\n"),
        (unrelated_dataset, "unrelated-dataset-v1\n"),
        (unrelated_file, "notes-v1\n"),
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    _git(repository, "add", "-A")
    _git(repository, "commit", "-m", "baseline")
    baseline = _git(repository, "rev-parse", "HEAD").stdout.strip()
    source_artifact.write_text("source-v2\n", encoding="utf-8")
    dependent_artifact.write_text("dependent-v2\n", encoding="utf-8")
    unrelated_dataset.write_text("unrelated-dataset-v2\n", encoding="utf-8")
    unrelated_file.write_text("notes-v2\n", encoding="utf-8")
    _declarations(monkeypatch)

    staged_paths = automation.stage_refresh_artifacts(
        "example-source",
        repository_root=repository,
        sources_root=repository / "sources",
        datasets_root=repository / "datasets",
        archive_root=repository / "archive",
        publish_root=repository / "published",
    )

    assert staged_paths == (
        Path("archive/example-source"),
        Path("published/example-dependent"),
    )
    assert _git(repository, "diff", "--cached", "--name-only").stdout.splitlines() == [
        "archive/example-source/attempt.json",
        "published/example-dependent/dataset.json",
    ]
    _git(repository, "commit", "-m", "refresh")
    assert _git(repository, "merge-base", "--is-ancestor", baseline, "HEAD").returncode == 0
    assert _git(repository, "show", "HEAD:notes.txt").stdout == "notes-v1\n"
    assert unrelated_file.read_text(encoding="utf-8") == "notes-v2\n"
    assert unrelated_dataset.read_text(encoding="utf-8") == "unrelated-dataset-v2\n"

    # A matching logical retry leaves its declared artifacts byte-identical.
    # Staging them again therefore cannot create an empty commit.
    automation.stage_refresh_artifacts(
        "example-source",
        repository_root=repository,
        sources_root=repository / "sources",
        datasets_root=repository / "datasets",
        archive_root=repository / "archive",
        publish_root=repository / "published",
    )
    assert _git(repository, "diff", "--cached", "--quiet", check=False).returncode == 0


def test_stale_writer_push_conflicts_without_overwriting_remote_history(tmp_path: Path) -> None:
    remote = tmp_path / "remote.git"
    seed = tmp_path / "seed"
    writer = tmp_path / "writer"
    concurrent = tmp_path / "concurrent"
    remote.mkdir()
    _git(remote, "init", "--bare")
    _init_repository(seed)
    (seed / "artifact.txt").write_text("baseline\n", encoding="utf-8")
    _git(seed, "add", "artifact.txt")
    _git(seed, "commit", "-m", "baseline")
    _git(seed, "remote", "add", "origin", str(remote))
    _git(seed, "push", "-u", "origin", "main")
    subprocess.run(
        ["git", "clone", "--branch", "main", str(remote), str(writer)],
        text=True,
        capture_output=True,
        check=True,
    )
    subprocess.run(
        ["git", "clone", "--branch", "main", str(remote), str(concurrent)],
        text=True,
        capture_output=True,
        check=True,
    )
    for repository in (writer, concurrent):
        _git(repository, "config", "user.name", "Pulse Test")
        _git(repository, "config", "user.email", "pulse@example.test")

    (concurrent / "unrelated.txt").write_text("preserve me\n", encoding="utf-8")
    _git(concurrent, "add", "unrelated.txt")
    _git(concurrent, "commit", "-m", "concurrent unrelated history")
    _git(concurrent, "push", "origin", "HEAD:main")
    remote_head = _git(concurrent, "rev-parse", "HEAD").stdout.strip()

    (writer / "artifact.txt").write_text("stale writer\n", encoding="utf-8")
    _git(writer, "add", "artifact.txt")
    _git(writer, "commit", "-m", "stale refresh")
    rejected = _git(writer, "push", "origin", "HEAD:main", check=False)

    assert rejected.returncode != 0
    assert _git(remote, "rev-parse", "refs/heads/main").stdout.strip() == remote_head
    assert _git(concurrent, "show", "HEAD:unrelated.txt").stdout == "preserve me\n"


def test_workflow_contract_rejects_literal_dataset_publication_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    workflows = tmp_path / ".github/workflows"
    workflows.mkdir(parents=True)
    refresh = (ROOT / ".github/workflows/insee-cpi.yml").read_text(encoding="utf-8")
    (workflows / "refresh.yml").write_text(
        refresh + "\n# publish/public/data must never be named here\n", encoding="utf-8"
    )
    (workflows / "verify.yml").write_text("name: verify\n", encoding="utf-8")
    monkeypatch.setattr(verify, "ROOT", tmp_path)

    with pytest.raises(verify.VerificationError, match="dataset publication paths"):
        verify._workflow_smoke()
