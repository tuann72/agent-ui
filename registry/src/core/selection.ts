/** Pure helpers for the "ask about selected text" feature. */

import type { AgentSelectionSide } from "./types";

export const MAX_SELECTION_CHARS = 600;
export const MAX_SELECTION_ITEMS = 8;

/** Distance kept between the selection popover and the viewport edge. */
export const SELECTION_VIEWPORT_MARGIN = 8;

/** The viewport-relative box the popover anchors to (a selection's bounds). */
export interface SelectionBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Anchor point for the chosen side. The gap, centering, and slide direction
 * are CSS's job (`--agent-popover-*` keyed on `data-side`); this only picks
 * the edge midpoint the popover hangs off.
 */
export function selectionAnchor(
  box: SelectionBox,
  side: AgentSelectionSide,
): { x: number; y: number } {
  const centerX = box.left + (box.right - box.left) / 2;
  const centerY = box.top + (box.bottom - box.top) / 2;
  switch (side) {
    case "bottom":
      return { x: centerX, y: box.bottom };
    case "left":
      return { x: box.left, y: centerY };
    case "right":
      return { x: box.right, y: centerY };
    default:
      return { x: centerX, y: box.top };
  }
}

/**
 * Offset along one axis that brings an overflowing popover back on screen.
 * The requested side is never abandoned — an off-screen popover slides along
 * its axis, it does not flip — and one too large to fit keeps its leading
 * edge visible.
 */
export function fitWithinViewport(
  start: number,
  end: number,
  limit: number,
  margin = SELECTION_VIEWPORT_MARGIN,
): number {
  if (start < margin) return margin - start;
  if (end > limit - margin) {
    return Math.max(limit - margin - end, margin - start);
  }
  return 0;
}

/**
 * Collapse whitespace and cap the length of a raw text selection.
 * Returns null when nothing meaningful was selected.
 */
export function normalizeSelection(
  text: string,
  maxChars = MAX_SELECTION_CHARS,
): string | null {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  if (collapsed.length <= maxChars) return collapsed;
  return `${collapsed.slice(0, maxChars).trimEnd()}…`;
}

/**
 * Normalize and append a selection while keeping pending context bounded.
 * Duplicate selections are ignored and the oldest item is dropped first
 * when the cap is reached.
 */
export function appendSelection(
  selections: readonly string[],
  rawSelection: string,
  maxItems = MAX_SELECTION_ITEMS,
): readonly string[] {
  const normalized = normalizeSelection(rawSelection);
  // Same reference on the no-op paths so state setters can bail out.
  if (!normalized || selections.includes(normalized)) return selections;
  const cap = Math.max(1, Math.floor(maxItems));
  return [...selections, normalized].slice(-cap);
}

/**
 * Prepend the quoted selection to the user's question as a markdown
 * blockquote, so the model (and the transcript) see what was selected.
 */
export function buildQuotedMessage(
  quotes: readonly string[],
  question: string,
): string {
  const quoted = quotes
    .flatMap((quote) => quote.split("\n").map((line) => `> ${line}`))
    .join("\n");
  return `${quoted}\n\n${question}`;
}
