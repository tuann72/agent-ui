"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { getToolName, isToolUIPart, type ToolUIPart } from "ai";
import { motionDisabled } from "../core/motion";
import type { AgentPointerDragProps } from "../core/use-resize-drag";
import {
  isAgentToolName,
  type AgentReplayAction,
  type AgentReplayResult,
  type AgentToolName,
} from "../core/use-agent-chat";
import type {
  AgentAppearance,
  AgentStarterPrompt,
  AgentToolOutput,
  AgentTools,
  AgentUIMessage,
} from "../core/types";
import {
  AgentShellProvider,
  useAgentContext,
  useAgentDragHandle,
  useCloseAgent,
} from "./agent-provider";
import {
  AttachIcon,
  CheckIcon,
  CloseIcon,
  DetachIcon,
  RefreshIcon,
  SendIcon,
  StopIcon,
} from "./icons";
import { MarkdownContent } from "./markdown";

type AgentToolPart = ToolUIPart<AgentTools>;
type AgentMessagePart = AgentUIMessage["parts"][number];

interface GroupedMessagePart {
  kind: "part";
  part: AgentMessagePart;
  index: number;
}

interface GroupedToolRun {
  kind: "tools";
  parts: AgentToolPart[];
}

type GroupedMessageItem = GroupedMessagePart | GroupedToolRun;

/**
 * Preserve transcript order, with every tool call in the message collected into
 * a single run.
 *
 * One response gets one Actions section. Grouping only contiguous parts split it
 * on boundaries the reader never sees — the SDK emits a `step-start` part
 * between steps, so a turn that navigates and then highlights arrived as two
 * runs describing one piece of work. The run takes the place of the first tool
 * call, which is where the reader already expects it.
 */
export function groupAgentMessageParts(
  parts: AgentUIMessage["parts"],
): GroupedMessageItem[] {
  const grouped: GroupedMessageItem[] = [];
  const toolParts: AgentToolPart[] = [];

  parts.forEach((part, index) => {
    if (isToolUIPart<AgentTools>(part)) {
      // The first tool call reserves the slot; later ones join that same array
      // in place rather than opening a second section.
      if (toolParts.length === 0) grouped.push({ kind: "tools", parts: toolParts });
      toolParts.push(part);
      return;
    }
    grouped.push({ kind: "part", part, index });
  });
  return grouped;
}

/** The surface-finish class every shell places on its panel(s). */
export function surfaceClass(appearance: AgentAppearance = "default"): string {
  return appearance === "glass" ? "agent-glass" : "agent-solid";
}

/**
 * Resolve the dock/sidebar `header` prop: `undefined`/`true` render the
 * standard PanelHeader, `false`/`null` render nothing, anything else is the
 * consumer's own header node.
 */
export function resolveHeader(
  header: ReactNode,
  standard: ReactNode,
): ReactNode {
  if (header === undefined || header === true) return standard;
  return header;
}

const THINKING_WORDS = [
  "Pondering",
  "Tinkering",
  "Connecting dots",
  "Rummaging",
  "Cooking up an answer",
] as const;

function ThinkingIndicator() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    if (motionDisabled()) return;
    const timer = window.setInterval(() => {
      setWordIndex((current) => (current + 1) % THINKING_WORDS.length);
    }, 1_600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="agent-typing" role="status" aria-label="Agent is thinking">
      <span className="agent-typing-label" aria-hidden="true">
        {THINKING_WORDS[wordIndex]}
      </span>
      <span className="agent-typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

/** Natural-language phrasing for each tool, keyed by lifecycle moment. */
function toolPhrases(name: AgentToolName, input: unknown) {
  if (name === "navigate") {
    const route = (input as { route?: string } | undefined)?.route ?? "…";
    return {
      question: `Agent wants to navigate to ${route}`,
      progress: `Navigating to ${route}`,
      approved: `You approved navigation to ${route}`,
      done: `Navigated to ${route}`,
      denied: `You denied navigation to ${route}`,
      failed: `Couldn't navigate to ${route}`,
      replay: `Replay navigating to ${route}`,
    };
  }
  const target = (input as { target?: string } | undefined)?.target ?? "…";
  const verb = name === "interact" ? "click" : "highlight";
  const capitalized = verb.charAt(0).toUpperCase() + verb.slice(1);
  return {
    question: `Agent wants to ${verb} ${target}`,
    progress: `${capitalized}ing ${target}`,
    approved: `You approved ${verb}ing ${target}`,
    done: `${capitalized}ed ${target}`,
    denied: `You denied ${verb}ing ${target}`,
    failed: `Couldn't ${verb} ${target}`,
    replay: `Replay ${verb}ing ${target}`,
  };
}

/**
 * Why an action failed, in the transcript. The one reason worth expanding is a
 * target that lives on another page: naming that route explains both the
 * failure and what Agent should do next.
 */
function failureDetail(output: AgentToolOutput): string {
  if (output.reason === "target-on-another-route" && output.expectedRoute) {
    return `it is on ${output.expectedRoute}, not this page`;
  }
  return output.reason ?? "failed";
}

function ToolPartView({ part }: { part: AgentToolPart }) {
  const { agent } = useAgentContext();
  const toolName = getToolName(part);
  // A tool this build doesn't know renders as an inert row: no approval card,
  // no policy lookup, nothing executable.
  if (!isAgentToolName(toolName)) {
    return (
      <div className="agent-tool-row agent-muted">{String(toolName)} (unsupported)</div>
    );
  }
  const phrases = toolPhrases(toolName, part.input);

  if (part.state === "input-streaming") {
    return <div className="agent-tool-row agent-muted">{phrases.progress}…</div>;
  }

  if (part.state === "input-available") {
    if (agent.policies[toolName] === "confirm") {
      return (
        <div className="agent-tool-card">
          <p className="agent-tool-question">{phrases.question}</p>
          <div className="agent-tool-actions">
            <button
              type="button"
              className="agent-btn-primary"
              onClick={() =>
                agent.respondToToolCall({
                  toolName,
                  toolCallId: part.toolCallId,
                  input: part.input,
                  approved: true,
                })
              }
            >
              Allow
            </button>
            <button
              type="button"
              className="agent-btn-ghost"
              onClick={() =>
                agent.respondToToolCall({
                  toolName,
                  toolCallId: part.toolCallId,
                  input: part.input,
                  approved: false,
                })
              }
            >
              Deny
            </button>
          </div>
        </div>
      );
    }
    return <div className="agent-tool-row agent-muted">{phrases.progress}…</div>;
  }

  if (part.state === "output-available") {
    const output = part.output as AgentToolOutput;
    if (output.ok) {
      return (
        <div className="agent-tool-row">
          <CheckIcon /> {output.approvedByUser ? phrases.approved : phrases.done}
        </div>
      );
    }
    return (
      <div className="agent-tool-row">
        <CloseIcon size={12} />{" "}
        {output.reason === "denied-by-user"
          ? phrases.denied
          : `${phrases.failed} — ${failureDetail(output)}`}
      </div>
    );
  }

  return (
    <div className="agent-tool-row">
      <CloseIcon size={12} /> {phrases.failed} — {part.errorText}
    </div>
  );
}

function replayableAction(part: AgentToolPart): AgentReplayAction | null {
  const toolName = getToolName(part);
  if (
    !isAgentToolName(toolName) ||
    part.state !== "output-available" ||
    !(part.output as AgentToolOutput).ok
  ) {
    return null;
  }
  return { toolName, input: part.input };
}

function replayResultText(result: AgentReplayResult): string {
  if (result.skipped) {
    return result.output.reason === "replay-limit-reached"
      ? "Skipped: replay limit reached"
      : "Skipped after an earlier action failed";
  }
  const phrases = toolPhrases(result.action.toolName, result.action.input);
  if (result.output.ok) return `Replayed: ${phrases.done}`;
  return `Replay stopped: ${phrases.failed} — ${failureDetail(result.output)}`;
}

/** A replayable action paired with the tool call whose row owns its result. */
interface ReplayRow {
  id: string;
  action: AgentReplayAction;
}

/** Identifies the whole-group replay, which no `toolCallId` can collide with. */
const REPLAY_ALL = "\0all";

function AgentActionGroup({ parts }: { parts: AgentToolPart[] }) {
  const { agent } = useAgentContext();
  // Which replay is in flight, by row id — one at a time, since replays share
  // the page and a per-row spinner has to name the row it belongs to.
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, AgentReplayResult>>({});
  const terminal = parts.every(
    (part) =>
      part.state !== "input-streaming" && part.state !== "input-available",
  );
  const rows: ReplayRow[] = parts.flatMap((part) => {
    const action = replayableAction(part);
    return action === null ? [] : [{ id: part.toolCallId, action }];
  });
  const actionsById = new Map(rows.map((row) => [row.id, row.action]));

  // One path for both buttons: a single row is just a batch of one, so the
  // ordering, capping, and skip-after-failure rules stay in `replayActions`.
  const replay = async (token: string, batch: readonly ReplayRow[]) => {
    if (running !== null || batch.length === 0) return;
    setRunning(token);
    setResults({});
    try {
      const outcome = await agent.replayActions(batch.map((row) => row.action));
      setResults(
        Object.fromEntries(
          outcome.map((result, index) => [
            batch[index]?.id ?? `${token}:${index}`,
            result,
          ]),
        ),
      );
    } finally {
      setRunning(null);
    }
  };

  return (
    <section className="agent-action-group" aria-label="Agent actions">
      <div className="agent-action-group-heading">Actions</div>
      <div className="agent-action-group-list">
        {parts.map((part) => {
          const action = actionsById.get(part.toolCallId);
          const result = results[part.toolCallId];
          return (
            <div className="agent-action-item" key={part.toolCallId}>
              <div className="agent-action-item-row">
                <ToolPartView part={part} />
                {terminal && action && (
                  <button
                    type="button"
                    className="agent-action-replay"
                    aria-label={toolPhrases(action.toolName, action.input).replay}
                    disabled={running !== null}
                    onClick={() =>
                      void replay(part.toolCallId, [
                        { id: part.toolCallId, action },
                      ])
                    }
                  >
                    <RefreshIcon size={12} />
                  </button>
                )}
              </div>
              {result && (
                <div className="agent-tool-row agent-replay-result">
                  {result.output.ok ? <CheckIcon /> : <CloseIcon size={12} />}
                  {replayResultText(result)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {terminal && rows.length > 0 && (
        <div className="agent-action-group-footer">
          <button
            type="button"
            className="agent-btn-ghost agent-replay-button"
            disabled={running !== null}
            onClick={() => void replay(REPLAY_ALL, rows)}
          >
            <RefreshIcon size={12} />
            {running === REPLAY_ALL ? "Replaying…" : "Replay all actions"}
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- composable parts (context-driven) ----------
// These read the shared state from `useAgentContext`, so a consumer can drop
// them anywhere inside a shell and rearrange them without prop drilling. The
// dock/sidebar default header is just the standard arrangement of them.

/**
 * The suggested-task buttons shown before a conversation starts.
 *
 * A starter is presentation over `agent.sendText`: clicking one sends an
 * ordinary user turn, so it grants no capability a typed message would not.
 * `AgentMessages` and the spotlight render this for you; it is exported so a
 * custom layout can place the suggestions somewhere else (under the header, in
 * an empty-state illustration) or feed it a different list than the provider's
 * — `DEFAULT_STARTER_PROMPTS` is the site-agnostic set to start from.
 *
 * Renders nothing when there are no prompts, so it is always safe to mount.
 */
export function AgentStarterPrompts({
  prompts,
  className = "",
}: {
  prompts?: readonly AgentStarterPrompt[];
  className?: string;
}) {
  const { agent, starterPrompts } = useAgentContext();
  const items = prompts ?? starterPrompts;
  if (items.length === 0) return null;
  return (
    <div
      className={`agent-starter-prompts ${className}`}
      aria-label="Suggested tasks"
    >
      {items.map(({ label, prompt }) => (
        <button
          key={`${label}:${prompt}`}
          type="button"
          className="agent-btn-ghost"
          onClick={() => agent.sendText(prompt)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * The scrolling conversation. Defaults to the full history from context; pass
 * `messages` to render a filtered view (the spotlight shows only the latest
 * exchange), and `emptyState` for your own before-first-message copy.
 */
export function AgentMessages({
  messages: messagesProp,
  className = "",
  emptyState,
}: {
  messages?: AgentUIMessage[];
  className?: string;
  emptyState?: ReactNode;
}) {
  const { agent } = useAgentContext();
  const messages = messagesProp ?? agent.messages;
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages.at(-1);
  const assistantHasVisibleOutput =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some(
      (part) =>
        (part.type === "text" && part.text.trim().length > 0) ||
        isToolUIPart<AgentTools>(part),
    );
  const showThinking =
    agent.status === "submitted" ||
    (agent.status === "streaming" && !assistantHasVisibleOutput);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className={`agent-message-list ${className}`}
      aria-live="polite"
    >
      {messages.length === 0 && (
        <div className="agent-empty-hint">
          {emptyState ?? (
            <p className="agent-muted">
              Ask about this site, highlight something on the page, or navigate
              to another section.
            </p>
          )}
          <AgentStarterPrompts />
        </div>
      )}
      {messages.map((message) => (
        <div
          key={message.id}
          className={
            message.role === "user" ? "agent-msg-user" : "agent-msg-assistant"
          }
        >
          {groupAgentMessageParts(message.parts).map((item) => {
            if (item.kind === "tools") {
              return (
                <AgentActionGroup
                  key={`tools:${item.parts[0]?.toolCallId ?? "empty"}`}
                  parts={item.parts}
                />
              );
            }
            const { part, index } = item;
            if (part.type === "text") {
              return (
                <MarkdownContent key={index}>{part.text}</MarkdownContent>
              );
            }
            return null;
          })}
        </div>
      ))}
      {showThinking && <ThinkingIndicator />}
      {agent.error && (
        <div className="agent-error" role="alert">
          <p>Something went wrong: {agent.error.message}</p>
          <button type="button" className="agent-btn-ghost" onClick={agent.clearError}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

/** The message composer, bound to the shared chat state. */
export function AgentInput({
  placeholder = "Ask Agent…",
  autoFocus = false,
  className = "",
}: {
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const { agent } = useAgentContext();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = agent.status === "submitted" || agent.status === "streaming";

  useEffect(() => {
    if (agent.pendingQuotes.length > 0) inputRef.current?.focus();
  }, [agent.pendingQuotes.length]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    agent.sendText(value);
    setValue("");
  };

  return (
    <form className={`agent-input-area ${className}`} onSubmit={onSubmit}>
      {agent.pendingQuotes.length > 0 && (
        <div
          className="agent-quote-list"
          role="list"
          aria-label="Selected text to ask about"
        >
          {agent.pendingQuotes.map((quote, index) => (
            <div
              className="agent-quote-chip"
              role="listitem"
              key={quote}
              title={quote}
            >
              <span className="agent-quote-chip-text">{quote}</span>
              <button
                type="button"
                className="agent-icon-btn agent-quote-chip-dismiss"
                aria-label={`Remove selected text ${index + 1}`}
                onClick={() => agent.removeQuote(index)}
              >
                <CloseIcon size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="agent-input-row">
        <div className="agent-input-shell">
          <input
            ref={inputRef}
            className="agent-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              agent.pendingQuotes.length > 0
                ? "Ask about the selected text…"
                : placeholder
            }
            aria-label="Message Agent"
            autoFocus={autoFocus}
          />
          {busy ? (
            <button
              type="button"
              className="agent-send-btn"
              aria-label="Stop generating"
              title="Stop"
              onClick={agent.stop}
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="submit"
              className="agent-send-btn"
              aria-label="Send message"
              title="Send"
              disabled={value.trim().length === 0}
            >
              <SendIcon />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

/**
 * Switch that lets the user skip approval cards for Agent's page actions.
 * Children replace the default check-mark glyph (the spotlight passes a text
 * label); the switch track always renders after them.
 */
export function AutoApproveButton({ children }: { children?: ReactNode }) {
  const { agent } = useAgentContext();
  return (
    <button
      type="button"
      role="switch"
      className="agent-switch"
      aria-checked={agent.autoApprove}
      aria-label="Automatically approve Agent's page actions"
      title={
        agent.autoApprove
          ? "Auto-approve is on — Agent navigates, highlights, and clicks without asking"
          : "Auto-approve navigation, highlights, and clicks"
      }
      onClick={() => agent.setAutoApprove(!agent.autoApprove)}
    >
      {children ?? <CheckIcon size={12} />}
      <span className="agent-switch-track" aria-hidden="true">
        <span className="agent-switch-thumb" />
      </span>
    </button>
  );
}

/** Brand mark + title, from context. */
export function AgentTitle() {
  const { title, icon } = useAgentContext();
  return (
    <span className="agent-panel-title">
      {icon} {title}
    </span>
  );
}

/** Right-aligned action group inside the header (holds the action buttons). */
export function AgentActions({ children }: { children?: ReactNode }) {
  return <div className="agent-panel-actions">{children}</div>;
}

/** Start-a-fresh-conversation button. */
export function NewChatButton() {
  const { agent } = useAgentContext();
  return (
    <button
      type="button"
      className="agent-icon-btn"
      aria-label="Start new chat"
      title="Start new chat"
      onClick={agent.reset}
    >
      <RefreshIcon />
    </button>
  );
}

/**
 * Pull the panel out into a floating window, or put it back on its edge.
 * Renders nothing unless the shell was given `detachable`, so it is safe to
 * leave in a custom header arrangement.
 */
export function DetachButton() {
  const { detachable, detached, setDetached } = useAgentContext();
  if (!detachable) return null;
  const label = detached ? "Attach chat panel" : "Detach chat panel";
  return (
    <button
      type="button"
      className="agent-icon-btn"
      aria-pressed={detached}
      aria-label={label}
      title={label}
      onClick={() => setDetached(!detached)}
    >
      {detached ? <AttachIcon /> : <DetachIcon />}
    </button>
  );
}

/** Close button; plays the shell's exit animation via the shell context. */
export function CloseButton() {
  const close = useCloseAgent();
  return (
    <button
      type="button"
      className="agent-icon-btn"
      aria-label="Close chat"
      title="Close chat"
      onClick={close}
    >
      <CloseIcon />
    </button>
  );
}

/**
 * The dock/sidebar title bar. With no children it renders the standard
 * arrangement (brand, auto-approve, detach, new chat, close); pass children to
 * compose your own — group action buttons in a `<AgentActions>` for the
 * right-aligned layout.
 *
 * While the shell's panel is detached, this is also the window's drag handle.
 * The handlers ignore presses that land on a control, so the header's own
 * buttons keep working: pointer capture would otherwise retarget the release and
 * swallow their clicks.
 */
export function AgentHeader({ children }: { children?: ReactNode }) {
  const drag = useAgentDragHandle();
  const dragProps = drag
    ? {
        ...drag,
        onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
          if ((event.target as Element).closest("button, input, a")) return;
          drag.onPointerDown(event);
        },
      }
    : {};
  return (
    <header
      className="agent-panel-header"
      data-agent-drag={drag ? "" : undefined}
      {...dragProps}
    >
      {children ?? (
        <>
          <AgentTitle />
          <AgentActions>
            <AutoApproveButton />
            <DetachButton />
            <NewChatButton />
            <CloseButton />
          </AgentActions>
        </>
      )}
    </header>
  );
}

/** Standard stacked body (messages + input) for the dock and sidebar shells. */
export function AgentBody({ autoFocus = true }: { autoFocus?: boolean }) {
  return (
    <div className="agent-panel-body">
      <AgentMessages />
      <AgentInput autoFocus={autoFocus} />
    </div>
  );
}

/**
 * Default dock/sidebar panel contents: the shell's motion-aware `close` in
 * context, then either the consumer's own `children` or the standard header +
 * body. Both stacking shells render through this so they differ only in their
 * frame (resize edges, launcher), never in body composition.
 */
export function AgentPanelContents({
  close,
  dragHandleProps,
  header,
  children,
}: {
  close: () => void;
  /** Set by the shell only while detached; see `AgentShellProvider`. */
  dragHandleProps?: AgentPointerDragProps | null;
  header?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <AgentShellProvider close={close} dragHandleProps={dragHandleProps}>
      {children ?? (
        <>
          {resolveHeader(header, <AgentHeader />)}
          <AgentBody />
        </>
      )}
    </AgentShellProvider>
  );
}

/**
 * Collapsed-state launcher shared by the dock and sidebar. Owns the open
 * wiring and the accessibility contract (dialog popup, collapsed state); the
 * shells contribute only their frame class, `data-agent-ui` id, and label.
 */
export function LauncherButton({
  launcherRef,
  ui,
  className,
  onBeforeOpen,
  children,
}: {
  launcherRef: RefObject<HTMLButtonElement | null>;
  ui: string;
  className: string;
  onBeforeOpen?: (button: HTMLButtonElement) => void;
  children: ReactNode;
}) {
  const { setOpen } = useAgentContext();
  return (
    <button
      ref={launcherRef}
      type="button"
      data-agent-ui={ui}
      className={className}
      aria-expanded="false"
      aria-haspopup="dialog"
      onClick={(event) => {
        onBeforeOpen?.(event.currentTarget);
        setOpen(true);
      }}
    >
      {children}
    </button>
  );
}
