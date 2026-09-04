import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyCatalogedParquet } from "../../scripts/public-data-assets.mjs";

const root = await mkdtemp(join(tmpdir(), "pulse-public-assets-"));
const catalogPath = join(root, "browser-data.json");
const publishDataRoot = join(root, "publish-data");
const output = join(root, "output");
const datasets = [
  ["insee-cpi-monthly", "datasets/insee-cpi-monthly/dataset.parquet", "cpi"],
  ["other-quarterly", "datasets/other-quarterly/dataset.parquet", "other"],
];
for (const [, parquet, contents] of datasets) {
  const source = join(publishDataRoot, ...parquet.split("/").slice(1));
  await mkdir(source.slice(0, source.lastIndexOf("/")), { recursive: true });
  await writeFile(source, contents);
}
await writeFile(catalogPath, JSON.stringify({ datasets: Object.fromEntries(datasets.map(([id, parquet]) => [id, { visibility: "public", parquet }])) }));
await copyCatalogedParquet({ catalogPath, publishDataRoot, dataOutput: output });
for (const [, parquet, contents] of datasets) {
  assert.equal(await readFile(join(output, ...parquet.split("/")), "utf8"), contents);
}
console.log("Public data asset packaging passed: every cataloged public Parquet asset is copied.");
