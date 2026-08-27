import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const mounts = new Map([["pulse", resolve("dist")], ["vite", resolve("tests/portability/vite/dist")]]);
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".parquet": "application/octet-stream", ".wasm": "application/wasm" };
const server = createServer(async (request, response) => {
  const parts = decodeURIComponent(new URL(request.url, "http://localhost").pathname).split("/").filter(Boolean);
  const root = mounts.get(parts.shift());
  if (!root) { response.writeHead(404).end(); return; }
  const relative = normalize(parts.join("/"));
  if (relative.startsWith("..")) { response.writeHead(400).end(); return; }
  let path = join(root, relative || "index.html");
  try {
    const info = await stat(path);
    if (info.isDirectory()) path = join(path, "index.html");
  } catch {
    if (!extname(path)) path = `${path}.html`;
  }
  try {
    const info = await stat(path);
    response.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream", "content-length": info.size });
    createReadStream(path).pipe(response);
  } catch { response.writeHead(404).end(); }
});
server.listen(3101, "127.0.0.1", () => console.log("Artifact server listening on http://127.0.0.1:3101"));
