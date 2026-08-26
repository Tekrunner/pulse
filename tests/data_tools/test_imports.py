"""Offline smoke checks for the locked Python data-tool tuple."""

from __future__ import annotations

import importlib

import pytest


@pytest.mark.parametrize("module", ("dlt", "dbt", "dbt.adapters.duckdb", "duckdb"))
def test_data_tool_imports(module: str) -> None:
    assert importlib.import_module(module) is not None
