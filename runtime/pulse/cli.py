"""Command-line entry point for repository-local Pulse automation."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import sys
from pathlib import Path

from pulse.automation import (
    PublicationStagingError,
    RefreshError,
    refresh_source,
    stage_refresh_artifacts,
)
from pulse.archive import AcquisitionIntegrityError, ArchiveError, archive_rows, issue_acquisition_id, utc_now
from pulse.datasets import DatasetError, build_all_datasets, build_dataset, discover_datasets
from pulse.sources import SourceDeclarationError, acquire_from_adapter, discover_sources
from pulse.verify import VerificationError, verify_workspace
from pulse.site import run_site
from pulse.public import PublicBuildError, build_public_site
from pulse.catalog import (
    compile_browser_catalog,
    compile_status_catalog,
    public_dataset_closure,
    status_report,
    write_browser_catalog,
    write_report_catalog,
    write_status_catalog,
)
from pulse.contracts.snapshot import ContractError


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pulse", description="Pulse workspace automation")
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("verify", help="run all reproducible workspace smoke checks")
    public = subcommands.add_parser("public", help="build the complete offline public artifact")
    public.add_argument("public_command", nargs="?", choices=("build",), default="build")
    public.add_argument("--output", type=Path, default=Path("dist"), help="verified site directory")
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
    catalog_build.add_argument("--status-output", type=Path, help=argparse.SUPPRESS)
    catalog_build.add_argument("--archive-root", type=Path, default=Path("snapshots/public"), help=argparse.SUPPRESS)
    catalog_build.add_argument("--generated-at", help=argparse.SUPPRESS)
    catalog_build.add_argument("--site-attempted-at", help=argparse.SUPPRESS)
    catalog_build.add_argument("--public-closure", action="store_true", help=argparse.SUPPRESS)
    status = subcommands.add_parser("status", help="print the derived state of every expected pipeline")
    status.add_argument("--archive-root", type=Path, default=Path("snapshots/public"), help=argparse.SUPPRESS)
    status.add_argument("--publish-root", type=Path, default=Path("publish/public"), help=argparse.SUPPRESS)
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
    refresh = source_subcommands.add_parser(
        "refresh", help="acquire one source and build its declared dependents"
    )
    refresh.add_argument("source_id", help="declared source ID")
    refresh.add_argument("--logical-run-key", required=True, help="stable identity shared by retries")
    refresh_mode = refresh.add_mutually_exclusive_group()
    refresh_mode.add_argument("--fixture", type=Path, help="recorded response; never contacts the provider")
    refresh_mode.add_argument("--live", action="store_true", help="explicitly contact the declared provider URL")
    refresh.add_argument("--archive-root", type=Path, default=Path("snapshots/public"), help=argparse.SUPPRESS)
    refresh.add_argument("--build-root", type=Path, default=Path("build/datasets/public"), help=argparse.SUPPRESS)
    refresh.add_argument("--publish-root", type=Path, default=Path("publish/public/data"), help=argparse.SUPPRESS)
    stage_publication = source_subcommands.add_parser(
        "stage-publication", help="stage one source and its declared dependent artifacts"
    )
    stage_publication.add_argument("source_id", help="declared source ID")
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
    if args.command == "public":
        try:
            output = build_public_site(output=args.output)
        except PublicBuildError as error:
            print(f"pulse public failed: {error}", file=sys.stderr)
            return 1
        print(f"pulse public wrote verified artifact {output}")
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
            output = write_browser_catalog(
                args.output,
                publish_root=args.publish_root,
                parquet_prefix=args.parquet_prefix,
                reports_root=args.reports_root,
            )
            if args.reports_output:
                write_report_catalog(
                    args.reports_output,
                    reports_root=args.reports_root,
                    browser_catalog=compile_browser_catalog(
                        args.publish_root,
                        parquet_prefix=args.parquet_prefix,
                        reports_root=args.reports_root,
                    ),
                )
            if args.status_output:
                write_status_catalog(
                    args.status_output,
                    archive_root=args.archive_root,
                    publish_root=args.publish_root,
                    generated_at=args.generated_at,
                    site_attempted_at=args.site_attempted_at,
                    dataset_ids=public_dataset_closure(args.reports_root)
                    if args.public_closure
                    else None,
                )
        except (ContractError, OSError) as error:
            print(f"pulse catalog build failed: {error}", file=sys.stderr)
            return 1
        print(f"pulse catalog build wrote {output}")
        return 0
    if args.command == "status":
        try:
            catalog = compile_status_catalog(
                archive_root=args.archive_root, publish_root=args.publish_root
            )
        except (ContractError, OSError) as error:
            print(f"pulse status failed: {error}", file=sys.stderr)
            return 1
        now = datetime.now(timezone.utc)
        # Staleness is resolved here against this clock, exactly as the browser
        # resolves it against the reader's; the artifact stores no state string.
        print(f"pulse status at {now.replace(microsecond=0).isoformat().replace('+00:00', 'Z')}")
        for line in status_report(catalog, now):
            print(line)
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
        if args.source_command == "stage-publication":
            try:
                paths = stage_refresh_artifacts(args.source_id)
            except PublicationStagingError as error:
                print(f"pulse source stage-publication failed: {error}", file=sys.stderr)
                return 1
            print(
                "pulse source stage-publication staged "
                + ", ".join(path.as_posix() for path in paths)
            )
            return 0
        if args.source_command == "refresh":
            try:
                outcome = refresh_source(
                    args.source_id,
                    logical_run_key=args.logical_run_key,
                    fixture=args.fixture,
                    live=args.live,
                    archive_root=args.archive_root.resolve(),
                    build_root=args.build_root.resolve(),
                    publish_root=args.publish_root.resolve(),
                )
            except (RefreshError, ValueError, OSError) as error:
                print(f"pulse source refresh failed: {error}", file=sys.stderr)
                return 1
            if outcome.source_error:
                print(f"pulse source refresh failed: {outcome.source_error}", file=sys.stderr)
                return 1
            if outcome.orchestration_error:
                print(f"pulse source refresh failed: {outcome.orchestration_error}", file=sys.stderr)
                return 1
            failures = [item for item in outcome.datasets if item.error]
            action = "no-op; retained" if outcome.no_op else "archived"
            built = ", ".join(
                f"{item.dataset_id} ({item.manifest.status['state']})"
                for item in outcome.datasets
                if item.manifest is not None
            )
            print(
                f"pulse source refresh {action} snapshot {outcome.snapshot}"
                + (f"; built {built}" if built else "")
            )
            if failures:
                print(
                    "pulse source refresh failed datasets: "
                    + ", ".join(item.dataset_id for item in failures),
                    file=sys.stderr,
                )
                return 1
            return 0
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
