"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useResizeDrag, type AgentPointerDragProps } from "./use-resize-drag";

export interface DetachedPosition {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

/**
 * Keep a floating panel fully on screen.
 *
 * Pure, and therefore the testable half of detaching: a detached panel is
 * positioned in viewport coordinates, and neither a drag nor a window resize
 * may park it somewhere its own title bar can no longer be grabbed. Clamping to
 * the panel's size rather than to a margin means a panel larger than the
 * viewport pins to the top-left instead of drifting off the other edge.
 *
 * Whole pixels, for the reason `clampSize` rounds: a panel at a fractional
 * offset lets its rounded overflow clip and its background land on different
 * device pixels, which shows as a hairline of surface down an edge.
 */
export function clampPosition(
  position: DetachedPosition,
  size: Size,
  viewport: Size,
): DetachedPosition {
  // Floored, not rounded: rounding a fractional bound up would let a flush
  // panel hang half a pixel off the far edge.
  const maxX = Math.max(0, Math.floor(viewport.width - size.width));
  const maxY = Math.max(0, Math.floor(viewport.height - size.height));
  return {
    x: Math.min(Math.max(Math.round(position.x), 0), maxX),
    y: Math.min(Math.max(Math.round(position.y), 0), maxY),
  };
}

const viewportSize = (): Size => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

/**
 * Drag-to-move for a detached panel, shared by the dock and the sidebar so the
 * two differ only in which element they position.
 *
 * The position stays null until the first drag, which leaves the resting
 * placement to CSS — the same arrangement as the sidebar's width, where the
 * stylesheet's default applies until a pointer overrides it. Re-attaching drops
 * the position too, so detaching again starts from that default rather than
 * from wherever the panel happened to be left.
 */
export function useDetachedPanel({
  detached,
  elementRef,
}: {
  detached: boolean;
  elementRef: RefObject<HTMLElement | null>;
}): {
  position: DetachedPosition | null;
  /**
   * Inline placement for the panel, or null while the stylesheet's centered
   * resting spot still applies. Built here rather than in each shell because
   * every offset it sets has to be released for the position to mean anything:
   * the centered default is `inset: 0` with auto margins, and a lone `left`/`top`
   * only shifts the box the margins are still centering. Both shells were
   * writing this object, and the sidebar's copy was missing `bottom`.
   */
  positionStyle: CSSProperties | null;
  dragHandleProps: AgentPointerDragProps;
} {
  const [position, setPosition] = useState<DetachedPosition | null>(null);
  const dragStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    if (!detached) setPosition(null);
  }, [detached]);

  // A shrinking window can leave a dragged panel off screen; pull it back.
  useEffect(() => {
    if (!detached) return;
    const onResize = () => {
      const bounds = elementRef.current?.getBoundingClientRect();
      if (!bounds) return;
      setPosition((current) =>
        current === null ? null : clampPosition(current, bounds, viewportSize()),
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [detached, elementRef]);

  const dragHandleProps = useResizeDrag(() => {
    const bounds = elementRef.current?.getBoundingClientRect();
    if (bounds) {
      dragStart.current = {
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    }
  })("move", (dx, dy) => {
    const start = dragStart.current;
    setPosition(
      clampPosition({ x: start.x + dx, y: start.y + dy }, start, viewportSize()),
    );
  });

  return {
    position,
    positionStyle:
      detached && position
        ? {
            left: position.x,
            top: position.y,
            right: "auto",
            bottom: "auto",
            margin: 0,
          }
        : null,
    dragHandleProps,
  };
}
