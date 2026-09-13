import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { seedObservableNpmVersionIndex, stagePublicSiteSources } from "../../scripts/public-site-sources.mjs";

const root = await mkdtemp(join(tmpdir(), "pulse-public-sources-"));
const site = join(root, "site");
const output = join(root, "stage/output");
const repository = resolve(import.meta.dirname, "../..");

async function write(relative, content) {
  const path = join(site, relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

await write("index.md", 'import { home } from "./data/home.js";\n');
await write("reports/index.md", "# Reports\n");
await write("style.css", "body { color: white; }\n");
await write("design/tokens.css", ":root { --color-text: white; }\n");
await write("design/visual-language.md", "# Guidance\n");
await write("design/reference.md", "# Reference\n");
await write("data/home.js", "export const home = true;\n");
await write("reports/public.md", 'import { report } from "./public/report.js";\n');
await write("reports/public/report.js", 'import { shared } from "../../visuals/shared.js"; export const report = shared;\n');
await write("reports/public/annotations.json", '{"annotations":["PUBLIC_ANNOTATION_SENTINEL"]}\n');
await write("visuals/shared.js", "export const shared = 'PUBLIC_MODULE';\n");
await write("reports/private.md", 'import "./private/sentinel.js"; PRIVATE_ROUTE_SENTINEL\n');
await write("reports/private/sentinel.js", "export const sentinel = 'PRIVATE_MODULE_SENTINEL';\n");
await write("reports/private/annotations.json", '{"annotations":["PRIVATE_ANNOTATION_SENTINEL"]}\n');
await write("workflows/add-visual/template/fixture.js", "export const fixture = true;\n");
await write("workflows/add-visual/template/styles.css", ".template {}\n");
await write("workflows/add-visual/template/visual.js", "export const visual = true;\n");
await write("workflows/add-report/template/report.yml", "id: synthetic-report\n");
await write("workflows/add-report/template/report.js", 'import "../../../data/report-runtime.js";\n');
await write("workflows/add-report/template/annotations.json", '{"schemaVersion":"1.0.0","annotations":[]}\n');
await write("workflows/add-report/template/state.js", 'import "../../../data/report-runtime.js";\n');
await write("workflows/add-report/template/test.js", 'import "../../../data/report-runtime.js";\n');
await write("data/report-runtime.js", "export const runtime = true;\n");
await cp(
  resolve(repository, "site/workflows/add-report/template"),
  join(site, "reports/synthetic-report"),
  { recursive: true },
);
for (const module of ["report.js", "state.js", "test.js"]) {
  const path = join(site, "reports/synthetic-report", module);
  await writeFile(path, (await readFile(path, "utf8")).replaceAll("../../../data/", "../../data/"));
}
const syntheticAnnotations = join(site, "reports/synthetic-report/annotations.json");
await writeFile(
  syntheticAnnotations,
  (await readFile(syntheticAnnotations, "utf8")).replace('"visibility": "private"', '"visibility": "public"'),
);
await write(
  "reports/synthetic-report.md",
  '```js\nimport { REPORT_ID } from "./synthetic-report/report.js";\ndisplay(REPORT_ID);\n```\n',
);

const copied = await stagePublicSiteSources({
  siteRoot: site,
  outputRoot: output,
  reportCatalog: {
    reports: {
      public: {
        route: "reports/public", resolvedVisibility: "public",
        annotations: { path: "annotations.json" },
      },
      "synthetic-report": {
        route: "reports/synthetic-report", resolvedVisibility: "public",
        annotations: { path: "annotations.json" },
      },
    },
  },
});

assert(copied.includes("reports/public.md"));
assert(copied.includes("reports/public/report.js"));
assert(copied.includes("reports/public/annotations.json"));
assert(copied.includes("reports/synthetic-report.md"));
assert(copied.includes("reports/synthetic-report/report.js"));
assert(copied.includes("reports/synthetic-report/annotations.json"));
assert(copied.includes("visuals/shared.js"));
assert(copied.includes("design/tokens.css"));
assert(copied.includes("workflows/add-visual/template/visual.js"));
assert(copied.includes("workflows/add-report/template/report.yml"));
assert(copied.includes("data/report-runtime.js"));
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
assert.match(await allText(output), /PUBLIC_ANNOTATION_SENTINEL/);
assert.doesNotMatch(await allText(output), /PRIVATE_ANNOTATION_SENTINEL/);
await seedObservableNpmVersionIndex(output);
assert((await stat(join(output, ".observablehq/cache/_npm/react-dom@19.2.8"))).isDirectory());
console.log("Public source staging excludes undeclared and private report routes and modules.");
