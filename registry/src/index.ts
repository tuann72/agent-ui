export { AgentChat, type AgentChatProps } from "./components/agent-chat";
export {
  AgentProvider,
  useAgentContext,
  useAgentDragHandle,
  useCloseAgent,
  type AgentContextValue,
  type AgentProviderProps,
} from "./components/agent-provider";
export { AgentDock, type AgentDockProps } from "./components/dock";
export {
  AgentSidebar,
  type AgentSidebarProps,
  type SidebarLauncher,
} from "./components/sidebar";
export {
  AgentSpotlight,
  type AgentSpotlightProps,
} from "./components/spotlight";
export {
  AutoApproveButton,
  AgentActions,
  AgentBody,
  AgentHeader,
  AgentInput,
  AgentMessages,
  AgentStarterPrompts,
  AgentTitle,
  CloseButton,
  DetachButton,
  NewChatButton,
} from "./components/chat-parts";
export {
  DEFAULT_STARTER_PROMPTS,
  NO_STARTER_PROMPTS,
} from "./core/starter-prompts";
export {
  clampPosition,
  useDetachedPanel,
  type DetachedPosition,
} from "./core/use-detach";
export type { AgentPointerDragProps } from "./core/use-resize-drag";
export { AgentSelectionPopover } from "./components/selection-popover";
export {
  appendSelection,
  buildQuotedMessage,
  normalizeSelection,
  MAX_SELECTION_CHARS,
  MAX_SELECTION_ITEMS,
} from "./core/selection";
export {
  isAgentToolName,
  useAgentChat,
  type AgentReplayAction,
  type AgentReplayResult,
  type AgentToolName,
  type UseAgentChatOptions,
  type UseAgentChatReturn,
} from "./core/use-agent-chat";
/**
 * The tool contract. Exported because a consumer who replaces the bundled
 * handler has to declare the same four tools, by the same names, with the same
 * schemas, and teach the model the same ordering rules — otherwise this client
 * receives calls it will not execute. Importing beats reimplementing from the
 * README.
 *
 * The zod schemas are deliberately *not* re-exported here. This module is the
 * client entry point, so anything it exports as a value is reachable from the
 * browser bundle; server code imports them from `core/contract.schemas`
 * directly, which is the only import path that touches zod.
 */
export {
  AGENT_TOOL_NAMES,
  AGENT_TOOL_PART_TYPES,
  CLIENT_TOOL_NAMES,
  SERVER_TOOL_NAMES,
  TOOL_DESCRIPTIONS,
  TOOL_ORDERING_PROTOCOL,
  TOOL_SECURITY_RULE,
  type AgentClientToolName,
  type AgentServerToolName,
  type AgentToolPartType,
} from "./core/contract";
export { dismissHighlight, runHighlight } from "./core/highlight";
export { runInteract } from "./core/interact";
export { findTargetElement } from "./core/target";
export { shouldTriggerShortcut, type ShortcutEventLike } from "./core/shortcut";
export type { AgentSide } from "./core/resize";
export {
  DEFAULT_TOOL_POLICIES,
  resolveToolPolicies,
  validateInteraction,
  validateRoute,
  validateTarget,
} from "./core/tool-policy";
export type {
  AgentAppearance,
  AgentHighlightOptions,
  AgentPublicManifest,
  AgentRoute,
  AgentSelectionSide,
  AgentStarterPrompt,
  AgentTarget,
  AgentToolOutput,
  AgentToolPolicies,
  AgentTools,
  AgentUIMessage,
  AgentVariant,
  HighlightInput,
  InteractInput,
  NavigateInput,
  ToolPolicy,
} from "./core/types";
