/** Materialize only the source graph reachable from positively public routes. */
import { cp, mkdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";

// Framework's client contains lazy imports for its recommended libraries. The
// public site does not ship those optional modules, but Framework still needs
// stable versions while bundling the client. Pinning the resolution index here
// keeps a clean public build offline and independent of an ignored local cache.
const observableNpmVersions = {
  "@observablehq/plot": "0.6.17",
  "@observablehq/sample-datasets": "1.0.1",
  "apache-arrow": "21.2.0",
  arquero: "8.0.3",
  d3: "7.9.0",
  "d3-dsv": "3.0.1",
  echarts: "6.1.0",
  htl: "1.0.0",
  leaflet: "1.9.4",
  lodash: "4.18.1",
  "mapbox-gl": "3.29.0",
  "parquet-wasm": "0.7.2",
  react: "19.2.8",
  "react-dom": "19.2.8",
  "topojson-client": "3.1.0",
};

function safeRelative(root, path) {
  const value = relative(root, path);
  if (!value || value === ".." || value.startsWith(`..${sep}`)) {
    throw new Error("public site dependency escapes the site source root");
  }
  // Staged paths are site paths, not host paths: they are compared against
  // route and import strings and are written into the published artifact, so
  // they carry "/" on every platform. Windows' relative() returns "\", which
  // made every one of those comparisons miss.
  return value.split(sep).join("/");
}

export async function stagePublicSiteSources({ siteRoot, outputRoot, reportCatalog }) {
  const sourceRoot = resolve(siteRoot);
  const targetRoot = resolve(outputRoot);
  const templateSource = resolve(sourceRoot, "workflows/add-visual/template");
  safeRelative(sourceRoot, templateSource);
  const publicReports = Object.values(reportCatalog?.reports ?? {});
  const routes = publicReports.map((report) => {
    if (report.resolvedVisibility !== "public" || typeof report.route !== "string") {
      throw new Error("public source staging received a non-public report route");
    }
    return `${report.route}.md`;
  });
  // Design and template inputs are public authoring contracts, not examples.
  // Stage them explicitly so a public artifact can validate their canonical
  // paths without walking an existing report or visual.
  const queue = ["index.md", "reports/index.md", "style.css", "design/tokens.css", "design/visual-language.md", "design/reference.md", "workflows/add-visual/template/fixture.js", "workflows/add-visual/template/styles.css", "workflows/add-visual/template/visual.js", "workflows/add-report/template/report.yml", "workflows/add-report/template/report.js", "workflows/add-report/template/annotations.json", "workflows/add-report/template/state.js", "workflows/add-report/template/test.js", ...routes];
  for (const report of publicReports) {
    if (report.annotations?.path) {
      queue.push(`${dirname(report.route)}/${basename(report.route)}/${report.annotations.path}`);
    }
  }
  const copied = new Set();

  while (queue.length) {
    const requested = queue.shift();
    const source = resolve(sourceRoot, requested);
    const relativePath = safeRelative(sourceRoot, source);
    if (copied.has(relativePath)) continue;
    if (!(await stat(source)).isFile()) throw new Error(`public site dependency is missing: ${relativePath}`);
    const destination = resolve(targetRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
    copied.add(relativePath);

    if (!/\.(?:js|md|css)$/.test(relativePath)) continue;
    const content = await readFile(source, "utf8");
    const dependencies = [];
    for (const pattern of [
      /\bfrom\s+["'](\.[^"']+)["']/g,
      /\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g,
      /\bimport\s+["'](\.[^"']+)["']/g,
    ]) {
      for (const match of content.matchAll(pattern)) dependencies.push(match[1]);
    }
    for (const match of content.matchAll(/@import\s+(?:url\()?['"](\.[^'"]+)['"]\)?/g)) {
      dependencies.push(match[1]);
    }
    for (const dependency of dependencies) {
      const resolved = resolve(dirname(source), dependency);
      queue.push(safeRelative(sourceRoot, resolved));
    }
    for (const match of content.matchAll(/["'](?:\.\.\/)+assets\/([^"'?#)]+)["']/g)) {
      queue.push(`assets/${match[1]}`);
    }
  }
  return [...copied].sort();
}

export async function seedObservableNpmVersionIndex(root) {
  const cacheRoot = resolve(root, ".observablehq/cache/_npm");
  for (const [name, version] of Object.entries(observableNpmVersions)) {
    await mkdir(resolve(cacheRoot, `${name}@${version}`), { recursive: true });
  }
}
