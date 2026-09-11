import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { seedObservableNpmVersionIndex, stagePublicSiteSources } from "../../scripts/public-site-sources.mjs";

const root = await mkdtemp(join(tmpdir(), "pulse-public-sources-"));
const site = join(root, "site");
const output = join(root, "output");

async function write(relative, content) {
  const path = join(site, relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

await write("index.md", 'import { home } from "./data/home.js";\n');
await write("reports/index.md", "# Reports\n");
await write("style.css", "body { color: white; }\n");
await write("data/home.js", "export const home = true;\n");
await write("reports/public.md", 'import { report } from "./public/report.js";\n');
await write("reports/public/report.js", 'import { shared } from "../../visuals/shared.js"; export const report = shared;\n');
await write("visuals/shared.js", "export const shared = 'PUBLIC_MODULE';\n");
await write("reports/private.md", 'import "./private/sentinel.js"; PRIVATE_ROUTE_SENTINEL\n');
await write("reports/private/sentinel.js", "export const sentinel = 'PRIVATE_MODULE_SENTINEL';\n");

const copied = await stagePublicSiteSources({
  siteRoot: site,
  outputRoot: output,
  reportCatalog: {
    reports: {
      public: { route: "reports/public", resolvedVisibility: "public" },
    },
  },
});

assert(copied.includes("reports/public.md"));
assert(copied.includes("reports/public/report.js"));
assert(copied.includes("visuals/shared.js"));
await assert.rejects(() => stat(join(output, "reports/private.md")), /ENOENT/);
await assert.rejects(() => stat(join(output, "reports/private/sentinel.js")), /ENOENT/);

async function allText(directory) {
  let text = "";
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    text += entry.isDirectory() ? await allText(path) : await readFile(path, "utf8");
  }
  return text;
}
assert.doesNotMatch(await allText(output), /PRIVATE_(?:ROUTE|MODULE)_SENTINEL/);
await seedObservableNpmVersionIndex(output);
assert((await stat(join(output, ".observablehq/cache/_npm/react-dom@19.2.8"))).isDirectory());
console.log("Public source staging excludes undeclared and private report routes and modules.");
