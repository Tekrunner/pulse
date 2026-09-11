---
title: Design foundation reference
---

```js
import { FIXTURE_ROWS } from "../workflows/add-visual/template/fixture.js";
import { renderVisualTemplate } from "../workflows/add-visual/template/visual.js";
import "../workflows/add-visual/template/styles.css";

display(renderVisualTemplate({
  rows: FIXTURE_ROWS,
  display: { title: "Reference indicator", description: "Synthetic interactive renderer reference" },
  provenance: { label: "Synthetic fixture", updatedAt: "2026-09-11" },
}));
```

This executable reference renders the canonical source-neutral template with its
declared synthetic fixture, display input, and provenance. It is conformance
evidence, not a chart or report exemplar.
