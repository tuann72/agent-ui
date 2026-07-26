"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
} from "react";
import { motionDisabled } from "../core/motion";
import {
  fitWithinViewport,
  normalizeSelection,
  selectionAnchor,
  type SelectionBox,
} from "../core/selection";
import { useAgentContext } from "./agent-provider";
import { PlusIcon } from "./icons";

interface PopoverState {
  /** Viewport-relative box of the selection the popover is anchored to. */
  rect: SelectionBox;
  text: string;
}

function eligibleSelection(): { text: string; rect: DOMRect } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  // Never offer the popup for text selected inside Agent's own UI.
  const container =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  if (container?.closest("[data-agent-ui]")) return null;
  const text = normalizeSelection(selection.toString());
  if (!text) return null;
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { text, rect };
}

/**
 * Floating "Ask Agent" button shown beside a text selection, on whichever of
 * the four sides `selectionSide` names. Reads the title, icon, side, and the
 * attach-and-open action from context, so it must render inside a
 * `<AgentProvider>` (or `<AgentChat>`). The selected text is normalized/capped by
 * `askAboutSelection`.
 */
export function AgentSelectionPopover() {
  const {
    title,
    icon,
    selectionSide,
    askAboutSelection,
    addSelectionContext,
  } = useAgentContext();
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [closing, setClosing] = useState(false);
  // Viewport correction applied on top of the anchor, measured after layout.
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);
  // Mirrors `popover !== null` for the document-level listeners below, which
  // close over the first render: `selectionchange` fires on every caret move
  // page-wide, so the nothing-shown path must be a bare ref check.
  const shownRef = useRef(false);

  // Losing the selection plays the popup out rather than unmounting it, so the
  // node survives long enough for the exit animation to run.
  const dismiss = () => {
    if (!shownRef.current) return;
    if (motionDisabled()) {
      shownRef.current = false;
      setPopover(null);
      return;
    }
    setClosing(true);
  };

  const show = (next: PopoverState) => {
    shownRef.current = true;
    setClosing(false);
    setPopover(next);
  };

  // Fires for the entrance animation too, hence the `closing` guard.
  const onAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (closing && event.target === event.currentTarget) {
      shownRef.current = false;
      setPopover(null);
    }
  };

  useEffect(() => {
    // Selections are inspected after pointer/keyboard interaction settles,
    // not on every selectionchange, so the popup doesn't flicker mid-drag.
    const update = () => {
      const found = eligibleSelection();
      if (!found) {
        dismiss();
        return;
      }
      // The raw box is kept, not a resolved point, so changing sides
      // repositions an already-visible popup without re-reading the selection.
      const { top, right, bottom, left } = found.rect;
      show({ rect: { top, right, bottom, left }, text: found.text });
    };
    const onPointerUp = () => requestAnimationFrame(update);
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
        return;
      }
      if (event.shiftKey || event.key === "Shift") requestAnimationFrame(update);
    };
    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) dismiss();
    };
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, []);

  // Measured after the side transform lands, so the box below is the real
  // painted one. Subtracting the current shift measures back to the unshifted
  // position, which keeps the correction idempotent across re-runs.
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    // No correction is possible before the popover has a painted box (and
    // layout-less test DOMs report zero here).
    if (box.width === 0 && box.height === 0) return;
    const left = box.left - shift.x;
    const top = box.top - shift.y;
    const next = {
      x: fitWithinViewport(left, left + box.width, window.innerWidth),
      y: fitWithinViewport(top, top + box.height, window.innerHeight),
    };
    if (next.x !== shift.x || next.y !== shift.y) setShift(next);
  }, [popover, selectionSide, shift]);

  if (!popover) return null;

  const anchor = selectionAnchor(popover.rect, selectionSide);
  const activate = (action: (text: string) => void) => {
    const text = popover.text;
    dismiss();
    window.getSelection()?.removeAllRanges();
    action(text);
  };

  return (
    <div
      ref={nodeRef}
      data-agent-ui="selection-popover"
      data-state={closing ? "closed" : "open"}
      data-side={selectionSide}
      className="agent-selection-popover"
      style={{ left: anchor.x + shift.x, top: anchor.y + shift.y }}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="agent-selection-actions">
        <button
          type="button"
          className="agent-btn-primary agent-selection-ask"
          // Keep the selection alive: pointerdown would collapse it first.
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => activate(askAboutSelection)}
        >
          {icon} Ask {title}
        </button>
        <button
          type="button"
          className="agent-btn-primary agent-selection-add"
          aria-label={`Add selection to ${title} context`}
          title={`Add selection to ${title} context`}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => activate(addSelectionContext)}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}
