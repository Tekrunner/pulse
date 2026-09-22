"""Staged workspace verification used identically by developers and CI."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys


class VerificationError(RuntimeError):
    """A stage failed with an actionable diagnostic."""


ROOT = Path(__file__).resolve().parents[2]
# Dataset conformance exercises two dbt builds over the full public snapshot;
# allow the reproducible suite to complete on slower CI and Firefox hosts.
SUBPROCESS_TIMEOUT_SECONDS = 600
# The two full suites are budgeted apart from the short stages, because their
# cost grows with the repository rather than with the machine: the Python
# suite rebuilds every dataset package with dbt, and the frontend suite runs
# every browser specification in two engines. Measured on 2026-09-22 on the
# development Linux host before dataset-test deduplication: 380 seconds for 385
# Python tests. The 198 browser tests took 427 seconds with two workers, down
# from the earlier 690-second single-worker measurement. The budget leaves room
# for slower hosts; shorten the suites rather than treating another timeout
# increase as a fix.
SUITE_TIMEOUT_SECONDS = 2400


def _run(name: str, command: list[str], timeout: int = SUBPROCESS_TIMEOUT_SECONDS) -> None:
    print(f"[{name}] {' '.join(command)}", flush=True)
    try:
        completed = subprocess.run(
            command, cwd=ROOT, text=True, check=False, timeout=timeout
        )
    except subprocess.TimeoutExpired as error:
        raise VerificationError(
            f"stage '{name}' timed out after {timeout} seconds; "
            "inspect the command or its prerequisites."
        ) from error
    except OSError as error:
        raise VerificationError(
            f"stage '{name}' cannot start because '{command[0]}' is unavailable or unusable: {error}; "
            "run the documented frozen installation first."
        ) from error
    if completed.returncode:
        raise VerificationError(f"stage '{name}' exited {completed.returncode}; inspect its output above.")


def _probe(name: str, command: list[str]) -> str:
    try:
        completed = subprocess.run(
            command,
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as error:
        raise VerificationError(
            f"stage 'node smoke' timed out probing {name} after {SUBPROCESS_TIMEOUT_SECONDS} seconds; "
            "reinstall the documented Node 24 toolchain."
        ) from error
    except OSError as error:
        raise VerificationError(
            f"stage 'node smoke' cannot run {name} at '{command[0]}': {error}; "
            "reinstall the documented Node 24 toolchain."
        ) from error
    if completed.returncode:
        raise VerificationError(
            f"stage 'node smoke' could not determine {name} (exit {completed.returncode}); "
            "reinstall the documented Node 24 toolchain."
        )
    return completed.stdout.strip()


def _python_smoke() -> None:
    if platform.python_implementation() != "CPython" or sys.version_info[:2] != (3, 13):
        raise VerificationError(
            "stage 'python smoke' requires CPython 3.13 (found "
            f"{platform.python_implementation()} {sys.version.split()[0]}); "
            "install CPython 3.13, then run uv sync --frozen."
        )
    _run("python smoke", [sys.executable, "-m", "pytest", "-q"], timeout=SUITE_TIMEOUT_SECONDS)


def _skill_mirror_smoke() -> None:
    _run(
        "skill mirrors",
        [sys.executable, str(ROOT / "scripts" / "sync_agent_skills.py"), "--check"],
    )


def _node_smoke() -> None:
    npm = shutil.which("npm")
    if npm is None:
        raise VerificationError(
            "stage 'node smoke' requires Node 24/npm 11; install the documented Node prerequisite."
        )
    node = shutil.which("node")
    if node is None:
        raise VerificationError(
            "stage 'node smoke' requires Node 24; install it, then rerun npm ci."
        )
    if Path(node).parent.resolve() != Path(npm).parent.resolve():
        raise VerificationError(
            "stage 'node smoke' resolved node and npm from different installations; "
            "activate one Node 24 toolchain and rerun npm ci."
        )
    node_version = _probe("Node", [node, "--version"])
    npm_version = _probe("npm", [npm, "--version"])
    if not node_version.startswith("v24."):
        raise VerificationError(
            "stage 'node smoke' requires Node 24 (found "
            f"{node_version or 'unavailable'}); install Node 24 and rerun npm ci."
        )
    if not npm_version.startswith("11."):
        raise VerificationError(
            "stage 'node smoke' requires npm 11 bundled with Node 24 (found "
            f"{npm_version or 'unavailable'}); reinstall the documented Node 24 prerequisite."
        )
    _run("node smoke", [npm, "run", "verify:frontend"], timeout=SUITE_TIMEOUT_SECONDS)


def _status_smoke() -> None:
    """Gate the committed pipelines against the expected-pipeline catalog.

    Imported here so verification stays usable as a plain module: the catalog
    pulls in DuckDB and dlt, which a bare `pulse verify` should not pay for
    before it has decided the stage will run.
    """
    from pulse.catalog import compile_expected_pipelines, compile_status_catalog
    from pulse.contracts.snapshot import ContractError

    print("[status contract] compile expected pipelines and status", flush=True)
    try:
        compile_status_catalog(expected=compile_expected_pipelines())
    except (ContractError, OSError) as error:
        raise VerificationError(
            f"stage 'status contract' rejected the committed pipelines: {error}; "
            "reconcile the declarations, snapshots and publications."
        ) from error


def _workflow_smoke() -> None:
    """Enforce the source workflow's writer and offline-verification boundaries."""
    try:
        workflows = [
            path
            for path in (ROOT / ".github/workflows").glob("*.yml")
            if "pulse source refresh" in path.read_text(encoding="utf-8")
        ]
    except OSError as error:
        raise VerificationError("stage 'workflow contract' could not read source workflows") from error
    push_command = "git" + " push origin HEAD:main"
    required = (
        "cron:",
        "workflow_dispatch:",
        "contents: write",
        "group: pulse-repository-writer",
        "cancel-in-progress: false",
        "ref: main",
        "lfs: false",
        'version: "0.12.1"',
        "python-version: \"3.13\"",
        "uv sync --frozen",
        "git lfs pull --include=\"snapshots/public/",
        "pulse source refresh ",
        "github.run_id",
        "continue-on-error: true",
        "pulse source stage-publication ",
        "git diff --cached --quiet",
        push_command,
        "if: always()",
    )
    from pulse.datasets import discover_datasets
    from pulse.sources import discover_sources

    source_root = ROOT / "sources"
    declared_sources = discover_sources(source_root) if source_root.is_dir() else {}
    seen: set[str] = set()
    for workflow in workflows:
        content = workflow.read_text(encoding="utf-8")
        if re.search(r"__[A-Z0-9_]+__", content):
            raise VerificationError(
                f"stage 'workflow contract' rejected {workflow.name}: unresolved placeholder"
            )
        missing = [token for token in required if token not in content]
        if missing:
            raise VerificationError(
                f"stage 'workflow contract' rejected {workflow.name}: missing "
                + ", ".join(missing)
            )
        matching = [
            source_id
            for source_id in declared_sources
            if f"pulse source refresh {source_id} " in content
        ]
        if declared_sources and len(matching) != 1:
            raise VerificationError(
                f"stage 'workflow contract' requires {workflow.name} to refresh one declared source"
            )
        if matching:
            source_id = matching[0]
            if source_id in seen or f"pulse source stage-publication {source_id}" not in content:
                raise VerificationError(
                    f"stage 'workflow contract' requires one independent workflow for '{source_id}'"
                )
            if f'git lfs pull --include="snapshots/public/{source_id}/**"' not in content:
                raise VerificationError(
                    f"stage 'workflow contract' requires source-scoped LFS for '{source_id}'"
                )
            seen.add(source_id)
        datasets_root = ROOT / "datasets"
        datasets = discover_datasets(datasets_root) if datasets_root.is_dir() else {}
        # A workflow legitimately says its own source ID many times, and a
        # dataset ID can be a substring of one: the source 'who-healthy-life-
        # expectancy' contains the dataset 'healthy-life-expectancy'. Reading
        # that as dataset knowledge would make naming a source after its
        # indicator an error. The source's own name is removed first, so what
        # remains is only what the workflow says about something else.
        remainder = content.replace(matching[0], "") if matching else content
        if any(dataset_id in remainder for dataset_id in datasets):
            raise VerificationError(
                "stage 'workflow contract' rejects dataset knowledge in source workflow YAML"
            )
        if "publish/public/data" in content:
            raise VerificationError(
                "stage 'workflow contract' rejects dataset publication paths in source workflow YAML"
            )
        if "github.run_attempt" in content:
            raise VerificationError(
                "stage 'workflow contract' requires reruns to reuse one logical identity"
            )
    scheduled = {
        source_id
        for source_id, declaration in declared_sources.items()
        if declaration.visibility == "public"
    }
    if scheduled != seen:
        raise VerificationError(
            "stage 'workflow contract' requires one independent schedule per public source"
        )
    forbidden_runtime_operation = "git" + " push"
    if any(
        forbidden_runtime_operation in path.read_text(encoding="utf-8")
        for path in (ROOT / "runtime/pulse").rglob("*.py")
    ):
        raise VerificationError("stage 'workflow contract' forbids runtime code from pushing")
    pages_path = ROOT / ".github/workflows/pages.yml"
    try:
        pages = pages_path.read_text(encoding="utf-8")
    except OSError as error:
        raise VerificationError("stage 'workflow contract' requires a Pages deployment workflow") from error
    required_pages = (
        "contents: read",
        "pages: write",
        "id-token: write",
        "group: pulse-pages",
        "cancel-in-progress: true",
        "lfs: true",
        'version: "0.12.1"',
        'python-version: "3.13"',
        'node-version: "24"',
        "uv sync --frozen",
        "npm ci",
        "playwright install --with-deps chromium firefox",
        "pulse verify --repository-only",
        "npm run verify:contracts",
        "pulse public build --output dist",
        "npm run public:verify",
        "actions/upload-pages-artifact@v3",
        "path: dist",
        "needs: [repository, artifact]",
        "actions/deploy-pages@v4",
    )
    missing_pages = [token for token in required_pages if token not in pages]
    if missing_pages:
        raise VerificationError(
            "stage 'workflow contract' rejected the Pages workflow: missing "
            + ", ".join(missing_pages)
        )
    if not (
        pages.index("pulse public build --output dist")
        < pages.index("npm run public:verify")
        < pages.index("actions/upload-pages-artifact@v3")
        < pages.index("actions/deploy-pages@v4")
    ):
        raise VerificationError(
            "stage 'workflow contract' requires build and verification before the exact Pages handoff"
        )
    pages_push = "git" + " push"
    if pages_push in pages or "contents: write" in pages:
        raise VerificationError("stage 'workflow contract' forbids repository writes during Pages deployment")
    from pulse.datasets import discover_datasets

    if any(dataset_id in pages for dataset_id in discover_datasets()):
        raise VerificationError("stage 'workflow contract' rejects dataset knowledge in Pages YAML")


REPOSITORY_STAGES: tuple[Callable[[], None], ...] = (
    _status_smoke,
    _workflow_smoke,
    _skill_mirror_smoke,
    _python_smoke,
)
SMOKE_STAGES: tuple[Callable[[], None], ...] = REPOSITORY_STAGES + (_node_smoke,)


def verify_repository() -> None:
    """Run the repository half of verification without Node or browser work."""
    for stage in REPOSITORY_STAGES:
        stage()


def verify_workspace() -> None:
    for stage in SMOKE_STAGES:
        stage()
