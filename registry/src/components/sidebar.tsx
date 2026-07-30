"use client";

import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useFocusTrap } from "../core/focus-trap";
import {
  clampSize,
  growthFromPointer,
  keyboardResizeDelta,
  type AgentSide,
} from "../core/resize";
import { useDetachedPanel } from "../core/use-detach";
import { useResizeDrag } from "../core/use-resize-drag";
import { useShellLifecycle } from "../core/use-shell-lifecycle";
import { useSidebarPush } from "../core/use-sidebar-push";
import type { ReactNode } from "react";
import { useAgentContext } from "./agent-provider";
import { AgentPanelContents, LauncherButton, surfaceClass } from "./chat-parts";

/** How the collapsed sidebar invites a click: a vertical edge tab, or a
 *  floating button in the bottom corner. */
export type SidebarLauncher = "tab" | "button";

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 640;

export interface AgentSidebarProps {
  side?: AgentSide;
  launcher?: SidebarLauncher;
  /** `true`/omitted: standard header. `false`/`null`: none. Node: your own. */
  header?: ReactNode;
  /** Draw the line between the conversation and the input row. Default on. */
  inputSeparator?: boolean;
  /** Panel contents. Defaults to the standard header + body. */
  children?: ReactNode;
}

export function AgentSidebar({
  side = "right",
  launcher = "tab",
  header,
  inputSeparator = true,
  children,
}: AgentSidebarProps) {
  const { open, setOpen, detached, title, icon, appearance } =
    useAgentContext();
  // null until dragged: the panel and the page's push margin both read
  // --agent-sidebar-width, so the CSS default drives them until a resize sets it.
  const [width, setWidth] = useState<number | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartWidth = useRef(0);
  const { showPanel, closing, close, panelAnimationEnd } = useShellLifecycle({
    open,
    onOpenChange: setOpen,
    restoreFocusTo: launcherRef,
  });
  useFocusTrap(panelRef, showPanel);
  // A detached panel no longer occupies the edge, so the page takes its space
  // back — the push margin is what "attached" means for this shell.
  useSidebarPush({ open: open && !detached, side, width });
  const { positionStyle, dragHandleProps } = useDetachedPanel({
    detached,
    elementRef: panelRef,
  });

  const sideClass = side === "left" ? "agent-side-left" : "agent-side-right";

  const resizeTo = (next: number) => {
    const max = Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - 64);
    setWidth(clampSize(next, MIN_SIDEBAR_WIDTH, max));
  };

  const handleProps = useResizeDrag(() => {
    const bounds = panelRef.current?.getBoundingClientRect();
    if (bounds) dragStartWidth.current = bounds.width;
  });

  const resizeHandle = handleProps("ew", (dx) =>
    resizeTo(dragStartWidth.current + growthFromPointer(side, dx)),
  );

  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const delta = keyboardResizeDelta(event.key, event.shiftKey, side);
    // Height keys pass through untouched: the sidebar is always full-height.
    if (!delta || delta.width === 0) return;
    event.preventDefault();
    const current = width ?? panelRef.current?.getBoundingClientRect().width;
    if (current !== undefined) resizeTo(current + delta.width);
  };

  return (
    <>
      {!showPanel && (
        <LauncherButton
          launcherRef={launcherRef}
          ui={`sidebar-${launcher}`}
          className={`${launcher === "button" ? "agent-sidebar-button" : "agent-sidebar-tab"} ${sideClass}`}
        >
          {icon}
          {launcher === "button" ? (
            title
          ) : (
            <span className="agent-sidebar-tab-label">{title}</span>
          )}
        </LauncherButton>
      )}
      {showPanel && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`${title} assistant`}
          data-agent-ui="sidebar-panel"
          className={`${surfaceClass(appearance)} agent-sidebar-panel ${sideClass}${inputSeparator ? "" : " agent-no-separator"}${detached ? " agent-detached" : ""}${closing ? " agent-closing" : ""}`}
          style={positionStyle ?? undefined}
          onAnimationEnd={panelAnimationEnd}
        >
          <button
            type="button"
            className="agent-resize-handle agent-sidebar-resize"
            aria-label="Resize chat panel"
            onKeyDown={resizeWithKeyboard}
            {...resizeHandle}
          />
          <AgentPanelContents
            close={close}
            dragHandleProps={detached ? dragHandleProps : null}
            header={header}
          >
            {children}
          </AgentPanelContents>
        </div>
      )}
    </>
  );
}
