"""Copy beside source tests and replace the example identity with the new source."""

from pathlib import Path
from pulse.sources import acquire_from_adapter, discover_sources


def test_example_source_is_offline_and_faithful(monkeypatch, tmp_path: Path) -> None:
    declaration = discover_sources()["example-public-source"]
    fixture = declaration.path.parent / "fixture.json"
    monkeypatch.setattr("socket.create_connection", lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("network")))
    acquired = acquire_from_adapter(declaration, fixture=fixture, live=False)
    assert acquired.source_urls == [declaration.configuration["url"]]
    assert acquired.rows or acquired.original_bytes
