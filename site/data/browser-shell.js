import { createDataClient } from "./client.js";

const bundle = {
  mainModule: new URL("./duckdb-eh.wasm", import.meta.url).href,
  mainWorker: new URL("./duckdb-browser-eh.worker.js", import.meta.url).href,
};
const manifestUrl = new URL("./browser-data.json", import.meta.url);
let pageClient;

export function getPageDataClient() {
  return pageClient ??= createDataClient({ bundle, manifestUrl });
}

if (typeof window !== "undefined") {
  // Start the one shared session while the report module is evaluated. This is
  // deliberately route-scoped so navigation-only pages do not allocate a worker.
  if (window.location.pathname.endsWith("/reports/report")) void getPageDataClient().warm();
  window.addEventListener("pagehide", () => { void pageClient?.dispose({ immediate: true }); }, { once: true });
}
