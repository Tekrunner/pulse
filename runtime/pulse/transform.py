"""Snapshot-only INSEE CPI landing, dbt publication, and selection orchestration."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Any
from datetime import date

import duckdb

from pulse.archive import ArchiveError, reject_lfs_pointer
from pulse.contracts.dataset import DATASET_SCHEMA_ID, DATASET_SCHEMA_VERSION, DatasetManifest, diagnostic, validate_dataset_manifest
from pulse.contracts.landing import LANDING_SCHEMA_ID, LANDING_SCHEMA_VERSION, LandingManifest, validate_landing_manifest
from pulse.contracts.snapshot import validate_snapshot_manifest
from pulse.sources import ROOT, discover_sources


class TransformError(RuntimeError):
    """A candidate was rejected; selected publication, if any, remains untouched."""


REQUIRED = {"IDBANK", "TITLE_FR", "TIME_PERIOD", "OBS_VALUE", "FREQ", "REF_AREA", "UNIT_MULT"}
SERIES = {
    "011814056": ("cpi_index", "Indice des prix à la consommation - Base 2025 - Ensemble des ménages - France - Ensemble hors Tabac", "Index", "CPI level, Base 2025 = 100, all households, France, excluding tobacco", "2"),
    "011814057": ("monthly_change_pct", "Indice des prix à la consommation - Base 2025 - Variation mensuelle - Ensemble des ménages - France - Ensemble hors Tabac", "Percent", "Provider-published month-over-month percentage change", "1"),
    "011814058": ("annual_change_pct", "Indice des prix à la consommation - Base 2025 - Glissement annuel - Ensemble des ménages - France - Ensemble hors Tabac", "Percent", "Provider-published year-over-year percentage change", "1"),
}
CATEGORY_SERIES = {
    "011813717": "food_index",
    "011813719": "food_annual_change_pct",
    "011813864": "energy_index",
    "011813866": "energy_annual_change_pct",
    "011815633": "actual_rent_index",
    "011814578": "food_weight",
    "011814509": "energy_weight",
    "011815638": "actual_rent_weight",
    "011813664": "food_official_contribution_pct_points",
    "011813665": "services_official_contribution_pct_points",
    "011813666": "manufactured_products_official_contribution_pct_points",
    "011813668": "energy_official_contribution_pct_points",
}

CATEGORY_SCHEMA = {
    "period": "DATE",
    "food_index": "DECIMAL(12,2)",
    "food_annual_change_pct": "DECIMAL(8,1)",
    "energy_index": "DECIMAL(12,2)",
    "energy_annual_change_pct": "DECIMAL(8,1)",
    "actual_rent_index": "DECIMAL(12,2)",
    "food_official_contribution_pct_points": "DECIMAL(8,3)",
    "services_official_contribution_pct_points": "DECIMAL(8,3)",
    "manufactured_products_official_contribution_pct_points": "DECIMAL(8,3)",
    "energy_official_contribution_pct_points": "DECIMAL(8,3)",
    "food_weight": "DECIMAL(8,0)",
    "food_weight_reference_year": "INTEGER",
    "energy_weight": "DECIMAL(8,0)",
    "energy_weight_reference_year": "INTEGER",
    "actual_rent_weight": "DECIMAL(8,0)",
    "actual_rent_weight_reference_year": "INTEGER",
    "actual_rent_annual_change_pct": "DECIMAL(8,1)",
    "actual_rent_pulse_contribution_pct_points": "DECIMAL(8,3)",
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _schema(connection: duckdb.DuckDBPyConnection, parquet: Path) -> dict[str, str]:
    return {name: kind for name, kind, *_ in connection.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(parquet)]).fetchall()}


def _snapshot(archive_root: Path, *, required_series: set[str] | None = None) -> tuple[Path, Any]:
    candidates: list[tuple[str, Path, Any]] = []
    source_root = archive_root / "insee-cpi"
    for manifest_path in source_root.glob("*/snapshot.json"):
        try:
            manifest = validate_snapshot_manifest(json.loads(manifest_path.read_text(encoding="utf-8")))
            raw = manifest_path.parent / "raw.parquet"
            reject_lfs_pointer(raw)
            if not raw.is_file() or _sha256(raw) != manifest.artifacts[0]["sha256"]:
                raise TransformError("snapshot raw artifact hash does not match its manifest")
            if required_series is not None:
                con = duckdb.connect()
                try:
                    observed = {row[0] for row in con.execute("SELECT DISTINCT IDBANK FROM read_parquet(?)", [str(raw)]).fetchall()}
                finally:
                    con.close()
                if observed != required_series:
                    continue
            candidates.append((manifest.source_data_date or "", manifest_path.parent, manifest))
        except (ArchiveError, ValueError, OSError) as error:
            raise TransformError("snapshot contract is invalid; candidate rejected") from error
    if not candidates:
        raise TransformError("no valid INSEE snapshot is available for replay")
    _, path, manifest = max(candidates, key=lambda candidate: (candidate[0], candidate[1].name))
    return path, manifest


def _write_landing(raw: Path, snapshot: Any, root: Path) -> tuple[Path, LandingManifest]:
    root.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".landing-", dir=root))
    try:
        landing = staging / "landing.parquet"
        con = duckdb.connect()
        try:
            observed = _schema(con, raw)
            missing = REQUIRED - set(observed)
            if missing:
                raise TransformError("landing is missing required INSEE contract fields")
            if any(kind != "VARCHAR" for kind in observed.values()):
                raise TransformError("landing source fields must remain faithful VARCHAR values")
            _validate_insee_landing(con, raw)
            # COPY makes landing independent of raw file paths while preserving all provider fields.
            # DuckDB does not bind COPY destinations consistently across releases.
            # Both paths are runtime-owned Paths; quote them as SQL string literals.
            quote = lambda path: "'" + str(path).replace("'", "''") + "'"
            con.execute(f"COPY (SELECT * FROM read_parquet({quote(raw)})) TO {quote(landing)} (FORMAT PARQUET)")
            rows = con.execute("SELECT count(*) FROM read_parquet(?)", [str(landing)]).fetchone()[0]
        finally:
            con.close()
        additions = sorted(set(observed) - REQUIRED - {"DECIMALS", "OBS_STATUS", "OBS_QUAL", "DATE_JO", "LAST_UPDATE", "OBS_TYPE", "OBS_REV", "TITLE_EN", "UNIT_MEASURE"})
        manifest = LandingManifest(LANDING_SCHEMA_ID, LANDING_SCHEMA_VERSION, "insee-cpi", snapshot.snapshot_id,
            snapshot.artifacts[0]["sha256"], "landing.parquet", _sha256(landing), rows, observed, additions)
        validate_landing_manifest(manifest.to_dict())
        final = root / "landing.parquet"
        final_manifest = root / "landing.json"
        landing.replace(final)
        final_manifest.write_text(json.dumps(manifest.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return final, manifest
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def _validate_insee_landing(connection: duckdb.DuckDBPyConnection, raw: Path) -> None:
    """Reject raw data that cannot form the declared one-value-per-series monthly model."""
    allowed = tuple(SERIES | {"011813718": "food_monthly_change_pct"} | CATEGORY_SERIES)
    invalid = connection.execute("""
        SELECT count(*) FROM read_parquet(?)
        WHERE IDBANK NOT IN (SELECT * FROM unnest(?))
           OR REF_AREA != 'FE' OR UNIT_MULT != '0'
    """, [str(raw), list(allowed)]).fetchone()[0]
    duplicates = connection.execute("""
        SELECT count(*) FROM (
          SELECT IDBANK, TIME_PERIOD FROM read_parquet(?) GROUP BY IDBANK, TIME_PERIOD HAVING count(*) != 1
        )
    """, [str(raw)]).fetchone()[0]
    titles = connection.execute("SELECT IDBANK, min(TITLE_FR), max(TITLE_FR) FROM read_parquet(?) GROUP BY IDBANK", [str(raw)]).fetchall()
    declared = discover_sources()["insee-cpi"].configuration["series"]
    expected_titles = {item["id"]: item["name"] for item in declared}
    observed_titles = {series_id: minimum for series_id, minimum, maximum in titles if minimum == maximum}
    # The original three-series snapshot remains valid and replayable; a new
    # expanded snapshot must contain the entire declared category scope.
    if invalid or duplicates or set(observed_titles) not in ({*SERIES}, set(expected_titles)) or any(observed_titles[key] != expected_titles[key] for key in observed_titles):
        raise TransformError("landing does not match the declared INSEE series contract")


def _dbt(project: Path, landing: Path, output: Path, warehouse: Path, model: str = "insee_cpi_monthly") -> None:
    executable = str(Path(sys.executable).with_name("dbt.exe" if os.name == "nt" else "dbt"))
    env = {key: value for key, value in os.environ.items() if not key.startswith("DBT_")}
    env.update({"DBT_PROFILES_DIR": str(project), "PULSE_DBT_DATABASE": str(warehouse), "DBT_SEND_ANONYMOUS_USAGE_STATS": "false"})
    variables = json.dumps({"landing_path": str(landing), "external_location": str(output)})
    run = subprocess.run(
        [executable, "build", "--select", "+" + model, "--vars", variables],
        cwd=project,
        env=env,
        text=True,
        capture_output=True,
        check=False,
        timeout=120,
    )
    if run.returncode:
        raise TransformError("dbt could not materialize the INSEE analytical candidate")
    if not output.is_file():
        raise TransformError("dbt external publication did not create Parquet")


def _validate_candidate(
    parquet: Path, *, source_data_date: str | None = None, expected_publication_advance: str = ""
) -> tuple[dict[str, str], dict[str, Any], dict[str, str]]:
    con = duckdb.connect()
    try:
        schema = _schema(con, parquet)
        expected = {"period": "DATE", "cpi_index": "DECIMAL(12,2)", "monthly_change_pct": "DECIMAL(8,1)", "annual_change_pct": "DECIMAL(8,1)"}
        if schema != expected:
            raise TransformError("dbt candidate schema does not match the INSEE dataset contract")
        count, distinct_periods, start, end, nulls = con.execute("""
            SELECT count(*), count(DISTINCT period), min(period)::VARCHAR, max(period)::VARCHAR,
                   sum(CASE WHEN period IS NULL OR cpi_index IS NULL OR monthly_change_pct IS NULL OR annual_change_pct IS NULL THEN 1 ELSE 0 END)
            FROM read_parquet(?)
        """, [str(parquet)]).fetchone()
        if count < 24 or count != distinct_periods or nulls:
            raise TransformError("dbt candidate has invalid INSEE monthly grain or represented period")
        gaps = con.execute(
            "SELECT count(*) FROM (SELECT period, lag(period) over (order by period) AS previous_period FROM read_parquet(?)) WHERE previous_period IS NOT NULL AND period != previous_period + interval 1 month",
            [str(parquet)],
        ).fetchone()[0]
        if gaps:
            raise TransformError("dbt candidate periods are not contiguous")
        failures: list[dict[str, Any]] = []
        if con.execute("SELECT count(*) FROM read_parquet(?) WHERE cpi_index <= 0 OR monthly_change_pct NOT BETWEEN -100 AND 100 OR annual_change_pct NOT BETWEEN -100 AND 100", [str(parquet)]).fetchone()[0]:
            failures.append({"check": "plausibility", "affected_columns": ["cpi_index", "monthly_change_pct", "annual_change_pct"]})
        mismatch = con.execute("""
          SELECT count(*) FROM (SELECT *, round((cpi_index / lag(cpi_index) over (order by period) - 1) * 100, 1) recomputed FROM read_parquet(?))
          WHERE recomputed IS NOT NULL AND abs(monthly_change_pct - recomputed) > 0.051
        """, [str(parquet)]).fetchone()[0]
        if mismatch:
            failures.append({"check": "provider_monthly_change", "affected_columns": ["cpi_index", "monthly_change_pct"]})
        annual_mismatch = con.execute("""
          SELECT count(*) FROM (SELECT *, round((cpi_index / lag(cpi_index, 12) over (order by period) - 1) * 100, 1) recomputed FROM read_parquet(?))
          WHERE recomputed IS NOT NULL AND abs(annual_change_pct - recomputed) > 0.051
        """, [str(parquet)]).fetchone()[0]
        if annual_mismatch:
            failures.append({"check": "provider_annual_change", "affected_columns": ["cpi_index", "annual_change_pct"]})
        if _is_stale(source_data_date, expected_publication_advance):
            failures.append({"check": "release_calendar_freshness", "affected_columns": []})
        return schema, {"state": "suspect" if failures else "succeeded", "assertions": failures}, {"start": start, "end": end}
    finally:
        con.close()


def _is_stale(source_data_date: str | None, expected_publication_advance: str) -> bool:
    """Apply cadence-aware month-end grace without treating an early fetch as stale."""
    if source_data_date is None:
        return True
    try:
        represented = date.fromisoformat(source_data_date)
    except ValueError:
        return True
    cadence = expected_publication_advance.lower()
    months = 12 if "annual" in cadence or "year" in cadence else 1
    deadline_month = represented.month + months + 1
    deadline_year = represented.year + (deadline_month - 1) // 12
    deadline_month = (deadline_month - 1) % 12 + 1
    deadline = date(deadline_year, deadline_month, 1)
    return date.today() >= deadline


def _manifest(snapshot: Any, landing: LandingManifest, parquet: Path, schema: dict[str, str], status: dict[str, Any], represented_period: dict[str, str]) -> DatasetManifest:
    columns = [{"name": "period", "type": schema["period"], "description": "First day of the represented month."}]
    indicators = []
    declaration = discover_sources()["insee-cpi"]
    for series_id, (name, title, unit, definition, precision) in SERIES.items():
        columns.append({"name": name, "type": schema[name], "description": definition, "indicator_id": series_id})
        indicators.append({"column": name, "provider_series_id": series_id, "provider_title_fr": title, "definition": definition, "unit": unit, "decimal_precision": precision, "base": "2025", "source": "INSEE", "licence": declaration.licence, "attribution": declaration.attribution})
    return DatasetManifest(DATASET_SCHEMA_ID, DATASET_SCHEMA_VERSION, "insee-cpi/monthly", "insee-cpi", "insee_cpi_monthly", "public", "dataset.parquet", _sha256(parquet), represented_period, {"snapshot_id": snapshot.snapshot_id, "snapshot_sha256": snapshot.artifacts[0]["sha256"], "landing_sha256": landing.parquet_sha256, "native_fields": ["OBS_STATUS", "OBS_QUAL", "DATE_JO", "LAST_UPDATE"]}, {"name": "insee_cpi_monthly", "description": "Wide monthly INSEE CPI, Base 2025."}, columns, indicators, status)


def replay_insee(*, archive_root: Path = ROOT / "snapshots/public", landing_root: Path = ROOT / "build/landing/public/insee-cpi", publish_root: Path = ROOT / "publish/public/data/insee-cpi/monthly") -> DatasetManifest:
    """Rebuild a selected INSEE publication without reading prior landing or output."""
    try:
        snapshot_path, snapshot = _snapshot(archive_root, required_series=set(SERIES))
        landing_path, landing = _write_landing(snapshot_path / "raw.parquet", snapshot, landing_root)
        publish_root.parent.mkdir(parents=True, exist_ok=True)
        staging = Path(tempfile.mkdtemp(prefix=".publish-", dir=publish_root.parent))
        try:
            candidate = staging / "dataset.parquet"
            _dbt(ROOT / "sources/insee-cpi/dbt", landing_path, candidate, staging / "warehouse.duckdb")
            declaration = discover_sources()["insee-cpi"]
            schema, status, represented_period = _validate_candidate(
                candidate,
                source_data_date=snapshot.source_data_date,
                expected_publication_advance=declaration.expected_publication_advance,
            )
            manifest = _manifest(snapshot, landing, candidate, schema, status, represented_period)
            validate_dataset_manifest(manifest.to_dict())
            publish_root.mkdir(parents=True, exist_ok=True)
            candidate.replace(publish_root / "dataset.parquet")
            (publish_root / "dataset.json").write_text(json.dumps(manifest.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
            return manifest
        finally:
            shutil.rmtree(staging, ignore_errors=True)
    except TransformError as error:
        _write_diagnostic(publish_root, "candidate_rejected", str(error))
        raise
    except Exception as error:
        sanitized = TransformError("INSEE replay failed; retained any prior usable publication")
        _write_diagnostic(publish_root, "replay_failed", str(sanitized))
        raise sanitized from error


def replay_insee_category_analysis(*, archive_root: Path = ROOT / "snapshots/public", landing_root: Path = ROOT / "build/landing/public/insee-cpi-category-analysis", publish_root: Path = ROOT / "publish/public/data/insee-cpi/category-analysis") -> DatasetManifest:
    """Publish the additive category contract from an expanded immutable snapshot.

    Annual weights are context, joined as the latest reference year not after the
    represented month. Rent annual change is index-derived; its weighted value is
    a Pulse approximation, never an official INSEE contribution.
    """
    try:
        required = set(SERIES) | {"011813718"} | set(CATEGORY_SERIES)
        snapshot_path, snapshot = _snapshot(archive_root, required_series=required)
        landing_path, landing = _write_landing(
            snapshot_path / "raw.parquet", snapshot, landing_root
        )
        publish_root.parent.mkdir(parents=True, exist_ok=True)
        staging = Path(tempfile.mkdtemp(prefix=".publish-", dir=publish_root.parent))
        try:
            candidate = staging / "dataset.parquet"
            _dbt(
                ROOT / "sources/insee-cpi/dbt",
                landing_path,
                candidate,
                staging / "warehouse.duckdb",
                "insee_cpi_category_analysis",
            )
            schema, represented_period = _validate_category_candidate(candidate)
            manifest = _category_manifest(
                snapshot, landing, candidate, schema, represented_period
            )
            validate_dataset_manifest(manifest.to_dict())
            publish_root.mkdir(parents=True, exist_ok=True)
            candidate.replace(publish_root / "dataset.parquet")
            (publish_root / "dataset.json").write_text(
                json.dumps(manifest.to_dict(), indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            return manifest
        finally:
            shutil.rmtree(staging, ignore_errors=True)
    except TransformError as error:
        _write_diagnostic(publish_root, "candidate_rejected", str(error))
        raise
    except Exception as error:
        sanitized = TransformError(
            "INSEE category-analysis replay failed; retained any prior usable publication"
        )
        _write_diagnostic(publish_root, "replay_failed", str(sanitized))
        raise sanitized from error


def _validate_category_candidate(parquet: Path) -> tuple[dict[str, str], dict[str, str]]:
    connection = duckdb.connect()
    try:
        schema = _schema(connection, parquet)
        if schema != CATEGORY_SCHEMA:
            raise TransformError("category-analysis candidate schema is invalid")
        null_predicate = " OR ".join(f'"{name}" IS NULL' for name in CATEGORY_SCHEMA)
        row = connection.execute(
            f"""
            SELECT count(*), count(DISTINCT period), min(period)::VARCHAR, max(period)::VARCHAR,
                   count(*) FILTER (WHERE {null_predicate}),
                   count(*) FILTER (
                     WHERE food_weight_reference_year > year(period)
                        OR energy_weight_reference_year > year(period)
                        OR actual_rent_weight_reference_year > year(period)
                   ),
                   count(*) FILTER (
                     WHERE abs(actual_rent_pulse_contribution_pct_points
                       - round(actual_rent_weight / 10000.0 * actual_rent_annual_change_pct, 3)) > 0.0005
                   )
            FROM read_parquet(?)
            """,
            [str(parquet)],
        ).fetchone()
        rows, distinct, start, end, missing, future_weights, bad_formula = row
        gaps = connection.execute(
            """
            SELECT count(*)
            FROM (
              SELECT period, lag(period) OVER (ORDER BY period) AS previous_period
              FROM read_parquet(?)
            )
            WHERE previous_period IS NOT NULL
              AND period != previous_period + interval 1 month
            """,
            [str(parquet)],
        ).fetchone()[0]
        if rows < 24 or rows != distinct or missing:
            raise TransformError(
                "category-analysis candidate lacks complete comparable category and annual-weight coverage"
            )
        if gaps:
            raise TransformError("category-analysis candidate periods are not contiguous")
        if future_weights:
            raise TransformError("category-analysis candidate uses a future annual basket weight")
        if bad_formula:
            raise TransformError("category-analysis rent contribution formula is invalid")
        return schema, {"start": start, "end": end}
    finally:
        connection.close()


def _category_manifest(
    snapshot: Any,
    landing: LandingManifest,
    parquet: Path,
    schema: dict[str, str],
    represented_period: dict[str, str],
) -> DatasetManifest:
    declaration = discover_sources()["insee-cpi"]
    by_id = {item["id"]: item["name"] for item in declaration.configuration["series"]}
    column_to_id = {name: series_id for series_id, name in CATEGORY_SERIES.items()}
    for prefix, series_id in (
        ("food", "011814578"),
        ("energy", "011814509"),
        ("actual_rent", "011815638"),
    ):
        column_to_id[f"{prefix}_weight_reference_year"] = series_id
    column_to_id["actual_rent_annual_change_pct"] = "011815633"
    column_to_id["actual_rent_pulse_contribution_pct_points"] = "011815638"

    descriptions = {
        "period": "First day of the represented month; output stops at the latest common complete provider period.",
        "food_index": "INSEE food CPI level, Base 2025 = 100, all households, France.",
        "food_annual_change_pct": "INSEE provider-published food year-over-year change.",
        "energy_index": "INSEE energy CPI level, Base 2025 = 100, all households, France.",
        "energy_annual_change_pct": "INSEE provider-published energy year-over-year change.",
        "actual_rent_index": "INSEE actual rents paid CPI level, COICOP 04.1, Base 2025 = 100, all households, France.",
        "actual_rent_annual_change_pct": "Pulse-derived year-over-year rent-index change: (index_t / index_t-12 - 1) * 100.",
        "actual_rent_pulse_contribution_pct_points": "Pulse calculation: actual_rent_weight / 10000 * actual_rent_annual_change_pct; not an official INSEE contribution and not causal.",
    }
    for prefix in ("food", "energy", "actual_rent"):
        descriptions[f"{prefix}_weight"] = (
            "INSEE annual CPI basket weight per 10,000, carried as context for the named reference year."
        )
        descriptions[f"{prefix}_weight_reference_year"] = (
            "INSEE annual weight observation year; not a monthly observation."
        )
    for prefix in ("food", "services", "manufactured_products", "energy"):
        descriptions[f"{prefix}_official_contribution_pct_points"] = (
            "INSEE provider-published contribution to headline year-over-year CPI, in percentage points."
        )

    columns = [
        {"name": name, "type": kind, "description": descriptions[name]}
        for name, kind in schema.items()
    ]
    indicators = []
    for name in schema:
        if name == "period":
            continue
        series_id = column_to_id[name]
        derived = name in {
            "actual_rent_annual_change_pct",
            "actual_rent_pulse_contribution_pct_points",
        }
        if name.endswith("_reference_year"):
            unit = "Year"
        elif name.endswith("_weight"):
            unit = "Weight per 10,000"
        elif name.endswith("_contribution_pct_points"):
            unit = "Percentage points"
        elif name.endswith("_pct"):
            unit = "Percent"
        else:
            unit = "Index"
        indicators.append(
            {
                "column": name,
                "provider_series_id": series_id,
                "provider_title_fr": by_id[series_id],
                "definition": descriptions[name],
                "unit": unit,
                "decimal_precision": schema[name].rsplit(",", 1)[-1].rstrip(")")
                if "," in schema[name]
                else "0",
                "base": "2025",
                "source": "Pulse calculation from INSEE series" if derived else "INSEE",
                "licence": declaration.licence,
                "attribution": declaration.attribution,
            }
        )
    stale = _is_stale(snapshot.source_data_date, declaration.expected_publication_advance)
    status = {
        "state": "suspect" if stale else "succeeded",
        "assertions": (
            [{"check": "release_calendar_freshness", "affected_columns": []}]
            if stale
            else []
        ),
    }
    return DatasetManifest(
        DATASET_SCHEMA_ID,
        DATASET_SCHEMA_VERSION,
        "insee-cpi/category-analysis",
        "insee-cpi",
        "insee_cpi_category_analysis",
        "public",
        "dataset.parquet",
        _sha256(parquet),
        represented_period,
        {
            "snapshot_id": snapshot.snapshot_id,
            "snapshot_sha256": snapshot.artifacts[0]["sha256"],
            "landing_sha256": landing.parquet_sha256,
            "weight_join": "latest annual reference year <= represented calendar year",
            "rent_annual_change_formula": "(rent_index[t] / rent_index[t-12] - 1) * 100",
            "rent_contribution_formula": "rent_weight / 10000 * rent_annual_change_pct",
        },
        {
            "name": "insee_cpi_category_analysis",
            "description": "Category CPI levels, official broad contributions, and annual basket-weight context.",
        },
        columns,
        indicators,
        status,
    )


def _write_diagnostic(publish_root: Path, code: str, message: str) -> None:
    """Record a safe failure envelope beside, never inside, selected output."""
    diagnostic_path = publish_root.parent / "diagnostic.json"
    diagnostic_path.parent.mkdir(parents=True, exist_ok=True)
    value = diagnostic("replay", code, message, retryable=True)
    staging = diagnostic_path.with_suffix(".json.tmp")
    staging.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    staging.replace(diagnostic_path)
