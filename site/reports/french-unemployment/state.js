import { setAccessibleState, stateForError, validateStateTopology } from "../../data/report-runtime.js";

/** The topology declared in this report's report.yml, restated where the
 *  runtime can check it. A report state is report-wide; a slot state is
 *  confined to one figure and never clears its siblings. */
export const STATE_TOPOLOGY = Object.freeze({
  report: ["ready", "loading", "empty", "query-error", "engine-error"],
  slot: [
    "ready", "loading", "empty", "suspect", "stale",
    "query-error", "schema-error", "render-error", "engine-error",
  ],
  failure_scope: "slot-local",
  retry: "safe",
});

export function assertStateTopology() {
  return validateStateTopology(STATE_TOPOLOGY);
}

export function showReportFailure(region, error, retry) {
  return setAccessibleState(region, stateForError(error, "report"), error?.safeMessage, { retry });
}

export function showSlotFailure(slot, error, retry) {
  return setAccessibleState(slot, stateForError(error, "slot"), error?.safeMessage, { retry });
}
