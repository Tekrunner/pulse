---
title: French consumer prices
---

```js
import { renderFrenchConsumerPricesReport } from "./french-consumer-prices/report.js";
const scenario = new URLSearchParams(location.search).get("scenario");
display(renderFrenchConsumerPricesReport({scenario}));
```
