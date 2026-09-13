import { DataClientError } from "./client.js";

const REPORT_STATES = new Set(["ready", "loading", "empty", "query-error", "engine-error"]);
const SLOT_STATES = new Set([
  ...REPORT_STATES,
  "ready",
  "suspect",
  "stale",
  "schema-error",
  "render-error",
]);

export class ReportRuntimeError extends Error {
  constructor(code, safeMessage, cause) {
    super(safeMessage, { cause });
    this.name = "ReportRuntimeError";
    this.code = code;
    this.safeMessage = safeMessage;
  }
}

export function validateAnnotationArtifact(value) {
  if (!value || value.schemaVersion !== "1.0.0" || !Array.isArray(value.annotations)) {
    throw new ReportRuntimeError("schema", "Report annotations use an incompatible contract.");
  }
  const ids = new Set();
  for (const annotation of value.annotations) {
    const fields = ["id", "anchor", "body", "provenance", "dependencies", "visibility"];
    if (
      !annotation || Object.keys(annotation).length !== fields.length
      || fields.some((field) => !Object.hasOwn(annotation, field))
      || typeof annotation.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(annotation.id)
      || ids.has(annotation.id) || typeof annotation.anchor !== "string" || !annotation.anchor
      || typeof annotation.body !== "string" || !annotation.body.trim()
      || typeof annotation.provenance !== "string" || !annotation.provenance.trim()
      || !Array.isArray(annotation.dependencies)
      || annotation.dependencies.some((dependency, index) =>
        !dependency || typeof dependency !== "object"
        || Object.keys(dependency).length !== 2
        || typeof dependency.dataset !== "string" || !dependency.dataset
        || typeof dependency.column !== "string" || !dependency.column
        || annotation.dependencies.findIndex((item) =>
          item?.dataset === dependency.dataset && item?.column === dependency.column) !== index)
      || !["public", "private"].includes(annotation.visibility)
      || ["x", "y", "left", "top", "coordinates", "pixel"].some((field) => Object.hasOwn(annotation, field))
    ) {
      throw new ReportRuntimeError("schema", "A report annotation has invalid identity, anchor, provenance, or dependencies.");
    }
    ids.add(annotation.id);
  }
  return value;
}

/** Join data-owned annotations before any visual receives rows. */
export function joinAnnotations(rows, artifact, { anchorColumn, publicOnly = true } = {}) {
  if (!Array.isArray(rows) || typeof anchorColumn !== "string" || !anchorColumn) {
    throw new TypeError("rows and anchorColumn are required");
  }
  const annotations = validateAnnotationArtifact(artifact).annotations;
  if (publicOnly && annotations.some((item) => item.visibility !== "public")) {
    throw new ReportRuntimeError("privacy", "Private annotation lineage cannot enter a public report.");
  }
  const byAnchor = new Map();
  for (const annotation of annotations) {
    const matches = rows.filter((row) => String(row?.[anchorColumn]) === annotation.anchor);
    if (matches.length !== 1) {
      throw new ReportRuntimeError("schema", `Annotation '${annotation.id}' does not resolve to exactly one data row.`);
    }
    for (const dependency of annotation.dependencies) {
      if (
        !dependency || typeof dependency !== "object"
        || typeof dependency.column !== "string" || !dependency.column
        || !Object.hasOwn(matches[0], dependency.column)
      ) {
        throw new ReportRuntimeError("schema", `Annotation '${annotation.id}' has an unresolved dependency.`);
      }
    }
    const current = byAnchor.get(annotation.anchor) ?? [];
    current.push(Object.freeze({ ...annotation, dependencies: Object.freeze([...annotation.dependencies]) }));
    byAnchor.set(annotation.anchor, current);
  }
  return rows.map((row) => Object.freeze({
    ...row,
    annotations: Object.freeze(byAnchor.get(String(row[anchorColumn])) ?? []),
  }));
}

export function stateForError(error, scope = "slot") {
  const code = error?.code;
  if (["schema", "compatibility", "schema-incompatibility"].includes(code)) return "schema-error";
  if (["wasm-startup", "shared-engine-failure", "engine"].includes(code)) return "engine-error";
  if (code === "empty") return "empty";
  if (scope === "slot" && code === "render") return "render-error";
  return "query-error";
}

export function setAccessibleState(element, state, message, { retry } = {}) {
  if (!element || !SLOT_STATES.has(state)) throw new TypeError(`unknown report state '${state}'`);
  element.dataset.state = state;
  element.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  let status = element.querySelector(":scope > [data-report-status]");
  if (state === "ready" && message == null) {
    status?.remove();
    return state;
  }
  if (!status) {
    status = document.createElement("div");
    status.dataset.reportStatus = "";
    status.setAttribute("aria-live", "polite");
    element.prepend(status);
  }
  status.setAttribute("role", state.endsWith("error") ? "alert" : "status");
  status.replaceChildren(document.createTextNode(message ?? state));
  if (typeof retry === "function" && state.endsWith("error")) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Retry";
    button.addEventListener("click", retry, { once: true });
    status.append(" ", button);
  }
  return state;
}

/**
 * Query, annotation-join, mapping, and rendering boundary for one independent
 * slot. A rejected slot never clears or disables its siblings.
 */
export async function runReportSlot({ element, query, annotations, anchorColumn, mapRows, render, retry }) {
  setAccessibleState(element, "loading", "Loading visual data…");
  try {
    const rows = await query();
    if (!Array.isArray(rows) || rows.length === 0) throw new DataClientError("empty", "No data is available for this visual.");
    const joined = annotations ? joinAnnotations(rows, annotations, { anchorColumn }) : rows;
    let mapped;
    try {
      mapped = mapRows ? joined.map(mapRows) : joined;
    } catch (error) {
      throw new ReportRuntimeError("schema", "The visual data does not match its declared schema.", error);
    }
    try {
      await render(mapped, element);
    } catch (error) {
      throw new ReportRuntimeError("render", "This visual could not be rendered.", error);
    }
    setAccessibleState(element, "ready", null);
    return mapped;
  } catch (error) {
    const state = stateForError(error);
    setAccessibleState(element, state, error?.safeMessage ?? "This visual is temporarily unavailable.", { retry });
    return null;
  }
}

export function validateStateTopology(topology) {
  const exactStates = (states, expected) =>
    Array.isArray(states) && states.length === expected.size
    && new Set(states).size === states.length
    && states.every((state) => expected.has(state));
  if (
    !topology || topology.failure_scope !== "slot-local" || topology.retry !== "safe"
    || !exactStates(topology.report, REPORT_STATES)
    || !exactStates(topology.slot, SLOT_STATES)
  ) throw new ReportRuntimeError("schema", "The report state topology is incompatible.");
  return topology;
}
