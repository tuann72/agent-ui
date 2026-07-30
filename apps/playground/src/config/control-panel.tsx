/**
 * The playground's control surface: a Tweakpane pane behind a small edge tab.
 *
 * Tweakpane is imperative and owns its own DOM, so the bridge is deliberately
 * narrow — React state stays the single source of truth, the pane is built
 * exactly once against a mutable draft, and every change is lifted back up
 * through `onChange`. External changes (a preset, a URL, the back button) flow
 * the other way via `pane.refresh()`.
 */
import { useEffect, useRef } from "react";
import type { BladeApi, FolderApi } from "@tweakpane/core";
import { Pane } from "tweakpane";
import { shouldTriggerShortcut } from "@agent-ui/registry";
import {
  APPEARANCES,
  BORDER_STYLES,
  LAUNCHERS,
  SELECTION_SIDES,
  SIDES,
  THEMES,
  TOOL_POLICIES,
  VARIANTS,
  type PlaygroundConfig,
} from "./playground-config";
import { publicManifest } from "../manifest";

/** Tweakpane list options are `{ label: value }`. */
function optionsOf<T extends string>(values: readonly T[]): Record<string, T> {
  return Object.fromEntries(values.map((value) => [value, value]));
}

const ROUTE_OPTIONS = Object.fromEntries(
  publicManifest.routes.map((route) => [route.title, route.route]),
);

/** The pane's draft: the config plus the one knob that is not config. */
type Draft = PlaygroundConfig & { route: string };

/** Strip the non-config knob back off. */
function toConfig(draft: Draft): PlaygroundConfig {
  const { route, ...config } = draft;
  void route;
  return config;
}

export interface ControlPanelProps {
  config: PlaygroundConfig;
  onConfigChange: (config: PlaygroundConfig) => void;
  route: string;
  onNavigate: (route: string) => void;
  /** Remounts the shell, which is how the playground clears a conversation. */
  onResetConversation: () => void;
}

export function ControlPanel({
  config,
  onConfigChange,
  route,
  onNavigate,
  onResetConversation,
}: ControlPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<Pane | null>(null);
  const draftRef = useRef<Draft>({ ...config, route });
  // Latest-value refs: the pane is constructed once, so it must never close
  // over a stale callback.
  const callbacks = useRef({ onConfigChange, onNavigate, onResetConversation });
  callbacks.current = { onConfigChange, onNavigate, onResetConversation };
  // pane.refresh() reports its programmatic value updates through the same
  // change events as user edits. Suppress those echoes so syncing a route does
  // not navigate (and push history) a second time.
  const syncing = useRef(false);
  // Bindings whose relevance depends on other bindings.
  const conditional = useRef<{
    side: BladeApi | null;
    launcher: BladeApi | null;
    detachable: BladeApi | null;
    highlight: BladeApi[];
  }>({ side: null, launcher: null, detachable: null, highlight: [] });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const draft = draftRef.current;
    const pane = new Pane({ container, title: "agent-ui playground" });
    paneRef.current = pane;

    const commit = () => {
      if (!syncing.current) callbacks.current.onConfigChange(toConfig(draft));
    };
    const bind = <K extends keyof PlaygroundConfig>(
      folder: FolderApi,
      key: K,
      params: Record<string, unknown>,
    ) => folder.addBinding(draft, key, params).on("change", commit);

    const shell = pane.addFolder({ title: "Shell" });
    bind(shell, "variant", { options: optionsOf(VARIANTS) });
    bind(shell, "appearance", { options: optionsOf(APPEARANCES) });
    conditional.current.side = bind(shell, "side", {
      options: optionsOf(SIDES),
    });
    conditional.current.launcher = bind(shell, "launcher", {
      options: optionsOf(LAUNCHERS),
    });
    bind(shell, "title", { label: "name" });
    bind(shell, "header", {});
    bind(shell, "inputSeparator", { label: "input rule" });
    bind(shell, "starterPrompts", { label: "starter tasks" });
    conditional.current.detachable = bind(shell, "detachable", {
      label: "detachable",
    });
    // Remounting the shell is how the playground clears a conversation, so a
    // flow can be re-run without a page reload.
    shell
      .addButton({ title: "New conversation" })
      .on("click", () => callbacks.current.onResetConversation());

    const site = pane.addFolder({ title: "Site" });
    site.addBinding(draft, "route", { label: "page", options: ROUTE_OPTIONS })
      .on("change", (event) => {
        if (!syncing.current) callbacks.current.onNavigate(event.value);
      });
    bind(site, "theme", { options: optionsOf(THEMES) });

    const selection = pane.addFolder({ title: "Selection", expanded: false });
    bind(selection, "selectionAsk", { label: "ask popover" });
    bind(selection, "selectionSide", {
      label: "side",
      options: optionsOf(SELECTION_SIDES),
    });

    const tools = pane.addFolder({ title: "Tools", expanded: false });
    bind(tools, "navigatePolicy", {
      label: "navigate",
      options: optionsOf(TOOL_POLICIES),
    });
    bind(tools, "highlightPolicy", {
      label: "highlight",
      options: optionsOf(TOOL_POLICIES),
    });
    bind(tools, "interactPolicy", {
      label: "interact",
      options: optionsOf(TOOL_POLICIES),
    });
    bind(tools, "maxNavigationsPerTurn", {
      label: "max navigations",
      min: 0,
      max: 6,
      step: 1,
    });
    bind(tools, "maxInteractionsPerTurn", {
      label: "max clicks",
      min: 0,
      max: 6,
      step: 1,
    });

    const highlight = pane.addFolder({ title: "Highlight", expanded: false });
    bind(highlight, "highlightOverride", { label: "override theme" });
    conditional.current.highlight = [
      bind(highlight, "highlightDurationMs", {
        label: "duration",
        min: 250,
        max: 30_000,
        step: 250,
      }),
      bind(highlight, "highlightPadding", {
        label: "padding",
        min: 0,
        max: 64,
        step: 1,
      }),
      bind(highlight, "highlightBorderColor", {
        label: "border",
        view: "color",
      }),
      bind(highlight, "highlightBorderWidth", {
        label: "border width",
        min: 0,
        max: 16,
        step: 1,
      }),
      bind(highlight, "highlightBorderStyle", {
        label: "border style",
        options: optionsOf(BORDER_STYLES),
      }),
      bind(highlight, "highlightFill", {
        label: "fill",
        view: "color",
        color: { alpha: true },
      }),
      bind(highlight, "highlightRingColor", {
        label: "ring",
        view: "color",
        color: { alpha: true },
      }),
      bind(highlight, "highlightRadius", {
        label: "radius",
        min: 0,
        max: 32,
        step: 1,
      }),
    ];

    return () => {
      pane.dispose();
      paneRef.current = null;
      conditional.current = {
        side: null,
        launcher: null,
        detachable: null,
        highlight: [],
      };
    };
  }, []);

  // Pull external changes (preset, URL, back button) into the pane.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    syncing.current = true;
    try {
      Object.assign(draftRef.current, config, { route });
      pane.refresh();
    } finally {
      syncing.current = false;
    }
  }, [config, route]);

  // Hide knobs that do not apply to the current shell instead of leaving dead
  // controls on screen — the panel should read as documentation.
  useEffect(() => {
    const { side, launcher, detachable, highlight } = conditional.current;
    if (side) side.hidden = config.variant === "spotlight";
    if (launcher) launcher.hidden = config.variant !== "sidebar";
    // The spotlight is already a floating overlay: nothing to detach from.
    if (detachable) detachable.hidden = config.variant === "spotlight";
    for (const binding of highlight) binding.hidden = !config.highlightOverride;
  }, [config.variant, config.highlightOverride]);

  return <div ref={containerRef} className="playground-pane" />;
}

/**
 * The edge tab. Deliberately quiet: it dims to a sliver when the panel is
 * closed so it stays out of the way of a screen recording, and `h` toggles it
 * using the same suppression rules as Agent's own shortcut (never while typing,
 * composing, or holding a modifier).
 */
export function PanelTab({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldTriggerShortcut(event, "h")) return;
      event.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <button
      type="button"
      className="playground-tab"
      data-open={open || undefined}
      aria-expanded={open}
      aria-label={open ? "Hide playground controls" : "Show playground controls"}
      onClick={() => toggleRef.current()}
    >
      <span aria-hidden="true">{open ? "‹" : "›"}</span>
      <span className="playground-tab-label">CONTROLS</span>
    </button>
  );
}
