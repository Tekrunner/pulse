import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../dist");
const base = "/pulse/";
const port = Number(process.env.PULSE_SITE_PORT || 3000);
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".parquet": "application/octet-stream",
  ".wasm": "application/wasm",
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/") {
    response.writeHead(302, { location: base }).end();
    return;
  }
  if (!url.pathname.startsWith(base)) {
    response.writeHead(404).end();
    return;
  }
  const relative = normalize(url.pathname.slice(base.length));
  if (relative.startsWith("..")) {
    response.writeHead(400).end();
    return;
  }
  let path = join(root, relative || "index.html");
  try {
    const info = await stat(path);
    if (info.isDirectory()) path = join(path, "index.html");
  } catch {
    if (!extname(path)) path = `${path}.html`;
  }
  try {
    const info = await stat(path);
    const headers = { "accept-ranges": "bytes", "content-type": types[extname(path)] || "application/octet-stream" };
    const match = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) {
        response.writeHead(416, { "content-range": `bytes */${info.size}` }).end();
        return;
      }
      response.writeHead(206, { ...headers, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${info.size}` });
      if (request.method === "HEAD") response.end();
      else createReadStream(path, { start, end }).pipe(response);
      return;
    }
    response.writeHead(200, { ...headers, "content-length": info.size });
    if (request.method === "HEAD") response.end();
    else createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Pulse report available at http://127.0.0.1:${port}/pulse/`);
});
