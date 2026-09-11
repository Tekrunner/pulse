/** Copy exactly the public Parquet assets declared by a compiled browser catalog. */
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

function catalogRelativeParquet(entry) {
  if (!entry || entry.visibility !== "public" || typeof entry.parquet !== "string") {
    throw new Error("browser catalog has an invalid public dataset entry");
  }
  const parts = entry.parquet.split("/");
  if (parts[0] !== "datasets" || parts.length < 2 || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`browser catalog has an unsafe Parquet URL '${entry.parquet}'`);
  }
  return parts;
}

export async function copyCatalogedParquet({ catalogPath, publishDataRoot, dataOutput }) {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const entries = Object.values(catalog.datasets ?? {});
  if (!entries.length) throw new Error("browser catalog has no public datasets to package");
  await Promise.all(entries.map(async (entry) => {
    const parts = catalogRelativeParquet(entry);
    const relative = parts.slice(1);
    const source = resolve(publishDataRoot, ...relative);
    const destination = resolve(dataOutput, ...parts);
    const dataRoot = `${resolve(dataOutput)}${sep}`;
    if (!destination.startsWith(dataRoot)) throw new Error("browser catalog Parquet destination escapes the site data root");
    const bytes = await readFile(source);
    if (bytes.subarray(0, 64).toString("utf8").startsWith("version https://git-lfs.github.com/spec/v1")) {
      throw new Error(`public dataset '${entry.datasetId}' is an unresolved Git LFS pointer`);
    }
    const observed = createHash("sha256").update(bytes).digest("hex");
    if (entry.contentSha256 && observed !== entry.contentSha256) {
      throw new Error(`public dataset '${entry.datasetId}' has a Parquet hash mismatch`);
    }
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
  }));
}

async function artifactFiles(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`public artifact contains a symbolic link: ${relative(root, path)}`);
    if (entry.isDirectory()) files.push(...await artifactFiles(root, path));
    else if (entry.isFile() && entry.name !== "artifact-inventory.json") files.push(path);
  }
  return files;
}

export async function writeArtifactInventory(root) {
  const records = [];
  for (const path of (await artifactFiles(root)).sort()) {
    const bytes = await readFile(path);
    records.push({ path: relative(root, path).split(sep).join("/"), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  const artifactSha256 = createHash("sha256").update(JSON.stringify(records)).digest("hex");
  const inventory = { schemaId: "pulse.site-inventory", schemaVersion: "1.0.0", base: "/pulse/", artifactSha256, files: records };
  await writeFile(join(root, "artifact-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
  return inventory;
}

export async function verifyArtifactInventory(root) {
  const inventory = JSON.parse(await readFile(join(root, "artifact-inventory.json"), "utf8"));
  if (inventory.schemaId !== "pulse.site-inventory" || !String(inventory.schemaVersion).startsWith("1.")) throw new Error("public artifact inventory has an unsupported contract version");
  const observed = [];
  for (const path of (await artifactFiles(root)).sort()) {
    const bytes = await readFile(path);
    observed.push({ path: relative(root, path).split(sep).join("/"), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  if (JSON.stringify(observed) !== JSON.stringify(inventory.files)) throw new Error("public artifact files disagree with the verified inventory");
  const digest = createHash("sha256").update(JSON.stringify(observed)).digest("hex");
  if (digest !== inventory.artifactSha256) throw new Error("public artifact inventory hash drifted");
  return inventory;
}

const textExtensions = new Set([".html", ".js", ".css", ".json", ".txt", ".xml"]);
const privatePath = /(?:\/home\/|\/Users\/)[a-z0-9._-]+(?:\/|\\)|[A-Z]:\\Users\\[a-z0-9._-]+\\/i;
const credential = /(?:password|secret|api[_-]?key|authorization)\s*[:=]\s*["'][^"']+/i;
const remoteExecution = /(?:fetch\s*\(|import\s*\(|\bfrom\s+)["'\s]*https?:\/\//i;
const forbiddenPart = /^(?:\.git|\.env|private|secrets?|node_modules|test-results)$/i;

/** Reject content that cannot be handed to a public static host safely. */
export async function scanArtifactSafety(root, { maxBytes = 1_000_000_000 } = {}) {
  let totalBytes = 0;
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`public artifact contains a symbolic link: ${relative(root, path)}`);
      if (forbiddenPart.test(entry.name)) throw new Error(`residual or private path in public artifact: ${path}`);
      if (entry.isDirectory()) await scan(path);
      else {
        const bytes = await readFile(path);
        totalBytes += bytes.length;
        if (path.endsWith(".map")) throw new Error(`public source map is not allowed: ${path}`);
        if (textExtensions.has(extname(path))) {
          const content = bytes.toString("utf8");
          if (privatePath.test(content)) throw new Error(`private filesystem path in ${path}`);
          const vendored = path.includes(`${sep}_node${sep}`) || path.includes(`${sep}_observablehq${sep}`) || path.endsWith("duckdb-browser-eh.worker.js");
          if (!vendored && credential.test(content)) throw new Error(`credential-shaped value in ${path}`);
          if (!vendored && extname(path) === ".js" && remoteExecution.test(content)) throw new Error(`remote browser execution in ${path}`);
          if ((extname(path) === ".html" || extname(path) === ".css") && /https?:\/\//i.test(content)) throw new Error(`remote browser dependency in ${path}`);
        }
      }
    }
  }
  await scan(root);
  if (totalBytes >= maxBytes) throw new Error("public artifact exceeds the 1 GB Pages limit");
  return totalBytes;
}
