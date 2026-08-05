import type { UIDataTypes, UIMessage } from "ai";

import type { AgentClientToolName, AgentToolName } from "./contract";
// Type-only, so zod never enters the client bundle. See contract.schemas.ts.
import type { ToolInput } from "./contract.schemas";

export interface AgentTarget {
  id: string;
  description: string;
  /**
   * Opt-in for the interact tool: the model may click this element. The
   * element itself must also be a natively clickable control (button-like);
   * highlightable never implies clickable.
   */
  interactive?: boolean;
}

export interface AgentRoute {
  route: string;
  title: string;
  description: string;
  targets: AgentTarget[];
}

/**
 * What the browser is allowed to know about the site: routes, titles,
 * descriptions, and target ids. Safe to ship — it carries no markdown bodies,
 * which `withContent` attaches server-side. `agent-ui init` writes a starter,
 * and it is yours to fill in and maintain from there.
 */
export interface AgentPublicManifest {
  routes: AgentRoute[];
}

/** A contextual task displayed before a conversation begins. */
export interface AgentStarterPrompt {
  label: string;
  prompt: string;
}

/**
 * Which edge of the text selection the "Ask" popover attaches to. The chosen
 * side is honored as-is — the popover is only nudged back inside the viewport,
 * never flipped to the opposite edge.
 */
export type AgentSelectionSide = "top" | "bottom" | "left" | "right";

/** Consumer-owned appearance and timing for the page highlight overlay. */
/**
 * How the highlight overlay looks. Each field writes the matching
 * `--agent-highlight-*` custom property on the overlay element, so the same
 * knobs are available globally in `styles.css` and per-call here. `className`
 * is the escape hatch for anything these fields do not cover: the overlay is a
 * plain element, and your class can restyle it however you like.
 */
export interface AgentHighlightOptions {
  durationMs?: number;
  padding?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  backgroundColor?: string;
  ringColor?: string;
  ringWidth?: number;
  borderRadius?: string;
  /** Extra box-shadow layered under the ring, e.g. a drop shadow or glow. */
  boxShadow?: string;
  /** False keeps the resting ring but stops it pulsing. */
  pulse?: boolean;
  /** Added alongside `agent-highlight-overlay`, for full CSS control. */
  className?: string;
}

export type ToolPolicy = "auto" | "confirm" | "disabled";

/**
 * One policy per client-executed tool. Server-executed tools are absent by
 * construction: they never reach the browser as an action, so there is nothing
 * for a policy to gate.
 */
export type AgentToolPolicies = Record<AgentClientToolName, ToolPolicy>;

export type {
  HighlightInput,
  InteractInput,
  NavigateInput,
  SearchContentInput,
} from "./contract.schemas";

export interface AgentToolOutput {
  ok: boolean;
  reason?: string;
  /**
   * The route a rejected target actually lives on. Set with
   * `target-on-another-route` so the model can navigate there and retry instead
   * of treating the page action as impossible.
   */
  expectedRoute?: string;
  /** True when the user clicked Allow on the approval card (vs. auto policy). */
  approvedByUser?: boolean;
}

/**
 * The tool map behind `AgentUIMessage`. Mapped over the contract rather than
 * listed, so a tool cannot exist on the wire without a typed part here.
 *
 * Only client-executed tools carry `AgentToolOutput` — that shape is what
 * `tool-policy.ts` returns. A server-executed tool's result is whatever its
 * `execute` returned, which core cannot name without importing server types and
 * inverting the dependency, so it stays `unknown`.
 */
export type AgentTools = {
  [K in AgentToolName]: {
    input: ToolInput<K>;
    output: K extends AgentClientToolName ? AgentToolOutput : unknown;
  };
};

export type AgentUIMessage = UIMessage<unknown, UIDataTypes, AgentTools>;

export type AgentVariant = "dock" | "sidebar" | "spotlight";

/** Surface finish shared by every shell: opaque (default) or backdrop-blur. */
export type AgentAppearance = "default" | "glass";
