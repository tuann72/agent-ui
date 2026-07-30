import type { AgentStarterPrompt } from "./types";

/**
 * Starter-prompt defaults, as module constants.
 *
 * Both are frozen module-level arrays rather than inline defaults: the provider
 * memoizes its context value by identity, so a fresh `[]` each render would
 * re-render every part of the chat (see the identity discipline note in
 * AGENTS.md).
 */

/** The provider's default: no suggestions until a consumer supplies some. */
export const NO_STARTER_PROMPTS: readonly AgentStarterPrompt[] = [];

/**
 * Site-agnostic examples for a fresh install, so `starterPrompts` can be
 * demonstrated before anyone has written copy for it. Deliberately generic:
 * these ship in the published package, so they must make sense on a bakery, a
 * bank, and a docs site alike. Replace them with tasks specific to the page —
 * a suggestion that names something real ("Compare the two plans") is worth
 * several that do not.
 */
export const DEFAULT_STARTER_PROMPTS: readonly AgentStarterPrompt[] = [
  { label: "What's on this page?", prompt: "Summarize this page for me." },
  { label: "What can you do?", prompt: "What can you help me with on this site?" },
  {
    label: "Show me around",
    prompt: "Highlight the most important section of this page.",
  },
];
