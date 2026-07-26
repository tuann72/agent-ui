/** Side-aware resize arithmetic shared by the dock and sidebar. DOM-free. */

export type AgentSide = "left" | "right";

export function clampSize(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

/**
 * Convert horizontal pointer movement into growth. Panels are pinned to a
 * screen edge, so dragging toward the middle of the page is what widens them:
 * leftward (negative dx) grows a right-side panel, rightward a left-side one.
 */
export function growthFromPointer(side: AgentSide, dx: number): number {
  return side === "right" ? -dx : dx;
}

export interface ResizeKeyDelta {
  width: number;
  height: number;
}

/**
 * Arrow-key resize deltas for a focused handle; Shift steps coarser. Positive
 * means grow. Returns null when the key is not a resize key — callers must
 * leave the event alone then (no preventDefault).
 */
export function keyboardResizeDelta(
  key: string,
  shiftKey: boolean,
  side: AgentSide,
): ResizeKeyDelta | null {
  const step = shiftKey ? 32 : 16;
  switch (key) {
    case "ArrowUp":
      return { width: 0, height: step };
    case "ArrowDown":
      return { width: 0, height: -step };
    case "ArrowLeft":
      return { width: side === "right" ? step : -step, height: 0 };
    case "ArrowRight":
      return { width: side === "right" ? -step : step, height: 0 };
    default:
      return null;
  }
}
