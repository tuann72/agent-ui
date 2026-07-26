"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useFocusTrap } from "../core/focus-trap";
import { motionDisabled } from "../core/motion";
import {
  clampSize,
  growthFromPointer,
  keyboardResizeDelta,
  type AgentSide,
} from "../core/resize";
import { useResizeDrag } from "../core/use-resize-drag";
import { useShellLifecycle } from "../core/use-shell-lifecycle";
import type { ReactNode } from "react";
import { useAgentContext } from "./agent-provider";
import { AgentPanelContents, LauncherButton, surfaceClass } from "./chat-parts";

const DEFAULT_DOCK_SIZE = { width: 384, height: 448 };
const MIN_DOCK_SIZE = { width: 320, height: 320 };
const MAX_DOCK_SIZE = { width: 512, height: 832 };
const FALLBACK_LAUNCHER_SIZE = { width: 104, height: 37 };

function dockSizeLimits() {
  return {
    width: Math.min(MAX_DOCK_SIZE.width, window.innerWidth - 32),
    height: Math.min(MAX_DOCK_SIZE.height, window.innerHeight * 0.92),
  };
}

export interface AgentDockProps {
  side?: AgentSide;
  /** `true`/omitted: standard header. `false`/`null`: none. Node: your own. */
  header?: ReactNode;
  /** Draw the line between the conversation and the input row. Default on. */
  inputSeparator?: boolean;
  /** Panel contents. Defaults to the standard header + body. */
  children?: ReactNode;
}

export function AgentDock({
  side = "right",
  header,
  inputSeparator = true,
  children,
}: AgentDockProps) {
  const { open, setOpen, title, icon, appearance } = useAgentContext();
  const [size, setSize] = useState(DEFAULT_DOCK_SIZE);
  const [launcherSize, setLauncherSize] = useState(FALLBACK_LAUNCHER_SIZE);
  const [opening, setOpening] = useState(false);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (open !== previousOpen) {
    setPreviousOpen(open);
    setOpening(open);
  }
  const frameRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef(DEFAULT_DOCK_SIZE);
  const {
    showPanel,
    closing,
    close,
    panelAnimationEnd,
    panelTransitionEnd,
  } = useShellLifecycle({
    open,
    onOpenChange: setOpen,
    restoreFocusTo: launcherRef,
  });
  useFocusTrap(panelRef, showPanel);

  useLayoutEffect(() => {
    if (opening && motionDisabled()) setOpening(false);
  }, [opening]);

  const sideClass = side === "left" ? "agent-dock-left" : "agent-dock-right";

  const rememberLauncherSize = (button: HTMLButtonElement) => {
    const bounds = button.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    setLauncherSize((current) =>
      current.width === bounds.width && current.height === bounds.height
        ? current
        : { width: bounds.width, height: bounds.height },
    );
  };

  // Keep the explicit closed dimensions current so width/height can transition
  // between real pixel values. A ResizeObserver catches custom icons, titles,
  // fonts, and responsive host styles without polling.
  useLayoutEffect(() => {
    if (showPanel) return;
    const launcher = launcherRef.current;
    if (!launcher) return;
    rememberLauncherSize(launcher);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => rememberLauncherSize(launcher));
    observer.observe(launcher);
    return () => observer.disconnect();
  });

  const resizeTo = (width: number, height: number) => {
    const limits = dockSizeLimits();
    setSize({
      width: clampSize(width, MIN_DOCK_SIZE.width, limits.width),
      height: clampSize(height, MIN_DOCK_SIZE.height, limits.height),
    });
  };

  const handleProps = useResizeDrag(() => {
    const bounds = panelRef.current?.getBoundingClientRect();
    if (bounds) dragStart.current = { width: bounds.width, height: bounds.height };
  });

  const widthFrom = (dx: number) =>
    dragStart.current.width + growthFromPointer(side, dx);
  const heightFrom = (dy: number) => dragStart.current.height - dy;

  const cornerCursor = side === "right" ? "nwse" : "nesw";
  const corner = handleProps(cornerCursor, (dx, dy) =>
    resizeTo(widthFrom(dx), heightFrom(dy)),
  );
  const topEdge = handleProps("ns", (_dx, dy) =>
    resizeTo(dragStart.current.width, heightFrom(dy)),
  );
  const sideEdge = handleProps("ew", (dx) =>
    resizeTo(widthFrom(dx), dragStart.current.height),
  );

  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const delta = keyboardResizeDelta(event.key, event.shiftKey, side);
    if (!delta) return;
    event.preventDefault();
    resizeTo(size.width + delta.width, size.height + delta.height);
  };

  const frameSize = showPanel && !closing ? size : launcherSize;
  const frameStyle = {
    width: frameSize.width,
    height: frameSize.height,
  } satisfies CSSProperties;

  return (
    <div
      ref={frameRef}
      data-agent-ui="dock-frame"
      data-state={
        closing ? "closing" : showPanel ? (opening ? "opening" : "open") : "closed"
      }
      className={`agent-dock-frame ${sideClass}`}
      style={frameStyle}
      onTransitionEnd={(event) => {
        // Width and height end together. Key lifecycle completion to height so
        // one transition cannot unmount the panel while the other is running.
        if (event.propertyName !== "height") return;
        if (opening) setOpening(false);
        else panelTransitionEnd(event);
      }}
    >
      {!showPanel ? (
        <LauncherButton
          launcherRef={launcherRef}
          ui="dock-tab"
          className="agent-dock-tab"
          onBeforeOpen={rememberLauncherSize}
        >
          {icon} {title}
        </LauncherButton>
      ) : (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`${title} assistant`}
          data-agent-ui="dock-panel"
          className={`${surfaceClass(appearance)} agent-dock-panel${inputSeparator ? "" : " agent-no-separator"}${closing ? " agent-closing" : ""}`}
          onAnimationEnd={panelAnimationEnd}
        >
          <button
            type="button"
            className="agent-resize-handle agent-dock-resize"
            aria-label="Resize chat panel"
            onKeyDown={resizeWithKeyboard}
            {...corner}
          />
          {/* Pointer-only, so they stay out of the tab order: the corner button
              above already resizes both axes from the keyboard, and two extra
              tab stops that each do less would only pad the traversal. */}
          <div
            aria-hidden="true"
            className="agent-resize-handle agent-dock-edge agent-dock-edge-top"
            {...topEdge}
          />
          <div
            aria-hidden="true"
            className="agent-resize-handle agent-dock-edge agent-dock-edge-side"
            {...sideEdge}
          />
          <div className="agent-dock-contents">
            <AgentPanelContents close={close} header={header}>
              {children}
            </AgentPanelContents>
          </div>
        </div>
      )}
    </div>
  );
}
