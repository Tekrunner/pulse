- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-select-acquire-and-archive-the-first-insee-dataset.md`
  summary: Provision the container's missing Playwright browser shared libraries so the repository-wide browser suite can run.
  evidence: `npm run verify` reaches browser tests but Chromium cannot load `libnspr4.so` and Firefox cannot load `libasound.so.2`; Story 1.3 does not modify the browser pilot.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-see-pipeline-health-and-data-freshness.md`
  summary: Unblock the Playwright Firefox engine on Windows so browser verification covers both engines rather than Chromium alone.
  evidence: All 41 Firefox tests fail at `browserType.launch: spawn UNKNOWN`, and `firefox.exe` returns `Permission denied` when executed directly, so the machine blocks the binary; Chromium passes 41/41. Story 1.7 does not own the browser toolchain.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-see-pipeline-health-and-data-freshness.md`
  summary: Bring the Python test suite back under the 600s per-stage timeout that `pulse verify` enforces, or raise the cap deliberately.
  evidence: `pytest` takes 1518s, so `_python_smoke` times out at `SUBPROCESS_TIMEOUT_SECONDS = 600`. Six tests in `tests/sources/test_insee_cpi.py` account for ~1,400s, each via `_archive()` and `dlt`; that path is untouched by Story 1.7, whose own slowest test is 7.6s.
