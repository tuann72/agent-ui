import { findTargetElement } from "./target";
import type { AgentHighlightOptions, AgentToolOutput } from "./types";

interface ActiveHighlight {
  overlay: HTMLElement;
  timer: number;
  cleanup: () => void;
}

let active: ActiveHighlight | null = null;

/**
 * Appearance options that pass straight through to a custom property, and the
 * property each one writes. Anything left undefined keeps whatever `styles.css`
 * declares, so per-call overrides and the global theme use one mechanism.
 */
const HIGHLIGHT_CSS_PROPERTIES = [
  ["borderColor", "--agent-highlight-border-color"],
  ["borderStyle", "--agent-highlight-border-style"],
  ["backgroundColor", "--agent-highlight-fill"],
  ["ringColor", "--agent-highlight-ring-color"],
  ["borderRadius", "--agent-highlight-radius"],
  ["boxShadow", "--agent-highlight-shadow"],
] as const;

/** The same, for options measured in pixels and clamped before they land. */
const HIGHLIGHT_CSS_WIDTHS = [
  ["borderWidth", "--agent-highlight-border-width"],
  ["ringWidth", "--agent-highlight-ring-width"],
] as const;

function applyHighlightStyle(
  overlay: HTMLElement,
  options: AgentHighlightOptions | undefined,
): void {
  if (!options) return;
  for (const [key, property] of HIGHLIGHT_CSS_PROPERTIES) {
    const value = options[key];
    if (value) overlay.style.setProperty(property, value);
  }
  for (const [key, property] of HIGHLIGHT_CSS_WIDTHS) {
    const value = options[key];
    if (value === undefined) continue;
    overlay.style.setProperty(
      property,
      `${Math.min(Math.max(value, 0), 16)}px`,
    );
  }
  if (options.pulse === false) overlay.classList.add("agent-highlight-static");
  if (options.className) overlay.classList.add(options.className);
}

function liveRegion(): HTMLElement {
  let region = document.getElementById("agent-live-region");
  if (!region) {
    region = document.createElement("div");
    region.id = "agent-live-region";
    region.className = "agent-sr-only";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  return region;
}

export function dismissHighlight(): void {
  if (!active) return;
  window.clearTimeout(active.timer);
  active.cleanup();
  active.overlay.remove();
  active = null;
}

/**
 * Highlight an opted-in page element. The target id must already be validated
 * against the manifest; resolution goes through `findTargetElement`, so an
 * arbitrary selector is never accepted. The overlay is absolutely positioned so
 * it causes no layout shift, and it cleans itself up after `durationMs`.
 */
export function runHighlight(
  targetId: string,
  options?: AgentHighlightOptions & { label?: string },
): AgentToolOutput {
  const element = findTargetElement(targetId);
  if (element === null) {
    return { ok: false, reason: "target-not-found" };
  }

  dismissHighlight();

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  element.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "center",
  });

  const pad = Math.min(Math.max(options?.padding ?? 6, 0), 64);
  const overlay = document.createElement("div");
  overlay.className = "agent-highlight-overlay";
  overlay.setAttribute("aria-hidden", "true");
  applyHighlightStyle(overlay, options);

  let frame = 0;
  const position = () => {
    frame = 0;
    const rect = element.getBoundingClientRect();
    overlay.style.top = `${rect.top + window.scrollY - pad}px`;
    overlay.style.left = `${rect.left + window.scrollX - pad}px`;
    overlay.style.width = `${rect.width + pad * 2}px`;
    overlay.style.height = `${rect.height + pad * 2}px`;
  };
  const schedulePosition = () => {
    if (frame === 0) frame = window.requestAnimationFrame(position);
  };
  position();
  document.body.appendChild(overlay);

  window.addEventListener("resize", schedulePosition);
  window.addEventListener("scroll", schedulePosition, true);
  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(schedulePosition);
  resizeObserver?.observe(element);

  liveRegion().textContent =
    options?.label ?? `Highlighted page section: ${targetId}`;

  const duration = Math.min(Math.max(options?.durationMs ?? 4000, 250), 30_000);
  const timer = window.setTimeout(dismissHighlight, duration);
  active = {
    overlay,
    timer,
    cleanup: () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("scroll", schedulePosition, true);
    },
  };
  return { ok: true };
}
