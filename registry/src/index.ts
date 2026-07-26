export { AgentChat, type AgentChatProps } from "./components/agent-chat";
export {
  AgentProvider,
  useAgentContext,
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
  AgentTitle,
  CloseButton,
  NewChatButton,
} from "./components/chat-parts";
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
export { dismissHighlight, runHighlight } from "./core/highlight";
export { runInteract } from "./core/interact";
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
