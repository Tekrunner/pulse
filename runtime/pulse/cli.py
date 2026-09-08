"""Command-line entry point for repository-local Pulse automation."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pulse.archive import AcquisitionIntegrityError, ArchiveError, archive_rows, issue_acquisition_id, utc_now
from pulse.datasets import DatasetError, build_all_datasets, build_dataset, discover_datasets
from pulse.sources import SourceDeclarationError, acquire_from_adapter, discover_sources
from pulse.verify import VerificationError, verify_workspace
from pulse.site import run_site
from pulse.catalog import compile_browser_catalog, write_browser_catalog, write_report_catalog
from pulse.contracts.snapshot import ContractError


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pulse", description="Pulse workspace automation")
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("verify", help="run all reproducible workspace smoke checks")
    site = subcommands.add_parser("site", help="build or locally serve the report site")
    site_subcommands = site.add_subparsers(dest="site_command", required=True)
    site_subcommands.add_parser("build", help="build the static site artifact")
    site_subcommands.add_parser("serve", help="serve the Observable site locally")
    catalog = subcommands.add_parser("catalog", help="compile browser catalog contracts")
    catalog_subcommands = catalog.add_subparsers(dest="catalog_command", required=True)
    catalog_build = catalog_subcommands.add_parser("build", help="compile public browser-data.json")
    catalog_build.add_argument("--output", type=Path, required=True)
    catalog_build.add_argument("--publish-root", type=Path, default=Path("publish/public"), help=argparse.SUPPRESS)
    catalog_build.add_argument("--parquet-prefix", default="datasets", help=argparse.SUPPRESS)
    catalog_build.add_argument("--reports-output", type=Path, help=argparse.SUPPRESS)
    catalog_build.add_argument("--reports-root", type=Path, default=Path("site/reports"), help=argparse.SUPPRESS)
    source = subcommands.add_parser("source", help="acquire one declared source")
    source_subcommands = source.add_subparsers(dest="source_command", required=True)
    acquire = source_subcommands.add_parser("acquire", help="archive a faithful raw source snapshot")
    acquire.add_argument("source_id", help="declared source ID")
    acquisition_mode = acquire.add_mutually_exclusive_group()
    acquisition_mode.add_argument(
        "--fixture", type=Path, help="recorded response; never contacts the provider"
    )
    acquisition_mode.add_argument(
        "--live", action="store_true", help="explicitly contact the declared provider URL"
    )
    acquire.add_argument("--acquisition-id", help="reuse an opaque ID on a logical retry")
    acquire.add_argument("--archive-root", type=Path, default=Path("snapshots/public"), help=argparse.SUPPRESS)
    dataset = subcommands.add_parser("dataset", help="build declared datasets from snapshots")
    dataset_subcommands = dataset.add_subparsers(dest="dataset_command", required=True)
    dataset_build = dataset_subcommands.add_parser("build", help="build one dataset or all datasets")
    dataset_build.add_argument("dataset_id", help="declared dataset ID or 'all'")
    dataset_build.add_argument("--archive-root", type=Path, default=Path("snapshots/public"), help=argparse.SUPPRESS)
    dataset_build.add_argument("--build-root", type=Path, default=Path("build/datasets/public"), help=argparse.SUPPRESS)
    dataset_build.add_argument("--publish-root", type=Path, default=Path("publish/public/data"), help=argparse.SUPPRESS)
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
    if args.command == "site":
        try:
            run_site(args.site_command)
        except VerificationError as error:
            print(f"pulse site {args.site_command} failed: {error}", file=sys.stderr)
            return 1
        return 0
    if args.command == "catalog":
        try:
            output = write_browser_catalog(args.output, publish_root=args.publish_root, parquet_prefix=args.parquet_prefix)
            if args.reports_output:
                write_report_catalog(
                    args.reports_output,
                    reports_root=args.reports_root,
                    browser_catalog=compile_browser_catalog(args.publish_root, parquet_prefix=args.parquet_prefix),
                )
        except (ContractError, OSError) as error:
            print(f"pulse catalog build failed: {error}", file=sys.stderr)
            return 1
        print(f"pulse catalog build wrote {output}")
        return 0
    if args.command == "dataset":
        try:
            if args.dataset_id == "all":
                manifests = build_all_datasets(
                    archive_root=args.archive_root.resolve(),
                    build_root=args.build_root.resolve(),
                    publish_root=args.publish_root.resolve(),
                )
            else:
                declaration = discover_datasets().get(args.dataset_id)
                if declaration is None:
                    raise DatasetError(f"declared dataset '{args.dataset_id}' was not found")
                manifests = [
                    build_dataset(
                        declaration,
                        archive_root=args.archive_root.resolve(),
                        build_root=args.build_root.resolve(),
                        publish_root=args.publish_root.resolve() / declaration.dataset_id,
                    )
                ]
        except DatasetError as error:
            print(f"pulse dataset build failed: {error}", file=sys.stderr)
            return 1
        published = ", ".join(
            f"{manifest.dataset_id} ({manifest.status['state']})" for manifest in manifests
        )
        print(f"pulse dataset build published {published}")
        return 0
    if args.command == "source":
        try:
            declaration = discover_sources().get(args.source_id)
            if declaration is None:
                raise SourceDeclarationError(f"declared source '{args.source_id}' was not found")
            acquired = acquire_from_adapter(declaration, fixture=args.fixture, live=args.live)
            snapshot, no_op = archive_rows(
                root=args.archive_root, source_id=declaration.source_id,
                acquisition_id=args.acquisition_id or issue_acquisition_id(), acquired_at=utc_now(),
                source_data_date=acquired.source_data_date, source_urls=acquired.source_urls,
                rows=acquired.rows, decoder_version=acquired.decoder_version,
                licence=declaration.licence, attribution=declaration.attribution,
            )
        except (SourceDeclarationError, ArchiveError, AcquisitionIntegrityError, ValueError) as error:
            print(f"pulse source acquire failed: {error}", file=sys.stderr)
            return 1
        action = "no-op; retained" if no_op else "archived"
        print(f"pulse source acquire {action} snapshot {snapshot}")
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
