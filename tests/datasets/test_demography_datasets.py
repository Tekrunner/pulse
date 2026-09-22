"""Offline coverage for the six demography datasets.

They share a subject and a grain vocabulary but not a provider: three read the
United Nations projection files, two read Eurostat migration flows and one reads
a World Health Organization indicator. The invariants every published table owes
a consumer run over all six; the semantics each one owns are tested separately.
"""

from __future__ import annotations

import json
from pathlib import Path
import shutil

import duckdb
import pytest

from pulse.datasets import (
    DatasetError,
    build_dataset,
    discover_datasets,
)


ROOT = Path(__file__).resolve().parents[2]
PUBLISH = ROOT / "publish/public/data"

INDICATORS = "world-demography-indicators"
SCENARIOS = "world-demography-scenarios"
AGE_STRUCTURE = "world-demography-age-structure"
IMMIGRATION = "european-immigration-flows"
EMIGRATION = "european-emigration-flows"
HALE = "healthy-life-expectancy"
ALL = (INDICATORS, SCENARIOS, AGE_STRUCTURE, IMMIGRATION, EMIGRATION, HALE)
FROM_FILES = (INDICATORS, SCENARIOS, AGE_STRUCTURE)
FROM_API = (IMMIGRATION, EMIGRATION, HALE)


@pytest.fixture(name="offline")
def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "socket.create_connection",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("network")),
    )


def _declaration(dataset_id: str):
    return discover_datasets()[dataset_id]


def _manifest(dataset_id: str) -> dict:
    return json.loads((PUBLISH / dataset_id / "dataset.json").read_text(encoding="utf-8"))


def _query(dataset_id: str, sql: str, parameters: list | None = None):
    connection = duckdb.connect()
    try:
        return connection.execute(
            sql.replace("{table}", f"read_parquet('{(PUBLISH / dataset_id / 'dataset.parquet').as_posix()}')"),
            parameters or [],
        ).fetchall()
    finally:
        connection.close()


@pytest.mark.parametrize("dataset_id", ALL)
def test_package_is_discovered_without_a_registry(dataset_id: str) -> None:
    declaration = _declaration(dataset_id)

    assert declaration.path.parent.name == dataset_id
    assert declaration.visibility == "public"
    assert declaration.logical_table == declaration.contract.model["name"]


@pytest.mark.parametrize("dataset_id", ALL)
def test_published_schema_is_exactly_the_committed_contract(dataset_id: str) -> None:
    declaration = _declaration(dataset_id)
    described = _query(dataset_id, "DESCRIBE SELECT * FROM {table}")

    assert {name: kind for name, kind, *_ in described} == {
        column["name"]: column["type"] for column in declaration.contract.columns
    }
    assert [name for name, *_ in described] == [
        column["name"] for column in declaration.contract.columns
    ]


@pytest.mark.parametrize("dataset_id", ALL)
def test_manifest_agrees_with_the_published_parquet(dataset_id: str) -> None:
    manifest = _manifest(dataset_id)
    declaration = _declaration(dataset_id)
    rows = _query(dataset_id, "SELECT count(*) FROM {table}")[0][0]

    assert manifest["dataset_id"] == dataset_id
    assert manifest["source_id"] == declaration.source_id
    assert manifest["logical_table"] == declaration.logical_table
    assert manifest["columns"] == declaration.contract.columns
    assert manifest["questions"] == declaration.contract.questions
    assert manifest["temporal"] == declaration.contract.temporal
    assert manifest["validations"] == declaration.contract.validations
    assert rows > 0


@pytest.mark.parametrize("dataset_id", ALL)
def test_represented_period_ends_on_the_last_day_of_its_latest_year(dataset_id: str) -> None:
    """A period column holding the first day of a year would otherwise report a
    table as a year older than it is, and have it called late a year early."""
    manifest = _manifest(dataset_id)
    first, last = _query(
        dataset_id, "SELECT min(period)::VARCHAR, max(period)::VARCHAR FROM {table}"
    )[0]

    assert manifest["represented_period"]["start"] == first
    assert manifest["represented_period"]["end"] == f"{last[:4]}-12-31"


@pytest.mark.parametrize("dataset_id", ALL)
def test_lineage_names_the_snapshot_it_was_built_from(dataset_id: str) -> None:
    manifest = _manifest(dataset_id)
    snapshot = json.loads(
        next(
            (ROOT / "snapshots/public" / manifest["source_id"]).glob("*/snapshot.json")
        ).read_text(encoding="utf-8")
    )

    assert manifest["lineage"]["snapshot_id"] == snapshot["snapshot_id"]
    assert manifest["lineage"]["snapshot_sha256"] == snapshot["artifacts"][0]["sha256"]


@pytest.mark.parametrize("dataset_id", FROM_FILES)
def test_a_file_backed_package_declares_the_original_file_format(dataset_id: str) -> None:
    assert _manifest(dataset_id)["lineage"]["input_format"] == "original-file"


@pytest.mark.parametrize("dataset_id", FROM_API)
def test_an_api_backed_package_declares_the_parquet_format(dataset_id: str) -> None:
    assert _manifest(dataset_id)["lineage"]["input_format"] == "parquet"


@pytest.mark.parametrize("dataset_id", ALL)
def test_rebuilding_the_same_snapshot_produces_the_same_bytes(
    dataset_id: str, offline, tmp_path: Path
) -> None:
    """A build that is not deterministic cannot be reasoned about: two runs of
    the same snapshot would publish two different hashes and a consumer could
    not tell a provider revision from a rebuild."""
    published = _manifest(dataset_id)["content_sha256"]

    rebuilt = build_dataset(
        _declaration(dataset_id),
        build_root=tmp_path / "build",
        publish_root=tmp_path / "publish" / dataset_id,
    )

    assert rebuilt.content_sha256 == published


@pytest.mark.parametrize("dataset_id", ALL)
def test_an_unreadable_snapshot_leaves_the_last_usable_pair_in_place(
    dataset_id: str, offline, tmp_path: Path
) -> None:
    """A failed build must never publish half a table: the previously published
    manifest and Parquet stay exactly as they were."""
    target = tmp_path / "publish" / dataset_id
    # The preceding parametrized test already proves a successful rebuild for
    # every package. Copy its committed usable pair here so this contract pays
    # only for the failing transition it is meant to exercise.
    shutil.copytree(PUBLISH / dataset_id, target)
    before = (
        (target / "dataset.parquet").read_bytes(),
        (target / "dataset.json").read_text(encoding="utf-8"),
    )
    empty_archive = tmp_path / "empty-snapshots"
    empty_archive.mkdir()

    with pytest.raises(DatasetError):
        build_dataset(
            _declaration(dataset_id),
            archive_root=empty_archive,
            build_root=tmp_path / "build",
            publish_root=target,
        )

    assert (
        (target / "dataset.parquet").read_bytes(),
        (target / "dataset.json").read_text(encoding="utf-8"),
    ) == before


# --- world-demography-indicators -------------------------------------------


def test_indicators_hold_one_row_per_location_and_year() -> None:
    duplicates, locations, years = _query(
        INDICATORS,
        """
        SELECT
          (SELECT count(*) FROM (SELECT period, location_id FROM {table}
                                 GROUP BY 1, 2 HAVING count(*) > 1)),
          count(DISTINCT location_id),
          count(DISTINCT period)
        FROM {table}
        """,
    )[0]

    assert duplicates == 0
    assert locations > 200
    assert years == 151


def test_indicators_carry_the_world_and_split_estimate_from_projection() -> None:
    worlds, estimate_end, projection_start = _query(
        INDICATORS,
        """
        SELECT
          count(DISTINCT location_id) FILTER (WHERE location_kind = 'world'),
          max(period) FILTER (WHERE series_kind = 'estimate')::VARCHAR,
          min(period) FILTER (WHERE series_kind = 'projection')::VARCHAR
        FROM {table}
        """,
    )[0]

    assert worlds == 1
    assert estimate_end < projection_start


def test_indicators_reproduce_the_providers_own_natural_change() -> None:
    """Births minus deaths is the provider's own accounting and holds exactly at
    the precision it publishes, so a tolerance here is half of the last digit."""
    breaches = _query(
        INDICATORS,
        """
        SELECT count(*) FROM {table}
        WHERE abs(natural_change_thousands - (births_thousands - deaths_thousands)) > 0.0005
        """,
    )[0][0]

    assert breaches == 0


def test_indicators_do_not_claim_change_decomposes_exactly() -> None:
    """The provider's population change is accounted for by natural change and
    net migration but is not their sum. This test pins the discrepancy so that
    nobody later writes a contract clause claiming it closes."""
    largest = _query(
        INDICATORS,
        """
        SELECT max(abs(population_change_thousands
                       - natural_change_thousands - net_migration_thousands))
        FROM {table}
        """,
    )[0][0]

    assert largest > 1


# --- world-demography-scenarios --------------------------------------------


def test_scenarios_cover_every_published_variant_over_one_projection_period() -> None:
    scenarios, kinds, first, last = _query(
        SCENARIOS,
        """
        SELECT
          count(DISTINCT scenario),
          count(DISTINCT scenario_kind),
          min(period)::VARCHAR,
          max(period)::VARCHAR
        FROM {table}
        """,
    )[0]

    assert scenarios == 18
    assert kinds == 2
    assert first == "2024-01-01"
    assert last == "2100-01-01"


def test_scenarios_that_publish_no_population_are_carried_as_null() -> None:
    """The probabilistic mean is published as a fertility summary alone.
    Dropping it would hide a scenario; writing zero would invent a population."""
    rows, populations = _query(
        SCENARIOS,
        """
        SELECT count(*), count(population_thousands)
        FROM {table} WHERE scenario = 'Mean'
        """,
    )[0]

    assert rows > 0
    assert populations == 0


def test_probabilistic_bounds_are_carried_as_the_provider_publishes_them() -> None:
    """The lower bounds round a small population to zero and report a median age
    no population could have. That is the tail of a distribution, not a defect,
    and it must survive into the table so a consumer can see it."""
    degenerate = _query(
        SCENARIOS,
        """
        SELECT count(*) FROM {table}
        WHERE scenario_kind = 'probabilistic'
          AND (population_thousands = 0 OR median_age_years > 100 OR median_age_years = 0)
        """,
    )[0][0]
    deterministic_degenerate = _query(
        SCENARIOS,
        """
        SELECT count(*) FROM {table}
        WHERE scenario_kind = 'deterministic'
          AND (population_thousands <= 0 OR median_age_years > 100 OR median_age_years <= 0)
        """,
    )[0][0]

    assert degenerate > 0
    assert deterministic_degenerate == 0


# --- world-demography-age-structure ----------------------------------------


def test_age_structure_carries_both_groupings_of_the_same_population() -> None:
    five_year, broad, disagreements = _query(
        AGE_STRUCTURE,
        """
        WITH totals AS (
          SELECT period, location_id, age_grouping, sum(population_total_thousands) AS people
          FROM {table} GROUP BY 1, 2, 3
        )
        SELECT
          (SELECT count(DISTINCT age_group) FROM {table} WHERE age_grouping = 'five-year'),
          (SELECT count(DISTINCT age_group) FROM {table} WHERE age_grouping = 'broad'),
          count(*)
        FROM totals AS a
        JOIN totals AS b USING (period, location_id)
        WHERE a.age_grouping = 'five-year' AND b.age_grouping = 'broad' AND a.people <> b.people
        """,
    )[0]

    assert (five_year, broad) == (21, 3)
    assert disagreements == 0


def test_age_structure_bands_are_exhaustive_within_a_grouping() -> None:
    off_by = _query(
        AGE_STRUCTURE,
        """
        SELECT count(*) FROM (
          SELECT period, location_id, age_grouping, sum(share_of_population_pct) AS total
          FROM {table} GROUP BY 1, 2, 3
        ) WHERE abs(total - 100) > 0.00105
        """,
    )[0][0]

    assert off_by == 0


def test_age_structure_marks_its_open_ended_band() -> None:
    open_ended = _query(
        AGE_STRUCTURE,
        """
        SELECT DISTINCT age_grouping, age_group FROM {table}
        WHERE age_end IS NULL ORDER BY age_grouping, age_group
        """,
    )

    assert open_ended == [("broad", "65+"), ("five-year", "100+")]


# --- european migration flows ----------------------------------------------


@pytest.mark.parametrize("dataset_id", (IMMIGRATION, EMIGRATION))
def test_migration_flows_map_every_reporting_country_to_an_alpha3_code(
    dataset_id: str,
) -> None:
    unmapped, aggregates = _query(
        dataset_id,
        """
        SELECT
          count(DISTINCT geo_code) FILTER (WHERE geo_kind = 'country' AND iso3_code IS NULL),
          count(DISTINCT geo_code) FILTER (WHERE geo_kind = 'aggregate')
        FROM {table}
        """,
    )[0]

    assert unmapped == 0
    assert aggregates >= 1


@pytest.mark.parametrize("dataset_id", (IMMIGRATION, EMIGRATION))
def test_migration_flows_keep_a_partial_panel_partial(dataset_id: str) -> None:
    """Reporting starts in different years and the United Kingdom's ends with
    its withdrawal from the Union. A rectangular panel here would mean someone
    had filled those years in."""
    first_years, british_last = _query(
        dataset_id,
        """
        SELECT
          count(DISTINCT first_year),
          max(period) FILTER (WHERE geo_code = 'UK')::VARCHAR
        FROM (
          SELECT geo_code, min(period) AS first_year, period FROM {table} GROUP BY geo_code, period
        )
        """,
    )[0]

    assert first_years > 1
    assert british_last is not None and british_last < "2021-01-01"


def test_the_two_flows_are_published_on_the_same_basis() -> None:
    """Both count every mover regardless of citizenship, which is what lets one
    be differenced against the other. Two different citizenship scopes would
    have made the difference meaningless."""
    arrivals = _manifest(IMMIGRATION)["indicators"][0]
    departures = _manifest(EMIGRATION)["indicators"][0]

    # Same series key on both sides: annual, total over citizenship, total over
    # age, in persons, both sexes. Only the dataflow differs.
    assert "A.TOTAL.COMPLET.TOTAL.NR.T" in arrivals["source"]
    assert "A.TOTAL.COMPLET.TOTAL.NR.T" in departures["source"]
    assert "migr_imm1ctz" in arrivals["source"] and "migr_emi1ctz" in departures["source"]
    assert arrivals["unit"] == departures["unit"] == "People per year"
    assert arrivals["licence"] == departures["licence"]


# --- healthy life expectancy -----------------------------------------------


def test_healthy_life_expectancy_keeps_every_location_the_provider_publishes() -> None:
    """The provider's licence permits alteration only with prior written
    authorization, so this table selects no subset of its rows."""
    kinds = _query(
        HALE,
        "SELECT DISTINCT location_kind FROM {table} ORDER BY 1",
    )

    assert [kind for kind, in kinds] == ["country", "global", "income-group", "region"]


def test_healthy_life_expectancy_publishes_all_three_sexes_everywhere() -> None:
    incomplete = _query(
        HALE,
        """
        SELECT count(*) FROM (
          SELECT period, location_code FROM {table}
          GROUP BY 1, 2 HAVING count(DISTINCT sex) <> 3
        )
        """,
    )[0][0]

    assert incomplete == 0


def test_healthy_life_expectancy_stops_well_short_of_the_life_expectancy_series() -> None:
    """A consumer placing the two on one axis has to expect the shorter one to
    stop, so the gap is pinned here rather than left to be discovered."""
    healthy_end = _manifest(HALE)["represented_period"]["end"]
    indicators_end = _manifest(INDICATORS)["represented_period"]["end"]

    assert healthy_end < "2025-01-01" < indicators_end
