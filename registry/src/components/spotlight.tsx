"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../core/focus-trap";
import { shouldTriggerShortcut } from "../core/shortcut";
import { useShellLifecycle } from "../core/use-shell-lifecycle";
import type { AgentUIMessage } from "../core/types";
import { AgentShellProvider, useAgentContext } from "./agent-provider";
import { AutoApproveButton, AgentInput, AgentMessages, surfaceClass } from "./chat-parts";
import { RefreshIcon } from "./icons";

/** Last user message plus everything after it — the current exchange. */
function lastExchange(messages: AgentUIMessage[]): AgentUIMessage[] {
  const lastUserIndex = messages.findLastIndex((m) => m.role === "user");
  return lastUserIndex === -1 ? messages : messages.slice(lastUserIndex);
}

export interface AgentSpotlightProps {
  shortcutKey?: string;
}

export function AgentSpotlight({ shortcutKey = "/" }: AgentSpotlightProps) {
  const { agent, open, setOpen, title, icon, appearance, starterPrompts } =
    useAgentContext();
  const [showHistory, setShowHistory] = useState(false);
  // The spotlight has no launcher, so the shortcut handler stashes whatever
  // held focus and the lifecycle hook restores it after the panel unmounts.
  const restoreRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showPanel, closing, close, panelAnimationEnd } = useShellLifecycle({
    open,
    onOpenChange: setOpen,
    restoreFocusTo: restoreRef,
  });
  useFocusTrap(containerRef, showPanel);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!showPanel && shouldTriggerShortcut(event, shortcutKey)) {
        event.preventDefault();
        restoreRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPanel, shortcutKey, setOpen]);

  if (!showPanel) {
    return (
      <p
        className="agent-spotlight-hint agent-muted"
        data-agent-ui="spotlight-hint"
        aria-hidden="true"
      >
        {icon} Press <kbd className="agent-kbd">{shortcutKey}</kbd> to ask{" "}
        {title}
      </p>
    );
  }

  const visible = showHistory ? agent.messages : lastExchange(agent.messages);

  return (
    <div className="agent-spotlight-root" data-agent-ui="spotlight">
      <div
        className={`agent-spotlight-backdrop${closing ? " agent-closing" : ""}`}
        aria-hidden="true"
        onClick={close}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-label={`${title} assistant`}
        className={`agent-spotlight-container${closing ? " agent-closing" : ""}`}
        onAnimationEnd={panelAnimationEnd}
      >
        {/* Shell context so a composed CloseButton plays the exit animation. */}
        <AgentShellProvider close={close}>
          <div className={`${surfaceClass(appearance)} agent-spotlight-inputcard`}>
            <AgentInput
              autoFocus
              placeholder={`Ask ${title} anything…`}
              className="agent-spotlight-input"
            />
            <div className="agent-spotlight-meta">
              <span className="agent-muted">
                <kbd className="agent-kbd">Esc</kbd> to close
              </span>
              <div className="agent-spotlight-actions">
                <AutoApproveButton>Auto-approve</AutoApproveButton>
                {agent.messages.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="agent-btn-ghost"
                      onClick={() => setShowHistory((v) => !v)}
                    >
                      {showHistory ? "Latest only" : "Show conversation"}
                    </button>
                    <button
                      type="button"
                      className="agent-btn-ghost"
                      onClick={() => {
                        agent.reset();
                        setShowHistory(false);
                      }}
                    >
                      <RefreshIcon size={12} /> New chat
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          {(visible.length > 0 || starterPrompts.length > 0) && (
            <div className={`${surfaceClass(appearance)} agent-spotlight-results`}>
              <AgentMessages messages={visible} />
            </div>
          )}
        </AgentShellProvider>
      </div>
    </div>
  );
}
