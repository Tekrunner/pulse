---
title: French macroeconomic pilot
---

```js
import { renderReport } from "./report.js";
const report = document.createElement("main");
report.className = "pilot-report";
report.append(renderReport({scenario: new URLSearchParams(location.search).get("scenario")}));
display(report);
```
