import { runHighlight } from "./highlight";
import { findTargetElement } from "./target";
import type { AgentHighlightOptions, AgentToolOutput } from "./types";

/**
 * `interact` is deliberately one interaction behind a generic pipeline, so it
 * can be turned into a different interaction by editing this file alone.
 *
 * The pipeline in `runInteract` — resolve the target, guard it, flash the
 * overlay, announce it, then act — is what makes the action safe and visible,
 * and it does not care what the action is. Three things below decide that:
 *
 *  1. `isInteractable` — the runtime guard. Which elements may be touched at
 *     all. Widen it only to elements whose activation the user can actually
 *     see happen.
 *  2. `applyInteraction` — the effect. Dispatch whatever event or call whatever
 *     API your interaction needs; the element handed to it has already passed
 *     the manifest check and the guard.
 *  3. `INTERACTION_VERB` — the past-tense word the announcement uses.
 *
 * Enforcement stays out of this file on purpose. The manifest opt-in
 * (`interactive: true`), the `auto | confirm | disabled` policy, and the
 * per-turn cap all live in `use-agent-chat.ts` and `tool-policy.ts`. So
 * rewriting the three pieces above changes *what happens* to an element the
 * model was already allowed to act on — it can never widen which elements the
 * model may reach, and the approval card still appears.
 */

/** Announced and shown in the transcript once the interaction runs. */
const INTERACTION_VERB = "Clicked";

/**
 * Elements the interaction may act on. Links are deliberately excluded:
 * following an href would bypass route allowlisting and the injected router, so
 * page changes stay with the navigate tool. Text inputs are excluded because
 * this action activates controls, it does not type.
 */
function isInteractable(element: HTMLElement): boolean {
  if (element instanceof HTMLButtonElement) return true;
  if (element instanceof HTMLInputElement) {
    return ["button", "submit", "reset"].includes(element.type);
  }
  return element.tagName === "SUMMARY";
}

/**
 * Reject an element the guard accepts but the DOM says is inert right now.
 * Returns null when there is nothing wrong with it.
 */
function runtimeRejection(element: HTMLElement): AgentToolOutput | null {
  if (
    (element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement) &&
    element.disabled
  ) {
    return { ok: false, reason: "target-disabled" };
  }
  return null;
}

/**
 * The interaction itself. A native click so the page's own handlers run
 * unchanged — no synthetic event, no framework-specific path.
 */
function applyInteraction(element: HTMLElement): void {
  element.click();
}

/**
 * Act on an opted-in page element. The target id must already be validated
 * against the manifest (registered on the current route AND flagged
 * interactive); this adds the runtime checks only the DOM can answer, flashes
 * the highlight overlay so the user sees what was acted on, then runs the
 * interaction.
 */
export function runInteract(
  targetId: string,
  highlightOptions?: AgentHighlightOptions,
): AgentToolOutput {
  const element = findTargetElement(targetId);
  if (!(element instanceof HTMLElement)) {
    return { ok: false, reason: "target-not-found" };
  }
  if (!isInteractable(element)) {
    return { ok: false, reason: "target-not-interactive" };
  }
  const rejection = runtimeRejection(element);
  if (rejection) return rejection;

  // Scrolls into view, draws the overlay, and announces via the shared
  // aria-live region — the user always sees and hears what Agent acted on.
  const shown = runHighlight(targetId, {
    ...highlightOptions,
    durationMs: 1600,
    label: `${INTERACTION_VERB}: ${targetId}`,
  });
  if (!shown.ok) return shown;

  applyInteraction(element);
  return { ok: true };
}
