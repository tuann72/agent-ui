"use client";

import { useEffect } from "react";
import type { AgentSide } from "./resize";

const PUSH_CLASS = "agent-sidebar-push";

// Agent owns exactly these globals: the push classes on <body> and the width
// variable on <html>. Instance-counted so a second mounted sidebar (however
// ill-advised) cannot strip them out from under the first on unmount.
let instances = 0;

/**
 * The sidebar's one job outside its own subtree: pushing the page aside.
 *
 * The transition class stays on <body> for the whole mounted life so opening
 * and closing both animate; the side class comes and goes with `open`, which
 * is what actually moves the margin. The width variable lives on <html> so
 * the panel and the margin read one value and cannot drift apart mid-drag
 * (see AGENTS.md). Everything is removed when the last sidebar unmounts.
 */
export function useSidebarPush({
  open,
  side,
  width,
}: {
  open: boolean;
  side: AgentSide;
  width: number | null;
}): void {
  useEffect(() => {
    instances += 1;
    document.body.classList.add(PUSH_CLASS);
    return () => {
      instances -= 1;
      if (instances === 0) {
        document.body.classList.remove(PUSH_CLASS);
        document.documentElement.style.removeProperty("--agent-sidebar-width");
      }
    };
  }, []);

  useEffect(() => {
    if (width === null) return;
    document.documentElement.style.setProperty(
      "--agent-sidebar-width",
      `${width}px`,
    );
  }, [width]);

  useEffect(() => {
    if (!open) return;
    const cls =
      side === "left" ? "agent-sidebar-push-left" : "agent-sidebar-push-right";
    document.body.classList.add(cls);
    return () => document.body.classList.remove(cls);
  }, [open, side]);
}
