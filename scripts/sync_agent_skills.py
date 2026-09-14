"""Mirror project-owned Pulse skills from Codex to Claude Code."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


SKILL_PREFIX = "pulse-"
IGNORED_DIRECTORIES = {"__pycache__"}
IGNORED_SUFFIXES = {".pyc", ".pyo"}


def _skill_directories(root: Path) -> dict[str, Path]:
    if not root.is_dir():
        return {}
    return {
        path.name: path
        for path in sorted(root.iterdir())
        if path.is_dir() and path.name.startswith(SKILL_PREFIX) and (path / "SKILL.md").is_file()
    }


def _pulse_directories(root: Path) -> dict[str, Path]:
    if not root.is_dir():
        return {}
    return {
        path.name: path
        for path in sorted(root.iterdir())
        if path.is_dir() and path.name.startswith(SKILL_PREFIX)
    }


def _files(root: Path) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if any(part in IGNORED_DIRECTORIES for part in relative.parts):
            continue
        if path.is_file() and path.suffix not in IGNORED_SUFFIXES:
            files[relative.as_posix()] = path.read_bytes()
    return files


def compare_mirrors(project_root: Path) -> list[str]:
    canonical = _skill_directories(project_root / ".agents" / "skills")
    mirrors = _pulse_directories(project_root / ".claude" / "skills")
    problems: list[str] = []

    for name in sorted(canonical.keys() - mirrors.keys()):
        problems.append(f"missing Claude mirror: {name}")
    for name in sorted(mirrors.keys() - canonical.keys()):
        problems.append(f"orphan Claude mirror: {name}")

    for name in sorted(canonical.keys() & mirrors.keys()):
        source_files = _files(canonical[name])
        mirror_files = _files(mirrors[name])
        for relative in sorted(source_files.keys() - mirror_files.keys()):
            problems.append(f"{name}: missing {relative}")
        for relative in sorted(mirror_files.keys() - source_files.keys()):
            problems.append(f"{name}: extra {relative}")
        for relative in sorted(source_files.keys() & mirror_files.keys()):
            if source_files[relative] != mirror_files[relative]:
                problems.append(f"{name}: changed {relative}")

    if not canonical:
        problems.append("no canonical Pulse skills found under .agents/skills")
    return problems


def _ignore_generated(_directory: str, names: list[str]) -> set[str]:
    return {
        name
        for name in names
        if name in IGNORED_DIRECTORIES or Path(name).suffix in IGNORED_SUFFIXES
    }


def write_mirrors(project_root: Path) -> None:
    source_root = project_root / ".agents" / "skills"
    target_root = project_root / ".claude" / "skills"
    canonical = _skill_directories(source_root)
    if not canonical:
        raise RuntimeError("no canonical Pulse skills found under .agents/skills")

    target_root.mkdir(parents=True, exist_ok=True)
    for name, target in _pulse_directories(target_root).items():
        if name not in canonical:
            shutil.rmtree(target)

    for name, source in canonical.items():
        target = target_root / name
        temporary = target_root / f".{name}.sync-tmp"
        if temporary.exists():
            shutil.rmtree(temporary)
        shutil.copytree(source, temporary, ignore=_ignore_generated)
        if target.exists():
            shutil.rmtree(target)
        temporary.replace(target)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Keep .claude/skills/pulse-* identical to canonical .agents/skills/pulse-*."
    )
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--write", action="store_true", help="replace Claude mirrors")
    action.add_argument("--check", action="store_true", help="report mirror drift without writing")
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help=argparse.SUPPRESS,
    )
    args = parser.parse_args(argv)
    project_root = args.project_root.resolve()

    try:
        if args.write:
            write_mirrors(project_root)
        problems = compare_mirrors(project_root)
    except (OSError, RuntimeError) as error:
        print(f"skill mirror operation failed: {error}", file=sys.stderr)
        return 1

    if problems:
        print("Pulse skill mirrors are out of date:", file=sys.stderr)
        for problem in problems:
            print(f"- {problem}", file=sys.stderr)
        print(
            "Run `uv run --no-sync python scripts/sync_agent_skills.py --write`.",
            file=sys.stderr,
        )
        return 1

    count = len(_skill_directories(project_root / ".agents" / "skills"))
    print(f"Pulse skill mirrors match ({count} skills).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
