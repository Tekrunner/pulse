---
title: Unemployment in France
---

```js
import { renderFrenchUnemploymentReport } from "./french-unemployment/report.js";
const scenario = new URLSearchParams(location.search).get("scenario");
display(renderFrenchUnemploymentReport({scenario}));
```
