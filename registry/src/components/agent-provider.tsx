"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { NO_STARTER_PROMPTS } from "../core/starter-prompts";
import type { AgentPointerDragProps } from "../core/use-resize-drag";
import {
  useAgentChat,
  type UseAgentChatOptions,
  type UseAgentChatReturn,
} from "../core/use-agent-chat";
import type {
  AgentAppearance,
  AgentSelectionSide,
  AgentStarterPrompt,
} from "../core/types";
import { AgentIcon } from "./icons";

/**
 * Shared state every Agent component reads. `AgentProvider` runs the headless
 * core and owns the panel's open state; the shells and the composable parts
 * (title, header, messages, input, action buttons) consume it from here rather
 * than through prop drilling, so a consumer can rearrange the pieces freely.
 * Security still lives entirely in `useAgentChat` — the parts are presentation.
 */
export interface AgentContextValue {
  agent: UseAgentChatReturn;
  /** Whether the shell panel is open. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Whether this shell offers a detach control at all. */
  detachable: boolean;
  /**
   * Whether the panel is currently a free-floating, draggable window instead of
   * a panel pinned to its screen edge. Always false when `detachable` is false.
   */
  detached: boolean;
  setDetached: (detached: boolean) => void;
  /** Display name shown in launchers, headers, and the selection popover. */
  title: string;
  /** Brand mark rendered next to the title everywhere one appears. */
  icon: ReactNode;
  /** Surface finish shared by the shell's panel(s). */
  appearance: AgentAppearance;
  /** Contextual task suggestions shown before the first message. */
  starterPrompts: readonly AgentStarterPrompt[];
  /** Which edge of a text selection the "Ask" popover attaches to. */
  selectionSide: AgentSelectionSide;
  /** Attach selected page text and open the shell — used by the popover. */
  askAboutSelection: (text: string) => void;
  /** Attach selected page text without changing the current shell state. */
  addSelectionContext: (text: string) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

/** Read the shared Agent state. Throws outside a `<AgentProvider>`/`<AgentChat>`. */
export function useAgentContext(): AgentContextValue {
  const value = useContext(AgentContext);
  if (!value) {
    throw new Error(
      "Agent components must be rendered inside <AgentProvider> (or <AgentChat>).",
    );
  }
  return value;
}

/**
 * Per-shell context carrying the mounted panel's motion-aware `close`. It is
 * separate from `AgentContext` because only a component rendered inside a shell
 * can play that shell's exit animation; everything else closes by flipping the
 * shared open state.
 */
interface AgentShellContextValue {
  close: () => void;
  /**
   * Set by a shell only while its panel is detached: the pointer handlers that
   * move the floating window. `AgentHeader` becomes the title bar by spreading
   * them, so a custom header opts in the same way through `useAgentDragHandle`.
   */
  dragHandleProps: AgentPointerDragProps | null;
}
const AgentShellContext = createContext<AgentShellContextValue | null>(null);

/** Each shell wraps its panel contents in this so `<CloseButton>` can animate. */
export function AgentShellProvider({
  close,
  dragHandleProps = null,
  children,
}: {
  close: () => void;
  dragHandleProps?: AgentPointerDragProps | null;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ close, dragHandleProps }),
    [close, dragHandleProps],
  );
  return (
    <AgentShellContext.Provider value={value}>
      {children}
    </AgentShellContext.Provider>
  );
}

/**
 * The drag handlers for a detached panel's title bar, or null when the panel is
 * attached (or the shell is not detachable). Spread the result onto whatever
 * element should move the window.
 */
export function useAgentDragHandle(): AgentPointerDragProps | null {
  return useContext(AgentShellContext)?.dragHandleProps ?? null;
}

/**
 * Close Agent from a composable button. Inside a shell this plays the panel's
 * exit animation; outside one (no shell context) it falls back to flipping the
 * shared open state.
 */
export function useCloseAgent(): () => void {
  const shell = useContext(AgentShellContext);
  const { setOpen } = useAgentContext();
  return shell ? shell.close : () => setOpen(false);
}

export interface AgentProviderProps extends UseAgentChatOptions {
  /** Display name shown everywhere the shell names itself. Default `"Agent"`. */
  title?: string;
  /** Brand mark; any node. Defaults to the Agent ring mark. */
  icon?: ReactNode;
  /** Surface finish: opaque `"default"` or backdrop-blur `"glass"`. */
  appearance?: AgentAppearance;
  /** Contextual task suggestions shown before the first message. */
  starterPrompts?: readonly AgentStarterPrompt[];
  /** Edge of the selection the "Ask" popover attaches to. Default `"top"`. */
  selectionSide?: AgentSelectionSide;
  /** Controlled open state. Omit for uncontrolled (starts from `defaultOpen`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Initial open state when uncontrolled. Default `false`. */
  defaultOpen?: boolean;
  /**
   * Offer a detach control in the panel header, letting the user pull the dock
   * or sidebar out into a floating, draggable window. Default `false`, so the
   * header gains a button only where a host wants one.
   */
  detachable?: boolean;
  /** Controlled detached state. Omit for uncontrolled. */
  detached?: boolean;
  onDetachedChange?: (detached: boolean) => void;
  /** Initial detached state when uncontrolled. Default `false`. */
  defaultDetached?: boolean;
  children: ReactNode;
}

/**
 * The controlled/uncontrolled flag pattern, once. `open` and `detached` both
 * follow it, so a host can drive either, both, or neither, and they behave
 * identically from the outside.
 */
function useFlag(
  value: boolean | undefined,
  onChange: ((next: boolean) => void) | undefined,
  initial: boolean,
): [boolean, (next: boolean) => void] {
  const [uncontrolled, setUncontrolled] = useState(initial);
  const controlled = value !== undefined;
  const set = useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolled(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );
  return [value === undefined ? uncontrolled : value, set];
}

// A module constant, not an inline default: default parameter values are
// re-created every render and would invalidate the context memo below. The
// starter-prompt defaults live in core/starter-prompts.ts for the same reason.
const DEFAULT_ICON = <AgentIcon />;

export function AgentProvider({
  title = "Agent",
  icon = DEFAULT_ICON,
  appearance = "default",
  starterPrompts = NO_STARTER_PROMPTS,
  selectionSide = "top",
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  detachable = false,
  detached: controlledDetached,
  onDetachedChange,
  defaultDetached = false,
  children,
  ...chatOptions
}: AgentProviderProps) {
  const agent = useAgentChat(chatOptions);
  const [open, setOpenFlag] = useFlag(controlledOpen, onOpenChange, defaultOpen);
  const [detachedFlag, setDetached] = useFlag(
    controlledDetached,
    onDetachedChange,
    defaultDetached,
  );
  // A shell that was never given `detachable` can still be handed `detached` by
  // a stale host; gate on the capability so one prop is enough to turn the whole
  // feature off.
  const detached = detachable && detachedFlag;

  const setOpen = useCallback(
    (next: boolean) => {
      // Closing re-attaches. The collapsed launcher lives on a screen edge, so
      // a panel that stayed detached would shrink back into a tab that is not
      // where the panel was.
      if (!next) setDetached(false);
      setOpenFlag(next);
    },
    [setOpenFlag, setDetached],
  );

  const askAboutSelection = useCallback(
    (text: string) => {
      agent.attachQuote(text);
      setOpen(true);
    },
    [agent.attachQuote, setOpen],
  );
  const addSelectionContext = agent.attachQuote;

  const value = useMemo<AgentContextValue>(
    () => ({
      agent,
      open,
      setOpen,
      detachable,
      detached,
      setDetached,
      title,
      icon,
      appearance,
      starterPrompts,
      selectionSide,
      askAboutSelection,
      addSelectionContext,
    }),
    [
      agent,
      open,
      setOpen,
      detachable,
      detached,
      setDetached,
      title,
      icon,
      appearance,
      starterPrompts,
      selectionSide,
      askAboutSelection,
      addSelectionContext,
    ],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
