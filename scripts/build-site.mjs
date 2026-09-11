import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { copyCatalogedParquet, writeArtifactInventory } from "./public-data-assets.mjs";
import { seedObservableNpmVersionIndex, stagePublicSiteSources } from "./public-site-sources.mjs";

const root = resolve(import.meta.dirname, "..");

function options(arguments_) {
  const value = {
    archiveRoot: resolve(root, "snapshots/public"),
    publishRoot: resolve(root, "publish/public"),
    output: resolve(root, "dist"),
    generatedAt: null,
    public: false,
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--public") value.public = true;
    else if (argument === "--archive-root") value.archiveRoot = resolve(arguments_[++index]);
    else if (argument === "--publish-root") value.publishRoot = resolve(arguments_[++index]);
    else if (argument === "--output") value.output = resolve(arguments_[++index]);
    else if (argument === "--generated-at") value.generatedAt = arguments_[++index];
    else throw new Error(`unknown build-site argument '${argument}'`);
  }
  return value;
}

function run(command, arguments_, environment = process.env) {
  const completed = spawnSync(command, arguments_, {
    cwd: root,
    env: environment,
    stdio: "inherit",
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  if (completed.error) throw completed.error;
  if (completed.status !== 0) throw new Error(`${basename(command)} exited ${completed.status ?? 1}`);
}

async function promote(candidate, output) {
  const backup = `${output}.previous-${process.pid}`;
  let hadPrevious = false;
  try {
    await rename(output, backup);
    hadPrevious = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await rename(candidate, output);
  } catch (error) {
    if (hadPrevious) await rename(backup, output);
    throw error;
  }
  if (hadPrevious) await rm(backup, { recursive: true, force: true });
}

const setting = options(process.argv.slice(2));
setting.generatedAt ??= new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
if (setting.public && process.versions.node.split(".")[0] !== "24") {
  throw new Error(`public build requires Node 24 (found ${process.versions.node})`);
}
await mkdir(dirname(setting.output), { recursive: true });
const work = await mkdtemp(resolve(dirname(setting.output), ".pulse-site-"));
const candidate = resolve(work, "artifact");
const inputs = resolve(work, "inputs");
const catalog = resolve(inputs, "browser-data.json");
const reportCatalog = resolve(inputs, "reports.json");
const statusCatalog = resolve(inputs, "status.json");

try {
  await mkdir(inputs, { recursive: true });
  const python = process.env.PULSE_PYTHON || resolve(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const catalogArguments = [
    "-m", "pulse.cli", "catalog", "build",
    "--output", catalog,
    "--reports-output", reportCatalog,
    "--status-output", statusCatalog,
    "--reports-root", resolve(root, "site/reports"),
    "--archive-root", setting.archiveRoot,
    "--publish-root", setting.publishRoot,
    "--parquet-prefix", "datasets",
    "--public-closure",
  ];
  if (setting.generatedAt) catalogArguments.push("--generated-at", setting.generatedAt, "--site-attempted-at", setting.generatedAt);
  run(python, catalogArguments);

  const publicSiteRoot = resolve(inputs, "public-site");
  if (setting.public) {
    await stagePublicSiteSources({
      siteRoot: resolve(root, "site"),
      outputRoot: publicSiteRoot,
      reportCatalog: JSON.parse(await readFile(reportCatalog, "utf8")),
    });
    await seedObservableNpmVersionIndex(publicSiteRoot);
  }

  const observable = resolve(root, "node_modules/.bin", process.platform === "win32" ? "observable.cmd" : "observable");
  run(observable, ["build"], {
    ...process.env,
    OBSERVABLE_TELEMETRY_DISABLE: "1",
    PULSE_SITE_OUTPUT: candidate,
    ...(setting.public ? { PULSE_SITE_ROOT: publicSiteRoot } : {}),
  });

  const dataOutput = resolve(candidate, "_import/data");
  await mkdir(dataOutput, { recursive: true });
  await Promise.all([
    cp(resolve(setting.public ? publicSiteRoot : resolve(root, "site"), "assets"), resolve(candidate, "assets"), { recursive: true }),
    cp(resolve(root, "node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js"), resolve(dataOutput, "duckdb-browser-eh.worker.js")),
    cp(resolve(root, "node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm"), resolve(dataOutput, "duckdb-eh.wasm")),
    cp(resolve(root, "site/data/parquet.duckdb_extension.wasm"), resolve(dataOutput, "parquet.duckdb_extension.wasm")),
    cp(catalog, resolve(dataOutput, "browser-data.json")),
    cp(reportCatalog, resolve(dataOutput, "reports.json")),
    cp(statusCatalog, resolve(dataOutput, "status.json")),
    copyCatalogedParquet({ catalogPath: catalog, publishDataRoot: resolve(setting.publishRoot, "data"), dataOutput }),
  ]);
  await writeFile(resolve(candidate, ".nojekyll"), "");
  const inventory = await writeArtifactInventory(candidate);
  run(process.execPath, [
    resolve(root, "tests/browser/artifact-scan.mjs"),
    "--root", candidate,
    ...(setting.public ? ["--public"] : []),
  ]);
  await promote(candidate, setting.output);
  console.log(`Pulse site artifact ${inventory.artifactSha256} is verified and ready at ${setting.output}.`);
} finally {
  await rm(work, { recursive: true, force: true });
}
