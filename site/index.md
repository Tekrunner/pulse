---
title: Pulse
---

```js
import { renderHome } from "./data/home.js";
display(renderHome({ scenario: new URLSearchParams(location.search).get("scenario") }));
```
