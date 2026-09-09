- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-select-acquire-and-archive-the-first-insee-dataset.md`
  summary: Provision the container's missing Playwright browser shared libraries so the repository-wide browser suite can run.
  evidence: `npm run verify` reaches browser tests but Chromium cannot load `libnspr4.so` and Firefox cannot load `libasound.so.2`; Story 1.3 does not modify the browser pilot.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-see-pipeline-health-and-data-freshness.md`
  summary: Decide how Windows contributors get `PLAYWRIGHT_BROWSERS_PATH` set, since Playwright Firefox cannot launch from the default `%LOCALAPPDATA%\ms-playwright` store.
  evidence: Firefox failed every launch with `spawn UNKNOWN` (a side-by-side `mozglue` activation failure) from the default store, and launches normally from `C:\pw`; the exact reason the default location fails is not established. The suite passes both engines only when the variable is set by hand, so a fresh Windows checkout hits the same wall.
