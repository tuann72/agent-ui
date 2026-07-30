/** Side-aware resize arithmetic shared by the dock and sidebar. DOM-free. */

export type AgentSide = "left" | "right";

/**
 * Clamp a dragged dimension into range, in whole pixels.
 *
 * The rounding is not cosmetic. A pointer produces fractional pixels, and a
 * panel committed at a fractional size gives its background box and its
 * contents' rounded overflow clip *different* device-pixel edges, so the surface
 * behind the header shows as a hairline down one side. Rounding here — the one
 * place every committed size passes through — keeps both edges on the same
 * pixel. The sidebar needs it for a second reason: its width is also the page's
 * push margin, and the panel edge and the margin edge must not round apart.
 */
export function clampSize(
  value: number,
  minimum: number,
  maximum: number,
): number {
  // The bounds round inward, so a fractional limit — a viewport-derived maximum
  // is one — can never be exceeded by the rounding itself. An inverted range
  // still resolves to the minimum.
  const lower = Math.ceil(minimum);
  const upper = Math.max(lower, Math.floor(maximum));
  return Math.min(Math.max(Math.round(value), lower), upper);
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
