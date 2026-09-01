/** Copy exactly the public Parquet assets declared by a compiled browser catalog. */
import { cp, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

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
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
  }));
}
