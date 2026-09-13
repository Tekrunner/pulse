#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export function verifyNumericBoundary(evidence) {
  assert.equal(evidence?.schema_version, "1.0.0", "unsupported numeric evidence schema");
  assert.ok(
    typeof evidence.dataset_revision === "string" &&
      evidence.dataset_revision.length > 0 &&
      !evidence.dataset_revision.includes("__"),
    "dataset_revision must pin real data",
  );
  assert.ok(Array.isArray(evidence.conversion_paths) && evidence.conversion_paths.length > 0,
    "declare every conversion path");
  assert.ok(Array.isArray(evidence.cases) && evidence.cases.length > 0, "numeric cases are required");

  const paths = new Set(evidence.conversion_paths);
  assert.equal(paths.size, evidence.conversion_paths.length, "conversion paths must be distinct");
  for (const path of paths) {
    assert.ok(typeof path === "string" && path.length > 0 && !path.includes("__"),
      "conversion paths must be concrete");
    assert.ok(evidence.cases.some((item) => item.path === path), `conversion path '${path}' has no pinned case`);
  }

  const concerns = new Set();
  for (const item of evidence.cases) {
    assert.ok(paths.has(item.path), `case '${item.id}' names an undeclared conversion path`);
    assert.ok(Array.isArray(item.concerns) && item.concerns.length > 0,
      `case '${item.id}' must name its numeric concern`);
    item.concerns.forEach((concern) => concerns.add(concern));
    assert.deepEqual(item.query, item.expected_query, `case '${item.id}' browser-query value differs`);
    assert.equal(item.displayed, item.expected_display, `case '${item.id}' displayed value differs`);
    if (item.stored === null) {
      assert.equal(item.expected_query, null, `case '${item.id}' loses stored null`);
    } else {
      assert.equal(Number(item.stored), item.expected_query, `case '${item.id}' changes stored decimal value`);
    }
  }

  for (const concern of ["decimal-scale", "negative", "null", "precision"])
    assert.ok(concerns.has(concern), `numeric evidence does not cover ${concern}`);

  return { paths: paths.size, cases: evidence.cases.length };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const path = process.argv[2];
  if (!path) throw new Error("usage: numeric-boundary-harness.mjs <numeric-evidence.json>");
  const result = verifyNumericBoundary(JSON.parse(await readFile(path, "utf8")));
  console.log(`Numeric boundary verified: ${result.cases} cases across ${result.paths} paths.`);
}
