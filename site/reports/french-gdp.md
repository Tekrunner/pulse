---
title: French GDP
---

```js
import { renderFrenchGdpReport } from "./french-gdp/report.js";
const scenario = new URLSearchParams(location.search).get("scenario");
display(renderFrenchGdpReport({scenario}));
```
