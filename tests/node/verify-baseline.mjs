import { createRequire } from "node:module";
import { findForbiddenDependency } from "./dependency-policy.mjs";

const require = createRequire(import.meta.url);
if (!process.versions.node.startsWith("24.")) {
  throw new Error(`Pulse requires Node 24; found ${process.version}.`);
}
if (process.env.npm_execpath && !process.env.npm_config_user_agent?.includes("npm/11.")) {
  throw new Error(`Pulse requires npm 11 when invoked through npm; found ${process.env.npm_config_user_agent}.`);
}
const packageJson = require("../../package.json");
const declared = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
  ...packageJson.optionalDependencies,
};

const forbiddenDependency = findForbiddenDependency(declared);
if (forbiddenDependency) {
  throw new Error(`Pulse must not adopt a chart library: found ${forbiddenDependency[0]} (${forbiddenDependency[1]})`);
}

// Framework intentionally exposes a CLI rather than a package-root module.
// Import its build module directly so this remains an actual module-load check.
await import("@observablehq/framework/dist/build.js");
await import("@duckdb/duckdb-wasm");

console.log("Node baseline passed: Observable Framework and DuckDB-WASM import; no chart library declared.");
