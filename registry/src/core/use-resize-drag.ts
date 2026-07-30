"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Cursor held page-wide for the length of a drag. `move` is the detached
 * panel's title-bar drag, which needs the same plumbing as a resize edge and so
 * shares this hook rather than reimplementing pointer capture.
 */
export type ResizeCursor = "nwse" | "nesw" | "ew" | "ns" | "move";

/** Pointer handlers for one drag surface: a resize edge, or a drag handle. */
export interface AgentPointerDragProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

/**
 * Pointer-drag plumbing shared by every resize handle.
 *
 * Pointer capture retargets the drag's *events* to the handle, but not the
 * cursor: that resolves from whatever element sits under the pointer, so it
 * reverts the instant the drag leaves the handle. The fix is a class on <body>
 * for the duration, which is why this hook owns the class lifecycle — every
 * exit path has to clear it (pointer up, pointer cancel, and unmounting
 * mid-drag), or the whole page is left stuck with a resize cursor.
 *
 * `onStart` runs at pointer-down so callers can snapshot the geometry they are
 * about to resize; `onDelta` receives movement relative to that starting point.
 */
export function useResizeDrag(onStart: () => void) {
  const active = useRef<{ pointerId: number; x: number; y: number; cls: string } | null>(
    null,
  );

  useEffect(
    () => () => {
      if (active.current) document.body.classList.remove(active.current.cls);
    },
    [],
  );

  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    const start = active.current;
    if (!start || start.pointerId !== event.pointerId) return;
    active.current = null;
    document.body.classList.remove(start.cls);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  /**
   * Props for one handle. Each handle passes its own `onDelta`; pointer capture
   * keeps moves on the element that started the drag, so the right one always
   * runs without needing to be stashed at pointer-down.
   */
  return (
    cursor: ResizeCursor,
    onDelta: (dx: number, dy: number) => void,
  ): AgentPointerDragProps => ({
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      const cls = `agent-resizing-${cursor}`;
      active.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        cls,
      };
      onStart();
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.classList.add(cls);
      event.preventDefault();
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const start = active.current;
      if (!start || start.pointerId !== event.pointerId) return;
      onDelta(event.clientX - start.x, event.clientY - start.y);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
  });
}
