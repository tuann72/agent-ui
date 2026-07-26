"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat, type UseChatHelpers } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { runHighlight } from "./highlight";
import { runInteract } from "./interact";
import {
  appendSelection,
  buildQuotedMessage,
  MAX_SELECTION_ITEMS,
} from "./selection";
import {
  resolveToolPolicies,
  validateInteraction,
  validateRoute,
  validateTarget,
} from "./tool-policy";
import type {
  AgentPublicManifest,
  AgentHighlightOptions,
  AgentToolOutput,
  AgentToolPolicies,
  AgentUIMessage,
  ToolPolicy,
} from "./types";

export type AgentToolName = "navigate" | "highlight" | "interact";

export interface AgentReplayAction {
  toolName: AgentToolName;
  input: unknown;
}

export interface AgentReplayResult {
  action: AgentReplayAction;
  output: AgentToolOutput;
  /** Later actions are recorded as skipped after the first replay failure. */
  skipped?: boolean;
}

/** Runtime guard for model-supplied tool names — never trust the wire. */
export function isAgentToolName(name: unknown): name is AgentToolName {
  return name === "navigate" || name === "highlight" || name === "interact";
}

function stringField(input: unknown, key: string): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function clampLimit(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(Math.floor(value), minimum), maximum);
}

/** Auto-approve skips the approval card only; `disabled` stays disabled. */
function skipConfirm(policy: ToolPolicy): ToolPolicy {
  return policy === "confirm" ? "auto" : policy;
}

export interface UseAgentChatOptions {
  api: string;
  currentRoute: string;
  navigate: (route: string) => void;
  manifest: AgentPublicManifest;
  toolPolicy?: Partial<AgentToolPolicies>;
  /** Consumer-owned styling and timing for highlights and click flashes. */
  highlightOptions?: AgentHighlightOptions;
  /** Hard cap on navigations per assistant turn to prevent loops. */
  maxNavigationsPerTurn?: number;
  /** Hard cap on element clicks per assistant turn to prevent loops. */
  maxInteractionsPerTurn?: number;
  /** Maximum selected-text pills attached to the next message. Default 8. */
  maxPendingSelections?: number;
}

export interface UseAgentChatReturn {
  messages: AgentUIMessage[];
  status: UseChatHelpers<AgentUIMessage>["status"];
  error: Error | undefined;
  policies: AgentToolPolicies;
  sendText: (text: string) => void;
  stop: () => void;
  clearError: () => void;
  /** Selected page-text items attached to the next message. */
  pendingQuotes: readonly string[];
  attachQuote: (rawSelection: string) => void;
  removeQuote: (index: number) => void;
  clearQuotes: () => void;
  /** Start a fresh conversation: aborts streaming, clears messages/quote/error. */
  reset: () => void;
  /** When true, `confirm`-policy tools run without the approval card. */
  autoApprove: boolean;
  setAutoApprove: (autoApprove: boolean) => void;
  /** Resolve a pending `confirm`-policy tool call from the approval UI. */
  respondToToolCall: (options: {
    toolName: AgentToolName;
    toolCallId: string;
    input: unknown;
    approved: boolean;
  }) => void;
  /**
   * Re-run successful historical client actions without another model turn.
   * Current policy, manifests, runtime checks, and fresh capped counters apply.
   */
  replayActions: (
    actions: readonly AgentReplayAction[],
  ) => Promise<readonly AgentReplayResult[]>;
}

interface ExecutionCounters {
  navigations: number;
  interactions: number;
}

const ROUTE_SETTLE_TIMEOUT_MS = 1_500;
const MAX_REPLAY_ACTIONS = 8;

/**
 * Headless core shared by every Agent variant. Owns transport, streaming
 * state, and — deliberately — all tool-policy enforcement, so replacing or
 * restyling a variant shell cannot weaken navigation/highlight rules.
 */
export function useAgentChat(options: UseAgentChatOptions): UseAgentChatReturn {
  const { api, manifest } = options;
  const configuredPolicies = resolveToolPolicies(options.toolPolicy);
  // The user-facing "auto-approve" toggle. It only skips the approval card:
  // `confirm` becomes `auto`, while `disabled` stays disabled — the toggle can
  // never grant a capability the consumer turned off.
  const [autoApprove, setAutoApprove] = useState(false);
  const policies = useMemo<AgentToolPolicies>(() => {
    if (!autoApprove) return configuredPolicies;
    return {
      navigate: skipConfirm(configuredPolicies.navigate),
      highlight: skipConfirm(configuredPolicies.highlight),
      interact: skipConfirm(configuredPolicies.interact),
    };
  }, [
    autoApprove,
    configuredPolicies.navigate,
    configuredPolicies.highlight,
    configuredPolicies.interact,
  ]);
  // Security caps, not preferences: consumer configuration can lower these
  // but never raise them past the documented ceilings.
  const maxNavigations = clampLimit(options.maxNavigationsPerTurn ?? 2, 0, 10);
  const maxInteractions = clampLimit(options.maxInteractionsPerTurn ?? 3, 0, 10);
  const maxPendingSelections = clampLimit(
    options.maxPendingSelections ?? MAX_SELECTION_ITEMS,
    1,
    MAX_SELECTION_ITEMS,
  );

  const routeRef = useRef(options.currentRoute);
  routeRef.current = options.currentRoute;
  const navigateRef = useRef(options.navigate);
  navigateRef.current = options.navigate;
  // Consumers often pass an inline object; the ref keeps executeTool's (and
  // so respondToToolCall's) identity stable across renders.
  const highlightOptionsRef = useRef(options.highlightOptions);
  highlightOptionsRef.current = options.highlightOptions;
  const policiesRef = useRef(policies);
  policiesRef.current = policies;
  const turnCountersRef = useRef<ExecutionCounters>({
    navigations: 0,
    interactions: 0,
  });
  const replayRunningRef = useRef(false);
  const replayGenerationRef = useRef(0);
  const helpersRef = useRef<UseChatHelpers<AgentUIMessage> | null>(null);
  useEffect(
    () => () => {
      replayGenerationRef.current += 1;
    },
    [],
  );

  const executeToolWithCounters = useCallback(
    (
      toolName: AgentToolName,
      input: unknown,
      counters: ExecutionCounters,
    ): AgentToolOutput => {
      if (toolName === "navigate") {
        const route = stringField(input, "route");
        if (route === undefined) return { ok: false, reason: "invalid-route" };
        const check = validateRoute(manifest, route);
        if (!check.ok) return check;
        if (counters.navigations >= maxNavigations) {
          return { ok: false, reason: "navigation-limit-reached" };
        }
        counters.navigations += 1;
        navigateRef.current(route);
        return { ok: true };
      }
      const target = stringField(input, "target");
      if (target === undefined) return { ok: false, reason: "invalid-target" };
      if (toolName === "interact") {
        const check = validateInteraction(manifest, routeRef.current, target);
        if (!check.ok) return check;
        if (counters.interactions >= maxInteractions) {
          return { ok: false, reason: "interaction-limit-reached" };
        }
        counters.interactions += 1;
        return runInteract(target, highlightOptionsRef.current);
      }
      const check = validateTarget(manifest, routeRef.current, target);
      if (!check.ok) return check;
      return runHighlight(target, highlightOptionsRef.current);
    },
    [manifest, maxNavigations, maxInteractions],
  );
  const executeTool = useCallback(
    (toolName: AgentToolName, input: unknown) =>
      executeToolWithCounters(toolName, input, turnCountersRef.current),
    [executeToolWithCounters],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AgentUIMessage>({
        api,
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { id, messages, currentRoute: routeRef.current },
        }),
      }),
    [api],
  );

  const chat = useChat<AgentUIMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      const { toolName } = toolCall;
      const helpers = helpersRef.current;
      if (!helpers) return;
      if (!isAgentToolName(toolName)) {
        void helpers.addToolOutput({
          state: "output-error",
          tool: toolName,
          toolCallId: toolCall.toolCallId,
          errorText: "unknown-tool",
        });
        return;
      }
      const policy = policiesRef.current[toolName];
      // `confirm` waits for the approval UI; everything else resolves now.
      if (policy === "confirm") return;
      const output: AgentToolOutput =
        policy === "disabled"
          ? { ok: false, reason: "disabled-by-policy" }
          : executeTool(toolName, toolCall.input);
      void helpers.addToolOutput({
        tool: toolName,
        toolCallId: toolCall.toolCallId,
        output,
      });
    },
  });
  helpersRef.current = chat;

  const [pendingQuotes, setPendingQuotes] = useState<readonly string[]>([]);
  // Read through a ref so sendText keeps one identity across quote changes.
  const quotesRef = useRef(pendingQuotes);
  quotesRef.current = pendingQuotes;

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      turnCountersRef.current = { navigations: 0, interactions: 0 };
      const quotes = quotesRef.current;
      const message =
        quotes.length > 0 ? buildQuotedMessage(quotes, trimmed) : trimmed;
      setPendingQuotes([]);
      void chat.sendMessage({ text: message });
    },
    [chat.sendMessage],
  );

  const attachQuote = useCallback((rawSelection: string) => {
    setPendingQuotes((current) =>
      appendSelection(current, rawSelection, maxPendingSelections),
    );
  }, [maxPendingSelections]);

  const reset = useCallback(() => {
    replayGenerationRef.current += 1;
    void chat.stop();
    chat.setMessages([]);
    chat.clearError();
    setPendingQuotes([]);
    turnCountersRef.current = { navigations: 0, interactions: 0 };
  }, [chat.stop, chat.setMessages, chat.clearError]);

  const respondToToolCall = useCallback<UseAgentChatReturn["respondToToolCall"]>(
    ({ toolName, toolCallId, input, approved }) => {
      const output: AgentToolOutput = approved
        ? { ...executeTool(toolName, input), approvedByUser: true }
        : { ok: false, reason: "denied-by-user" };
      void chat.addToolOutput({ tool: toolName, toolCallId, output });
    },
    [chat.addToolOutput, executeTool],
  );

  const stop = useCallback(() => void chat.stop(), [chat.stop]);

  const removeQuote = useCallback(
    (index: number) =>
      setPendingQuotes((current) =>
        current.filter((_, currentIndex) => currentIndex !== index),
      ),
    [],
  );

  const clearQuotes = useCallback(() => setPendingQuotes([]), []);

  const waitForRoute = useCallback(
    (route: string, generation: number): Promise<boolean> =>
      new Promise((resolve) => {
        const started = performance.now();
        let frame = 0;
        let settled = false;
        let matched = false;
        const timeout = window.setTimeout(
          () => finish(false),
          ROUTE_SETTLE_TIMEOUT_MS,
        );
        const finish = (result: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          if (frame !== 0) window.cancelAnimationFrame(frame);
          resolve(result);
        };
        const check = () => {
          frame = 0;
          if (replayGenerationRef.current !== generation) {
            finish(false);
            return;
          }
          if (routeRef.current === route) {
            // Allow one committed paint after the route prop catches up before
            // a dependent target lookup touches the new page DOM.
            if (matched) {
              finish(true);
              return;
            }
            matched = true;
          }
          if (performance.now() - started >= ROUTE_SETTLE_TIMEOUT_MS) {
            finish(false);
            return;
          }
          frame = window.requestAnimationFrame(check);
        };
        frame = window.requestAnimationFrame(check);
      }),
    [],
  );

  const replayActions = useCallback<UseAgentChatReturn["replayActions"]>(
    async (actions) => {
      if (actions.length === 0) return [];
      const queued = actions.slice(0, MAX_REPLAY_ACTIONS);
      const overflow = actions.slice(MAX_REPLAY_ACTIONS);
      if (replayRunningRef.current) {
        return [
          {
            action: queued[0]!,
            output: { ok: false, reason: "replay-in-progress" },
          },
          ...queued.slice(1).map((action) => ({
            action,
            output: { ok: false, reason: "skipped-after-failure" },
            skipped: true,
          })),
          ...overflow.map((action) => ({
            action,
            output: { ok: false, reason: "replay-limit-reached" },
            skipped: true,
          })),
        ];
      }

      replayRunningRef.current = true;
      const generation = replayGenerationRef.current;
      const counters: ExecutionCounters = {
        navigations: 0,
        interactions: 0,
      };
      const results: AgentReplayResult[] = [];
      let failed = false;

      try {
        for (const [index, action] of queued.entries()) {
          if (failed) {
            results.push({
              action,
              output: { ok: false, reason: "skipped-after-failure" },
              skipped: true,
            });
            continue;
          }
          if (replayGenerationRef.current !== generation) {
            results.push({
              action,
              output: { ok: false, reason: "replay-cancelled" },
            });
            failed = true;
            continue;
          }
          if (!isAgentToolName(action.toolName)) {
            results.push({
              action,
              output: { ok: false, reason: "unknown-tool" },
            });
            failed = true;
            continue;
          }
          if (policiesRef.current[action.toolName] === "disabled") {
            results.push({
              action,
              output: { ok: false, reason: "disabled-by-policy" },
            });
            failed = true;
            continue;
          }

          let output: AgentToolOutput;
          try {
            output = executeToolWithCounters(
              action.toolName,
              action.input,
              counters,
            );
          } catch {
            output = { ok: false, reason: "execution-failed" };
          }
          results.push({ action, output });
          if (!output.ok) {
            failed = true;
            continue;
          }

          const next = queued[index + 1];
          if (action.toolName === "navigate" && next !== undefined) {
            const route = stringField(action.input, "route");
            if (
              route === undefined ||
              !(await waitForRoute(route, generation))
            ) {
              results[results.length - 1] = {
                action,
                output: { ok: false, reason: "route-transition-failed" },
              };
              failed = true;
            }
          }
        }
        results.push(
          ...overflow.map((action) => ({
            action,
            output: { ok: false, reason: "replay-limit-reached" },
            skipped: true,
          })),
        );
        return results;
      } finally {
        replayRunningRef.current = false;
      }
    },
    [executeToolWithCounters, waitForRoute],
  );

  // One memoized wrapper so the individually stable callbacks above actually
  // pay off: AgentProvider keys its context value on this object's identity.
  return useMemo(
    () => ({
      messages: chat.messages,
      status: chat.status,
      error: chat.error,
      policies,
      sendText,
      stop,
      clearError: chat.clearError,
      pendingQuotes,
      attachQuote,
      removeQuote,
      clearQuotes,
      reset,
      autoApprove,
      setAutoApprove,
      respondToToolCall,
      replayActions,
    }),
    [
      chat.messages,
      chat.status,
      chat.error,
      chat.clearError,
      policies,
      sendText,
      stop,
      pendingQuotes,
      attachQuote,
      removeQuote,
      clearQuotes,
      reset,
      autoApprove,
      respondToToolCall,
      replayActions,
    ],
  );
}
