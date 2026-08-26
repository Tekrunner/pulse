import assert from "node:assert/strict";

import { findForbiddenDependency } from "./dependency-policy.mjs";

assert.equal(findForbiddenDependency({ "@duckdb/duckdb-wasm": "1.31.0" }), undefined);
assert.deepEqual(findForbiddenDependency({ charting: "npm:chart.js@4.4.0" }), ["charting", "npm:chart.js@4.4.0"]);
assert.deepEqual(findForbiddenDependency({ "@nivo/line": "0.88.0" }), ["@nivo/line", "0.88.0"]);
assert.deepEqual(findForbiddenDependency({ viewer: "npm:@antv/g2@5.0.0" }), ["viewer", "npm:@antv/g2@5.0.0"]);
assert.deepEqual(findForbiddenDependency({ "d3-array": "3.2.4" }), ["d3-array", "3.2.4"]);
assert.deepEqual(findForbiddenDependency({ "@observablehq/plot": "0.6.17" }), ["@observablehq/plot", "0.6.17"]);
assert.deepEqual(findForbiddenDependency({ uplot: "1.6.32" }), ["uplot", "1.6.32"]);
