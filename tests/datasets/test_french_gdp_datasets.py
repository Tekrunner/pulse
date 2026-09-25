"""Offline conformance for the dataset packages behind the French GDP questions.

Each package is rebuilt from the archived snapshot of its own source, with the
network severed. The tests assert what the prose contracts promise: exact
schemas, grain, the accounting identities, deterministic bytes, and that a
rejected candidate leaves the published pair in place.
"""

from __future__ import annotations

import json
from pathlib import Path
import shutil

import duckdb
import pytest

from pulse.datasets import DatasetError, build_dataset, discover_datasets


ROOT = Path(__file__).parents[2]
ARCHIVE = ROOT / "snapshots/public"
PACKAGES = {
    "french-national-accounts-annual": "insee-annual-national-accounts",
    "french-branch-value-added": "insee-annual-national-accounts",
    "french-gdp-quarterly": "insee-quarterly-national-accounts",
    "french-gdp-dollar-decomposition": "world-bank-wdi-gdp",
    "oecd-productivity-comparison": "oecd-productivity-database",
    "french-departement-gdp": "eurostat-regional-gdp",
}


@pytest.fixture(name="offline", autouse=True)
def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "socket.create_connection",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("network")),
    )


@pytest.fixture(name="built", scope="module")
def _built(tmp_path_factory: pytest.TempPathFactory) -> dict[str, tuple[object, Path]]:
    root = tmp_path_factory.mktemp("french-gdp-datasets")
    declarations = discover_datasets()
    results = {}
    for dataset_id in PACKAGES:
        manifest = build_dataset(
            declarations[dataset_id],
            archive_root=ARCHIVE,
            build_root=root / "build" / dataset_id,
            publish_root=root / "publish" / dataset_id,
        )
        results[dataset_id] = (manifest, root / "publish" / dataset_id / "dataset.parquet")
    return results


def _committed(dataset_id: str) -> dict:
    return json.loads((ROOT / "publish/public/data" / dataset_id / "dataset.json").read_text(encoding="utf-8"))


def _first_year(dataset_id: str) -> int:
    """The represented start the committed manifest records, never a literal."""
    return int(_committed(dataset_id)["represented_period"]["start"][:4])


def _query(parquet: Path, sql: str):
    connection = duckdb.connect()
    try:
        return connection.execute(sql.replace("{t}", f"read_parquet('{parquet.as_posix()}')")).fetchall()
    finally:
        connection.close()


def test_packages_are_discovered_from_their_own_sources_with_prose_contracts() -> None:
    # Discovery and contracts are frozen inputs; nothing here restates a release.
    declarations = discover_datasets()
    for dataset_id, source_id in PACKAGES.items():
        declaration = declarations[dataset_id]
        assert declaration.source_id == source_id
        assert (declaration.path.parent / "dataset-contract.md").is_file()


@pytest.mark.parametrize("dataset_id", PACKAGES)
def test_published_schema_is_exactly_the_contract(built, dataset_id: str) -> None:
    manifest, parquet = built[dataset_id]
    declaration = discover_datasets()[dataset_id]
    schema = [(name, kind) for name, kind, *_ in _query(parquet, "DESCRIBE SELECT * FROM {t}")]
    assert schema == [(column["name"], column["type"]) for column in declaration.contract.columns]
    assert _query(parquet, "SELECT count(*) FROM {t}")[0][0] > 0
    assert manifest.lineage["snapshot_id"]


@pytest.mark.parametrize("dataset_id", PACKAGES)
def test_rebuilding_the_same_snapshot_is_byte_identical(built, dataset_id: str, tmp_path: Path) -> None:
    manifest, _parquet = built[dataset_id]
    again = build_dataset(
        discover_datasets()[dataset_id],
        archive_root=ARCHIVE,
        build_root=tmp_path / "build",
        publish_root=tmp_path / "publish",
    )
    assert again.content_sha256 == manifest.content_sha256
    committed = json.loads((ROOT / "publish/public/data" / dataset_id / "dataset.json").read_text(encoding="utf-8"))
    if committed["lineage"]["snapshot_id"] == manifest.lineage["snapshot_id"]:
        assert committed["content_sha256"] == manifest.content_sha256


def test_annual_accounts_are_unbroken_and_close_on_gdp(built) -> None:
    _manifest, parquet = built["french-national-accounts-annual"]
    first, years, gaps = _query(
        parquet,
        """SELECT min(year(period)), count(*),
                  count(*) FILTER (WHERE abs(gdp_current_eur_mn - adjusted_labour_income_eur_mn
                    - adjusted_capital_income_eur_mn - net_taxes_on_production_eur_mn
                    - net_taxes_on_products_eur_mn) > 0.3)
           FROM {t}""",
    )[0]
    assert first == _first_year("french-national-accounts-annual")
    assert years == _query(parquet, "SELECT max(year(period)) - min(year(period)) + 1 FROM {t}")[0][0]
    assert gaps == 0
    # The first row has levels but no growth or contributions: there is no
    # earlier year to change from.
    assert _query(
        parquet, "SELECT gdp_volume_growth_pct, contribution_gfcf_pt FROM {t} ORDER BY period LIMIT 1"
    ) == [(None, None)]


def test_branch_levels_partition_the_economy_and_residuals_carry_no_volume(built) -> None:
    _manifest, parquet = built["french-branch-value-added"]
    levels = dict(
        (level, (branches, first))
        for level, branches, first in _query(
            parquet,
            "SELECT level, count(DISTINCT branch_code), min(year(period)) FROM {t} GROUP BY level",
        )
    )
    # Branch counts come from the declared nomenclature (A38 has no value added
    # for extraterritorial organisations); spans only nest, finest last.
    assert levels["A10"] == (10, _first_year("french-branch-value-added"))
    assert levels["A38"][0] == 37
    assert levels["A10"][1] <= levels["A38"][1] <= levels["A88"][1]
    assert _query(
        parquet,
        "SELECT count(*) FROM {t} WHERE is_residual AND value_added_chained_2020_eur_mn IS NOT NULL",
    ) == [(0,)]
    unbalanced = _query(
        parquet,
        """SELECT count(*) FROM (
             SELECT period, level FROM {t} GROUP BY period, level
             HAVING abs(sum(share_of_total_value_added_pct) - 100) > 0.002 * count(*) + 0.01)""",
    )
    assert unbalanced == [(0,)]


def test_quarterly_growth_is_year_on_year_on_the_same_quarter(built) -> None:
    _manifest, parquet = built["french-gdp-quarterly"]
    mismatched = _query(
        parquet,
        """SELECT count(*) FROM (
             SELECT gdp_year_on_year_growth_pct AS published,
                    100 * (gdp_chained_eur_mn / lag(gdp_chained_eur_mn, 4) OVER (ORDER BY period) - 1) AS recomputed
             FROM {t})
           WHERE recomputed IS NOT NULL AND abs(published - recomputed) > 0.005""",
    )
    assert mismatched == [(0,)]
    assert _query(parquet, "SELECT count(*) FROM {t} WHERE gdp_chained_annualised_eur_mn <> 4 * gdp_chained_eur_mn") == [(0,)]


def test_dollar_decomposition_converts_francs_and_closes(built) -> None:
    _manifest, parquet = built["french-gdp-dollar-decomposition"]
    first, unconverted, unclosed = _query(
        parquet,
        """SELECT min(year(period)),
                  count(*) FILTER (WHERE abs(gdp_current_usd_mn * eur_per_usd / gdp_current_eur_mn - 1) > 0.001),
                  count(*) FILTER (WHERE abs(dollar_gdp_change_log_points - real_growth_log_points
                    - deflator_change_log_points - exchange_rate_change_log_points) > 0.1)
           FROM {t}""",
    )[0]
    assert first == _first_year("french-gdp-dollar-decomposition")
    assert unconverted == 0
    assert unclosed == 0
    # Across the 1998-1999 changeover the converted rate moves by percent, not
    # by the factor of 6.56 (188 log points) an unconverted franc rate would show.
    jump = _query(parquet, "SELECT abs(exchange_rate_change_log_points) FROM {t} WHERE year(period) = 1999")
    if not jump:
        pytest.skip("the current release does not span the euro changeover")
    assert jump[0][0] < 50


def test_oecd_comparison_classifies_areas_and_screens_labour_input(built) -> None:
    _manifest, parquet = built["oecd-productivity-comparison"]
    kinds = dict(_query(parquet, "SELECT reference_area_kind, count(DISTINCT reference_area_code) FROM {t} GROUP BY 1"))
    assert kinds["member"] == 38
    assert kinds["aggregate"] == 3
    screened = {row[0] for row in _query(parquet, "SELECT DISTINCT reference_area_code FROM {t} WHERE labour_input_is_plausible = false")}
    assert screened <= {"NZL", "PER"}
    assert _query(
        parquet,
        "SELECT count(*) FROM {t} WHERE labour_input_is_plausible = false AND gdp_per_hour_ppp_current_usd IS NOT NULL",
    ) == [(0,)]
    # France's hours-based ratios cover every year its published totals do.
    assert _query(
        parquet,
        """SELECT count(*) FROM {t} WHERE reference_area_code = 'FRA'
           AND hours_worked_mn IS NOT NULL AND employment_thousands IS NOT NULL AND hours_per_worker IS NULL""",
    ) == [(0,)]


def test_departements_are_keyed_by_insee_code_and_indexed_to_france(built) -> None:
    _manifest, parquet = built["french-departement-gdp"]
    departements, corsica, first = _query(
        parquet,
        """SELECT count(DISTINCT departement_code),
                  count(DISTINCT departement_code) FILTER (WHERE departement_code IN ('2A', '2B')),
                  min(year(period))
           FROM {t}""",
    )[0]
    declared = (ROOT / "datasets/french-departement-gdp/dbt/seeds/nuts3_departements.csv").read_text(encoding="utf-8").strip().splitlines()[1:]
    assert (departements, corsica, first) == (len(declared), 2, _first_year("french-departement-gdp"))
    assert _query(
        parquet,
        "SELECT count(*) FROM {t} WHERE gdp_per_inhabitant_eur IS NULL AND NOT (departement_code = '976' AND year(period) < 2014)",
    ) == [(0,)]


def test_an_invalid_snapshot_retains_the_published_pair(tmp_path: Path) -> None:
    declaration = discover_datasets()["french-national-accounts-annual"]
    target = tmp_path / "publish/french-national-accounts-annual"
    shutil.copytree(ROOT / "publish/public/data/french-national-accounts-annual", target)
    before = (target / "dataset.parquet").read_bytes()
    archive = tmp_path / "archive"
    shutil.copytree(ARCHIVE / "insee-annual-national-accounts", archive / "insee-annual-national-accounts")
    for parquet in (archive / "insee-annual-national-accounts").glob("*/raw.parquet"):
        parquet.write_text("version https://git-lfs.github.com/spec/v1\n", encoding="utf-8")
    with pytest.raises(DatasetError):
        build_dataset(declaration, archive_root=archive, build_root=tmp_path / "bad-build", publish_root=target)
    assert (target / "dataset.parquet").read_bytes() == before
