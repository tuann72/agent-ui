"use client";

import type { ReactNode } from "react";
import type { UseAgentChatOptions } from "../core/use-agent-chat";
import type {
  AgentAppearance,
  AgentSelectionSide,
  AgentStarterPrompt,
  AgentVariant,
} from "../core/types";
import { AgentProvider } from "./agent-provider";
import { AgentDock } from "./dock";
import { AgentSidebar, type SidebarLauncher } from "./sidebar";
import { AgentSelectionPopover } from "./selection-popover";
import { AgentSpotlight } from "./spotlight";

export interface AgentChatProps extends UseAgentChatOptions {
  variant?: AgentVariant;
  /** The shell's display name: header/launcher text and aria labels. */
  title?: string;
  /** Surface finish: opaque `"default"` or backdrop-blur `"glass"`. */
  appearance?: AgentAppearance;
  /** Brand mark next to the title everywhere one is shown. Any node. */
  icon?: ReactNode;
  /** Dock/sidebar screen edge. */
  side?: "left" | "right";
  /** Sidebar launcher: a vertical edge tab, or a floating corner button. */
  launcher?: SidebarLauncher;
  /** Dock/sidebar header: `true`/omitted standard, `false` none, node custom. */
  header?: ReactNode;
  /** Dock/sidebar line between the conversation and the input. Default on. */
  inputSeparator?: boolean;
  /** Spotlight open key. */
  shortcutKey?: string;
  /** Show an "Ask Agent" popup when page text is selected. Default on. */
  selectionAsk?: boolean;
  /** Which edge of the selection that popup sits on. Default `"top"`. */
  selectionSide?: AgentSelectionSide;
  /** Contextual task suggestions shown before the first message. */
  starterPrompts?: readonly AgentStarterPrompt[];
}

/**
 * Batteries-included default composition: a `AgentProvider` plus one variant
 * shell and the selection popover. Consumers who want to rearrange the pieces
 * (custom header actions, their own layout) can drop the `variant` prop and
 * compose `<AgentProvider>` with the shell + parts directly.
 */
export function AgentChat({
  variant = "dock",
  // Cosmetic props are forwarded undefined so the provider and shells stay
  // the single source of their defaults (title, side, shortcut key, …).
  title,
  appearance,
  icon,
  side,
  launcher,
  header,
  inputSeparator,
  shortcutKey,
  selectionAsk = true,
  selectionSide,
  starterPrompts,
  ...chatOptions
}: AgentChatProps) {
  const shell =
    variant === "sidebar" ? (
      <AgentSidebar
        side={side}
        launcher={launcher}
        header={header}
        inputSeparator={inputSeparator}
      />
    ) : variant === "spotlight" ? (
      <AgentSpotlight shortcutKey={shortcutKey} />
    ) : (
      <AgentDock side={side} header={header} inputSeparator={inputSeparator} />
    );

  return (
    <AgentProvider
      {...chatOptions}
      title={title}
      icon={icon}
      appearance={appearance}
      starterPrompts={starterPrompts}
      selectionSide={selectionSide}
    >
      {selectionAsk && <AgentSelectionPopover />}
      {shell}
    </AgentProvider>
  );
}
