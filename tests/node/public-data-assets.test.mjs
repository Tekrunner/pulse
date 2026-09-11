import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyCatalogedParquet, scanArtifactSafety, verifyArtifactInventory, writeArtifactInventory } from "../../scripts/public-data-assets.mjs";

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
const inventory = await writeArtifactInventory(output);
assert.equal((await verifyArtifactInventory(output)).artifactSha256, inventory.artifactSha256);
const replayA = join(root, "replay-a");
const replayB = join(root, "replay-b");
await mkdir(replayA);
await mkdir(replayB);
await writeFile(join(replayA, "a.txt"), "alpha");
await writeFile(join(replayA, "z.txt"), "omega");
await writeFile(join(replayB, "z.txt"), "omega");
await writeFile(join(replayB, "a.txt"), "alpha");
assert.equal(
  (await writeArtifactInventory(replayA)).artifactSha256,
  (await writeArtifactInventory(replayB)).artifactSha256,
  "artifact inventory must be independent of filesystem creation order",
);
await writeFile(join(output, "unexpected.txt"), "drift");
await assert.rejects(() => verifyArtifactInventory(output), /disagree/);

for (const [name, relative, content, expected, limit] of [
  ["private", "private/data.txt", "not public", /private path/, undefined],
  ["secret", "config.txt", 'api_key = "do-not-publish"', /credential-shaped/, undefined],
  ["remote", "app.js", 'fetch("https://example.test/data")', /remote browser execution/, undefined],
  ["source-map", "app.js.map", "{}", /source map/, undefined],
  ["oversized", "large.bin", "1234", /exceeds/, 4],
]) {
  const unsafe = join(root, `unsafe-${name}`);
  const target = join(unsafe, ...relative.split("/"));
  await mkdir(target.slice(0, target.lastIndexOf("/")), { recursive: true });
  await writeFile(target, content);
  await assert.rejects(() => scanArtifactSafety(unsafe, limit ? { maxBytes: limit } : {}), expected);
}
console.log("Public data asset packaging passed: every cataloged public Parquet asset is copied.");
