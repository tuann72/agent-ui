/**
 * Contextual starter tasks, per route. Module constants rather than inline
 * arrays: the provider memo is keyed on identity, so a fresh array every render
 * would re-render every part of the chat.
 */
import type { AgentStarterPrompt } from "@agent-ui/registry";

const HOME_STARTERS: readonly AgentStarterPrompt[] = [
  { label: "What's a day pass?", prompt: "How much is a day pass?" },
  { label: "Show me the walls", prompt: "Highlight the disciplines section" },
  { label: "When are you open?", prompt: "What are your hours?" },
];

const PRICING_STARTERS: readonly AgentStarterPrompt[] = [
  {
    label: "Compare memberships",
    prompt: "What membership options do you have?",
  },
  { label: "Rental costs", prompt: "Highlight the gear rentals" },
  { label: "Sign me up", prompt: "Start a membership signup for me" },
];

const ABOUT_STARTERS: readonly AgentStarterPrompt[] = [
  {
    label: "How often do you reset?",
    prompt: "How often do you reset routes?",
  },
  { label: "Who sets here?", prompt: "Highlight the team" },
  { label: "Take me to pricing", prompt: "Take me to the pricing page" },
];

const FAQ_STARTERS: readonly AgentStarterPrompt[] = [
  {
    label: "First time here",
    prompt: "I've never climbed before — what do I need?",
  },
  { label: "Can kids climb?", prompt: "Highlight the safety answers" },
  { label: "Sign the waiver", prompt: "Sign the waiver for me" },
];

const CREDITS_STARTERS: readonly AgentStarterPrompt[] = [
  { label: "Is this gym real?", prompt: "Is this a real climbing gym?" },
  { label: "Who took the photos?", prompt: "Highlight the photo credits" },
  {
    label: "What's the license?",
    prompt: "What license are the photos under?",
  },
];

const STARTERS_BY_ROUTE: Record<string, readonly AgentStarterPrompt[]> = {
  "/": HOME_STARTERS,
  "/pricing": PRICING_STARTERS,
  "/about": ABOUT_STARTERS,
  "/faq": FAQ_STARTERS,
  "/credits": CREDITS_STARTERS,
};

export function starterPromptsFor(
  route: string,
): readonly AgentStarterPrompt[] {
  return STARTERS_BY_ROUTE[route] ?? HOME_STARTERS;
}
