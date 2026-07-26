"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
}
const AgentShellContext = createContext<AgentShellContextValue | null>(null);

/** Each shell wraps its panel contents in this so `<CloseButton>` can animate. */
export function AgentShellProvider({
  close,
  children,
}: {
  close: () => void;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ close }), [close]);
  return (
    <AgentShellContext.Provider value={value}>
      {children}
    </AgentShellContext.Provider>
  );
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
  children: ReactNode;
}

// Module constants, not inline defaults: default parameter values are
// re-created every render and would invalidate the context memo below.
const DEFAULT_ICON = <AgentIcon />;
const NO_STARTER_PROMPTS: readonly AgentStarterPrompt[] = [];

export function AgentProvider({
  title = "Agent",
  icon = DEFAULT_ICON,
  appearance = "default",
  starterPrompts = NO_STARTER_PROMPTS,
  selectionSide = "top",
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
  ...chatOptions
}: AgentProviderProps) {
  const agent = useAgentChat(chatOptions);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
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
