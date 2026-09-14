#!/usr/bin/env python3
"""Reject an incomplete or unexplained visual fidelity checklist."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


def verify_checklist(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    failures: list[str] = []
    if "__" in text:
        failures.append("unresolved template marker")
    if re.search(r"\bPending\b", text, re.IGNORECASE):
        failures.append("pending result")
    if "- [ ]" in text:
        failures.append("unchecked interaction requirement")
    rows = [line for line in text.splitlines() if line.startswith("|")]
    evidence_rows = [line for line in rows if not re.match(r"^\|\s*(?:---|Requirement|View/state)", line)]
    if len(evidence_rows) < 18:
        failures.append("missing requirement or rendered-comparison rows")
    for line in evidence_rows:
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) < 4 or not cells[1] or not cells[2] or cells[3].lower() != "pass":
            failures.append(f"incomplete evidence row: {line}")
    verdicts = re.findall(r"^Verdict:\s*(.+)$", text, re.IGNORECASE | re.MULTILINE)
    if len(verdicts) != 1 or verdicts[0].strip().upper() != "COMPLETE":
        failures.append("verdict is not COMPLETE")
    if failures:
        raise ValueError("; ".join(failures))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checklist", type=Path)
    args = parser.parse_args()
    try:
        verify_checklist(args.checklist)
    except (OSError, ValueError) as error:
        print(f"fidelity gate failed: {error}")
        return 1
    print("Fidelity checklist complete: requirements and matching rendered views have evidence.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
