"use client";

import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type RefObject,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import { motionDisabled } from "./motion";

export interface UseShellLifecycleOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Focused after a user-initiated close. Typically the launcher, which is
   * unmounted while the panel shows — so the focus() has to wait for the
   * commit that puts it back, which this hook does.
   */
  restoreFocusTo?: RefObject<HTMLElement | null>;
}

export interface ShellLifecycle {
  /** Keep the panel mounted: open, or still playing its exit animation. */
  showPanel: boolean;
  /** True while the exit animation plays; drives the `agent-closing` class. */
  closing: boolean;
  /** User-initiated close: motion-aware, restores focus when done. */
  close: () => void;
  /** Attach to the animated panel root; unmounts it when the exit ends. */
  panelAnimationEnd: (event: ReactAnimationEvent<HTMLElement>) => void;
  /** Transition-based shells use the same lifecycle completion contract. */
  panelTransitionEnd: (event: ReactTransitionEvent<HTMLElement>) => void;
}

/**
 * The open/closing/unmounted machinery shared by every variant shell.
 *
 * `open` reflects intent and flips false the moment a close begins; `closing`
 * keeps the panel mounted until its exit animation reports done. Because
 * intent and animation are separate, reopening while the exit plays (e.g. the
 * selection popover's "Ask Agent" mid-close) simply cancels the exit instead of
 * losing the request — the render-time reset below runs before anything
 * unmounts. An external `open={false}` from the controlling component skips
 * the animation and unmounts immediately, as controlled components do.
 *
 * With `prefers-reduced-motion`, `closing` is never entered: the panel
 * unmounts on the same commit that flips `open`, so nothing ever waits on an
 * `animationend` that will not fire.
 */
export function useShellLifecycle({
  open,
  onOpenChange,
  restoreFocusTo,
}: UseShellLifecycleOptions): ShellLifecycle {
  const [closing, setClosing] = useState(false);
  const restorePending = useRef(false);
  const showPanel = open || closing;

  // Reopen-during-close cancels the exit. Derived during render so the panel
  // never unmounts between the two commits.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setClosing(false);
  }

  useEffect(() => {
    if (open) restorePending.current = false;
  }, [open]);

  const close = () => {
    if (!open) return;
    if (!motionDisabled()) setClosing(true);
    restorePending.current = true;
    onOpenChange(false);
  };

  const panelAnimationEnd = (event: ReactAnimationEvent<HTMLElement>) => {
    if (closing && event.target === event.currentTarget) setClosing(false);
  };
  const panelTransitionEnd = (event: ReactTransitionEvent<HTMLElement>) => {
    if (closing && event.target === event.currentTarget) setClosing(false);
  };

  // Escape closes from anywhere on the page while the panel is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus can only return to the restore target after the commit that
  // remounts it — a focus() inside close() would target a null ref.
  useEffect(() => {
    if (showPanel || !restorePending.current) return;
    restorePending.current = false;
    restoreFocusTo?.current?.focus();
  }, [showPanel]);

  return {
    showPanel,
    closing,
    close,
    panelAnimationEnd,
    panelTransitionEnd,
  };
}
