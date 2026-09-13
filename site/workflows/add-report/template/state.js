import { setAccessibleState, stateForError } from "../../../data/report-runtime.js";

export function showReportFailure(region, error, retry) {
  return setAccessibleState(region, stateForError(error, "report"), error?.safeMessage, { retry });
}

export function showSlotFailure(slot, error, retry) {
  return setAccessibleState(slot, stateForError(error, "slot"), error?.safeMessage, { retry });
}
