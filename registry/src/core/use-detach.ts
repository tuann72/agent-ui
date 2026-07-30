"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
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
 */
export function clampPosition(
  position: DetachedPosition,
  size: Size,
  viewport: Size,
): DetachedPosition {
  const maxX = Math.max(0, viewport.width - size.width);
  const maxY = Math.max(0, viewport.height - size.height);
  return {
    x: Math.min(Math.max(position.x, 0), maxX),
    y: Math.min(Math.max(position.y, 0), maxY),
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

  return { position, dragHandleProps };
}
