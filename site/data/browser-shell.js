import { createDataClient } from "./client.js";

const bundle = {
  mainModule: new URL("./duckdb-eh.wasm", import.meta.url).href,
  mainWorker: new URL("./duckdb-browser-eh.worker.js", import.meta.url).href,
};
const manifestUrl = new URL("./manifest.json", import.meta.url);
let pageClient;

export function getPageDataClient() {
  return pageClient ??= createDataClient({ bundle, manifestUrl });
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { void pageClient?.dispose({ immediate: true }); }, { once: true });
}
