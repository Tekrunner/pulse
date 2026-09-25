/**
 * Accessible state for the French GDP report.
 *
 * A failure is slot-local: a rejected figure sets its own state and offers
 * its own retry, and never clears, disables or re-renders a sibling. The
 * report-wide surface carries only the one failure no figure can survive,
 * which is the shared engine failing to start.
 */
import { setAccessibleState, stateForError } from "../../data/report-runtime.js";

export function showReportFailure(region, error, retry) {
  return setAccessibleState(region, stateForError(error, "report"), error?.safeMessage, { retry });
}

export function showSlotFailure(slot, error, retry) {
  return setAccessibleState(slot, stateForError(error, "slot"), error?.safeMessage, { retry });
}

/**
 * What survives an asynchronous refresh, restored by stable identity rather
 * than by position: the focused control, the scroll offset, and every open
 * disclosure. A reader half way through setting a custom end year does not
 * lose it because a figure finished loading.
 */
export function captureView(root) {
  const active = root.ownerDocument?.activeElement ?? null;
  return Object.freeze({
    focus: active?.dataset?.control ?? active?.id ?? null,
    selectionStart: typeof active?.selectionStart === "number" ? active.selectionStart : null,
    scrollY: root.ownerDocument?.defaultView?.scrollY ?? 0,
    open: [...root.querySelectorAll("details[open]")].map((item) => item.dataset.disclosure).filter(Boolean),
  });
}

export function restoreView(root, view) {
  if (!view) return;
  for (const item of root.querySelectorAll("details[data-disclosure]")) {
    if (view.open.includes(item.dataset.disclosure)) item.open = true;
  }
  const target = [...root.querySelectorAll("[data-control], [id]")]
    .find((item) => (item.dataset.control ?? item.id) === view.focus);
  if (target) {
    target.focus({ preventScroll: true });
    if (view.selectionStart !== null && typeof target.setSelectionRange === "function") {
      try { target.setSelectionRange(view.selectionStart, view.selectionStart); } catch { /* not a text control */ }
    }
  }
  root.ownerDocument?.defaultView?.scrollTo?.({ top: view.scrollY });
}
