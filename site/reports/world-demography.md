---
title: World demography
---

```js
import { renderWorldDemographyReport } from "./world-demography/report.js";
const scenario = new URLSearchParams(location.search).get("scenario");
display(renderWorldDemographyReport({scenario}));
```
