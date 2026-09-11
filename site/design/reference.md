---
title: Design foundation reference
---

# Design foundation reference

This is a developer-facing conformance reference, not a public report page and
not a prescribed visual design. It is intentionally absent from report
navigation. Use it when authoring or reviewing a visual to confirm the neutral
baseline: an indicator, provenance, keyboard interaction, visible focus, and
an accessible data equivalent. Automated conformance checks exercise the same
template's loading, empty, warning, and error states.

```js
import { FIXTURE_ROWS } from "../workflows/add-visual/template/fixture.js";
import { renderVisualTemplate } from "../workflows/add-visual/template/visual.js";
display(renderVisualTemplate({
  rows: FIXTURE_ROWS,
  display: { title: "Reference indicator", description: "Synthetic interactive renderer reference" },
  provenance: { label: "Synthetic fixture", updatedAt: "2026-09-11" },
}));
```

This executable reference renders the canonical source-neutral template with its
declared synthetic fixture, display input, and provenance. It is conformance
evidence, not a chart or report exemplar.
