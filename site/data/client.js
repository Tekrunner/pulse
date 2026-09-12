import * as duckdb from "@duckdb/duckdb-wasm";

export class DataClientError extends Error {
  constructor(code, safeMessage, cause) {
    super(safeMessage, { cause });
    this.name = "DataClientError";
    this.code = code;
    this.safeMessage = safeMessage;
  }
}

function compatibilityError(message) {
  return new DataClientError("compatibility", message);
}

function validateCatalog(catalog) {
  if (!catalog || catalog.schemaId !== "pulse.browser-data" || !String(catalog.schemaVersion).startsWith("1.")) {
    throw compatibilityError("The report catalog uses an unsupported contract version.");
  }
  if (!catalog.datasets || typeof catalog.datasets !== "object") {
    throw new DataClientError("manifest", "The report catalog is invalid.");
  }
  return catalog;
}

function validateDataset(datasetId, entry) {
  const fields = ["datasetId", "logicalTable", "datasetContractVersion", "schema", "contentSha256", "representedPeriod", "semanticMetadata", "visibility", "parquet"];
  if (entry && !String(entry.datasetContractVersion).startsWith("1.")) {
    throw compatibilityError(`Dataset '${datasetId}' uses an unsupported contract version.`);
  }
  if (!entry || entry.datasetId !== datasetId || !fields.every((field) => Object.hasOwn(entry, field)) ||
      !/^[a-z][a-z0-9_]*$/.test(entry.logicalTable) ||
      entry.visibility !== "public" || typeof entry.parquet !== "string") {
    throw new DataClientError("manifest", `Dataset '${datasetId}' is not available.`);
  }
  if (entry.adapters !== undefined && !Array.isArray(entry.adapters)) {
    throw new DataClientError("manifest", `Dataset '${datasetId}' has invalid compatibility adapters.`);
  }
  return { ...entry, adapters: entry.adapters || [], table: entry.logicalTable };
}

function quoteIdentifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw compatibilityError("A dataset adapter uses an unsafe column or table name.");
  return `"${value}"`;
}

export function createDataClient({ bundle, manifestUrl, Worker = globalThis.Worker, DuckDB = duckdb, fetch = globalThis.fetch } = {}) {
  if (!bundle || !manifestUrl) throw new TypeError("bundle and manifestUrl are required");
  let worker; let database; let connection; let start; let manifest;
  let parquetLoaded = false;
  let disposed = false;
  const registered = new Set();

  async function startWithTimeout(operation, milliseconds = 15_000) {
    let timer;
    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new DataClientError("wasm-startup", "Browser data access timed out while starting.")), milliseconds);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function cleanup() {
    const activeConnection = connection; const activeWorker = worker;
    connection = undefined; database = undefined; worker = undefined; start = undefined; registered.clear();
    try { await activeConnection?.close(); } finally { activeWorker?.terminate(); }
  }

  async function initialize() {
    if (disposed) throw new DataClientError("disposed", "Browser data access has closed.");
    if (start) return start;
    start = (async () => {
      if (!Worker) throw new DataClientError("wasm-startup", "Browser data access could not start.");
      worker = new Worker(bundle.mainWorker);
      database = new DuckDB.AsyncDuckDB(new DuckDB.ConsoleLogger(), worker);
      await startWithTimeout(database.instantiate(bundle.mainModule, null));
      connection = await database.connect();
      if (disposed) throw new DataClientError("disposed", "Browser data access has closed.");
      return connection;
    })().catch(async (error) => {
      await cleanup();
      if (error instanceof DataClientError) throw error;
      throw new DataClientError("wasm-startup", "Browser data access could not start.", error);
    });
    return start;
  }

  async function loadManifest() {
    if (manifest) return manifest;
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error(`manifest returned ${response.status}`);
      manifest = validateCatalog(await response.json());
      return manifest;
    } catch (error) {
      if (error instanceof DataClientError) throw error;
      throw new DataClientError("manifest", "The report catalog could not be loaded.", error);
    }
  }

  async function registerDataset(datasetId) {
    const catalog = await loadManifest();
    const entry = validateDataset(datasetId, catalog.datasets?.[datasetId]);
    if (registered.has(datasetId)) return entry;
    if (!parquetLoaded) {
      if (typeof catalog.extensions?.parquet !== "string" || !/^[a-z0-9_.-]+$/.test(catalog.extensions.parquet)) {
        throw new DataClientError("manifest", "The report catalog does not define a local Parquet reader.");
      }
      const parquetExtensionUrl = new URL(catalog.extensions.parquet, manifestUrl).href;
      await connection.query(`LOAD '${parquetExtensionUrl}'`);
      parquetLoaded = true;
    }
    const parquetUrl = new URL(entry.parquet, manifestUrl).href;
    const fileName = `${entry.table}.parquet`;
    await database.registerFileURL(fileName, parquetUrl, DuckDB.DuckDBDataProtocol.HTTP, false);
    await connection.query(`CREATE OR REPLACE VIEW "${entry.table}" AS SELECT * FROM read_parquet('${fileName}')`);
    for (const adapter of entry.adapters) {
      if (!adapter || !String(adapter.version).startsWith("1.") || typeof adapter.owner !== "string" ||
          typeof adapter.removal_condition !== "string" || !adapter.column_mapping ||
          adapter.logical_table === entry.table) {
        throw compatibilityError(`Dataset '${datasetId}' has an invalid compatibility adapter.`);
      }
      const projection = Object.entries(adapter.column_mapping).map(([oldName, newName]) =>
        `${quoteIdentifier(newName)} AS ${quoteIdentifier(oldName)}`).join(", ");
      if (!projection) throw compatibilityError(`Dataset '${datasetId}' has an empty compatibility adapter.`);
      await connection.query(`CREATE OR REPLACE VIEW ${quoteIdentifier(adapter.logical_table)} AS SELECT ${projection} FROM ${quoteIdentifier(entry.table)}`);
    }
    registered.add(datasetId);
    return entry;
  }

  return {
    async warm() {
      try { await initialize(); }
      catch { /* Query surfaces the normalized startup failure in its slot. */ }
    },
    async query(datasetId, sql, { params = [], signal, expectedColumns = [], requireRows = false, mapRow } = {}) {
      await initialize();
      try {
        await registerDataset(datasetId);
        if (signal?.aborted) throw new DOMException("Query cancelled", "AbortError");
        const cancel = () => { void connection?.cancelSent(); };
        signal?.addEventListener("abort", cancel, { once: true });
        try {
          const statement = await connection.prepare(sql);
          try {
            const result = await statement.query(...params);
            const rows = result.toArray().map((row) => Object.fromEntries(Object.entries(row)));
            if (requireRows && rows.length === 0) {
              throw new DataClientError("empty", "The report data returned no rows.");
            }
            if (!Array.isArray(expectedColumns) || rows.some((row) => expectedColumns.some((column) => !Object.hasOwn(row, column)))) {
              throw compatibilityError("The report data does not match its declared visual schema.");
            }
            if (mapRow !== undefined && typeof mapRow !== "function") throw new TypeError("mapRow must be a function");
            const mapped = mapRow ? rows.map((row, index) => mapRow(row, index)) : rows;
            if (mapped.some((row) => !row || typeof row !== "object" || expectedColumns.some((column) => !Object.hasOwn(row, column)))) {
              throw compatibilityError("The mapped report data does not match its declared visual schema.");
            }
            if (rows.length && mapped.length === 0) {
              throw compatibilityError("Non-empty report data was mapped to an empty visual result.");
            }
            return mapped;
          } finally { await statement.close(); }
        } finally { signal?.removeEventListener("abort", cancel); }
      } catch (error) {
        if (error instanceof DataClientError || error?.name === "AbortError") throw error;
        throw new DataClientError("query", "The report data could not be queried.", error);
      }
    },
    async getDataset(datasetId) {
      return validateDataset(datasetId, (await loadManifest()).datasets?.[datasetId]);
    },
    get resources() { return { worker, connection }; },
    async dispose({ immediate = false } = {}) {
      disposed = true;
      if (immediate) {
        worker?.terminate(); worker = undefined; connection = undefined; database = undefined; start = undefined; registered.clear();
        return;
      }
      await cleanup();
    },
  };
}
