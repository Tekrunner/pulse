---
title: Pulse
---

# Pulse

The portable report experience pilot.

```js
import { renderHome } from "./data/home.js";
display(renderHome({ scenario: new URLSearchParams(location.search).get("scenario") }));
```

This static shell uses same-origin, manifest-relative data and purpose-built DOM/SVG visuals.
