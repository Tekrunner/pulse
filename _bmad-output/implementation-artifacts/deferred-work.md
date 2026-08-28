- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-select-acquire-and-archive-the-first-insee-dataset.md`
  summary: Provision the container's missing Playwright browser shared libraries so the repository-wide browser suite can run.
  evidence: `npm run verify` reaches browser tests but Chromium cannot load `libnspr4.so` and Firefox cannot load `libasound.so.2`; Story 1.3 does not modify the browser pilot.
