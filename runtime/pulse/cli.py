"""Command-line entry point for repository-local Pulse automation."""

from __future__ import annotations

import argparse
import sys

from pulse.verify import VerificationError, verify_workspace


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pulse", description="Pulse workspace automation")
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("verify", help="run all reproducible workspace smoke checks")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "verify":
        try:
            verify_workspace()
        except VerificationError as error:
            print(f"pulse verify failed: {error}", file=sys.stderr)
            return 1
        print("pulse verify passed")
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
