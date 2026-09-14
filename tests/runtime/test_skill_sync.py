"""Tests for cross-client Pulse skill mirroring."""

import importlib.util
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "sync_agent_skills.py"
SPEC = importlib.util.spec_from_file_location("sync_agent_skills", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
sync_agent_skills = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync_agent_skills)
compare_mirrors = sync_agent_skills.compare_mirrors
write_mirrors = sync_agent_skills.write_mirrors


def _write_skill(root: Path, name: str, body: str = "instructions") -> Path:
    skill = root / ".agents" / "skills" / name
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: fixture\n---\n{body}\n",
        encoding="utf-8",
    )
    return skill


def test_write_mirrors_complete_skill_directories(tmp_path: Path) -> None:
    skill = _write_skill(tmp_path, "pulse-example")
    (skill / "references").mkdir()
    (skill / "references" / "contract.md").write_text("contract\n", encoding="utf-8")
    stale = tmp_path / ".claude" / "skills" / "pulse-stale"
    stale.mkdir(parents=True)
    managed = tmp_path / ".claude" / "skills" / "bmad-build"
    managed.mkdir(parents=True)
    (managed / "SKILL.md").write_text("managed\n", encoding="utf-8")

    write_mirrors(tmp_path)

    assert not stale.exists()
    assert (managed / "SKILL.md").read_text(encoding="utf-8") == "managed\n"
    assert compare_mirrors(tmp_path) == []
    mirrored_reference = (
        tmp_path / ".claude" / "skills" / "pulse-example" / "references" / "contract.md"
    )
    assert mirrored_reference.read_text(encoding="utf-8") == "contract\n"


def test_compare_reports_missing_extra_and_changed_files(tmp_path: Path) -> None:
    skill = _write_skill(tmp_path, "pulse-example")
    (skill / "expected.txt").write_text("expected\n", encoding="utf-8")
    write_mirrors(tmp_path)
    mirror = tmp_path / ".claude" / "skills" / "pulse-example"
    (mirror / "SKILL.md").write_text("changed\n", encoding="utf-8")
    (mirror / "expected.txt").unlink()
    (mirror / "extra.txt").write_text("extra\n", encoding="utf-8")

    assert compare_mirrors(tmp_path) == [
        "pulse-example: missing expected.txt",
        "pulse-example: extra extra.txt",
        "pulse-example: changed SKILL.md",
    ]


def test_generated_python_caches_do_not_create_drift(tmp_path: Path) -> None:
    skill = _write_skill(tmp_path, "pulse-example")
    cache = skill / "scripts" / "__pycache__"
    cache.mkdir(parents=True)
    (cache / "helper.pyc").write_bytes(b"cache")

    write_mirrors(tmp_path)

    assert compare_mirrors(tmp_path) == []
    mirror_cache = (
        tmp_path / ".claude" / "skills" / "pulse-example" / "scripts" / "__pycache__"
    )
    assert not mirror_cache.exists()
