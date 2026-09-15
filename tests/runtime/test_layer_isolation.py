"""Keep the source, dataset and presentation layers from learning about each other.

Prose guidance did not hold on its own. Every coupling this catches announced
itself in a comment explaining *why* — "losing any of these makes the report's
default comparison meaningless", "keeps the choropleth hole-free" — because an
author who reaches down a layer naturally justifies it. So the check reads for
that justification, which is cheap, and it is a check rather than a rule because
the rule and the violation were written in the same sitting.
"""

from __future__ import annotations

from pathlib import Path
import re

import pytest


ROOT = Path(__file__).resolve().parents[2]
SCANNED_SUFFIXES = {".py", ".sql", ".yaml", ".yml", ".md", ".json", ".js", ".mjs"}
IGNORED_PARTS = {"__pycache__", ".venv", "node_modules", "dist", "build"}

# Naming one consumer. These packages serve any of them, so a sentence that
# needs to mention one says "a consumer".
NAMES_A_CONSUMER = re.compile(
    r"the report\b|report's|reports (?:has|is|must|shows|reads|needs)"
    r"|the visual\b|each visual|every visual|the chart\b|the choropleth\b"
    r"|default view|its selector|comparison selector",
    re.IGNORECASE,
)
# "report-facing" is the architecture's own name for what a dataset publishes.
PERMITTED = re.compile(r"report-facing", re.IGNORECASE)

# A visual receives rows, display and provenance. Anything here means it has
# reached for storage, a query or a route of its own.
REACHES_FOR_DATA = re.compile(r"\bduckdb\b|\bparquet\b|read_parquet|\bobservablehq\b", re.IGNORECASE)
OWNS_SQL = re.compile(r"\bSELECT\b[\s\S]{0,300}\bFROM\b")


def _scanned(*roots: str) -> list[Path]:
    files: list[Path] = []
    for root in roots:
        for path in sorted((ROOT / root).rglob("*")):
            if (
                path.is_file()
                and path.suffix in SCANNED_SUFFIXES
                and not IGNORED_PARTS & set(path.parts)
            ):
                files.append(path)
    return files


def _offences(path: Path) -> list[str]:
    found = []
    for number, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
        match = NAMES_A_CONSUMER.search(line)
        if match and not PERMITTED.search(line):
            found.append(f"{path.relative_to(ROOT).as_posix()}:{number}: {line.strip()}")
    return found


def test_no_source_or_dataset_names_a_consumer() -> None:
    """A guarantee that names one consumer breaks when that consumer changes
    its mind, which makes a presentation change edit an acquisition or
    analytical contract."""
    offences = [line for path in _scanned("sources", "datasets") for line in _offences(path)]
    assert not offences, "sources and datasets must not name a consumer:\n" + "\n".join(offences)


def test_no_visual_reaches_for_storage_or_owns_a_query() -> None:
    """The reverse direction. Applies to every visual by construction, so a new
    one is covered without anyone remembering to add it to a list."""
    offences = []
    for path in _scanned("site/visuals"):
        content = path.read_text(encoding="utf-8", errors="ignore")
        if REACHES_FOR_DATA.search(content):
            offences.append(f"{path.relative_to(ROOT).as_posix()}: reaches for storage")
        if OWNS_SQL.search(content):
            offences.append(f"{path.relative_to(ROOT).as_posix()}: owns SQL")
    assert not offences, "visuals receive rows, display and provenance only:\n" + "\n".join(offences)


@pytest.mark.parametrize(
    ("sample", "expected"),
    [
        ("# Losing any of these makes the report's default comparison meaningless", True),
        ("-- This test is the one that keeps the choropleth hole-free.", True),
        ("-- guessed from country names by each visual.", True),
        ("The committed contract is the report-facing semantic authority.", False),
        ("-- Every area outside the exclusions reports all sexes in every quarter", False),
        ("# whichever comparators a consumer chooses", False),
    ],
)
def test_the_check_recognises_its_own_subject(sample: str, expected: bool) -> None:
    """Pinned against the real sentences that carried each coupling, so the
    pattern cannot be loosened into uselessness without a test saying so."""
    flagged = bool(NAMES_A_CONSUMER.search(sample)) and not PERMITTED.search(sample)
    assert flagged is expected
