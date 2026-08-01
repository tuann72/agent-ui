/**
 * Every knob the playground exposes, in one serializable object.
 *
 * The config round-trips through the query string, so any state you can reach
 * with the control panel is also reachable from a URL. That is what makes a
 * screen recording reproducible: set the scene once, copy the address bar, and
 * every later take starts from the identical frame.
 */
import type {
  AgentAppearance,
  AgentHighlightOptions,
  AgentSelectionSide,
  AgentToolPolicies,
  AgentVariant,
  SidebarLauncher,
  ToolPolicy,
} from "@agent-ui/registry";

export type PlaygroundTheme = "light" | "dark";
export type PlaygroundSide = "left" | "right";
export type HighlightBorderStyle = "solid" | "dashed" | "dotted";

export interface PlaygroundConfig {
  /** Control panel visibility. `false` leaves nothing dev-ish on screen. */
  panel: boolean;
  theme: PlaygroundTheme;

  // Shell
  variant: AgentVariant;
  appearance: AgentAppearance;
  side: PlaygroundSide;
  launcher: SidebarLauncher;
  title: string;
  header: boolean;
  inputSeparator: boolean;
  starterPrompts: boolean;
  /** Offer the header's detach control (dock and sidebar only). */
  detachable: boolean;

  // Selection
  selectionAsk: boolean;
  selectionSide: AgentSelectionSide;

  // Tool policy
  navigatePolicy: ToolPolicy;
  highlightPolicy: ToolPolicy;
  interactPolicy: ToolPolicy;
  maxNavigationsPerTurn: number;
  maxInteractionsPerTurn: number;

  /** When false the overlay uses the stylesheet's own `--agent-highlight-*`. */
  highlightOverride: boolean;
  highlightDurationMs: number;
  highlightPadding: number;
  highlightBorderColor: string;
  highlightBorderWidth: number;
  highlightBorderStyle: HighlightBorderStyle;
  highlightFill: string;
  highlightRingColor: string;
  highlightRingWidth: number;
  highlightRadius: number;
  highlightPulse: boolean;
}

export const DEFAULT_CONFIG: PlaygroundConfig = {
  panel: true,
  theme: "light",

  variant: "dock",
  appearance: "default",
  side: "right",
  launcher: "tab",
  title: "Agent",
  header: true,
  inputSeparator: true,
  starterPrompts: true,
  detachable: false,

  selectionAsk: true,
  selectionSide: "top",

  navigatePolicy: "confirm",
  highlightPolicy: "auto",
  interactPolicy: "confirm",
  maxNavigationsPerTurn: 2,
  maxInteractionsPerTurn: 3,

  highlightOverride: false,
  // Seeded from the stylesheet's own defaults so flipping the override on
  // changes nothing until a value is actually moved.
  highlightDurationMs: 4000,
  highlightPadding: 6,
  highlightBorderColor: "#9A8873",
  highlightBorderWidth: 2,
  highlightBorderStyle: "solid",
  highlightFill: "rgba(154, 136, 115, 0.12)",
  highlightRingColor: "rgba(154, 136, 115, 0.4)",
  highlightRingWidth: 4,
  highlightRadius: 0,
  highlightPulse: true,
};

export const VARIANTS: readonly AgentVariant[] = ["dock", "sidebar", "spotlight"];
export const APPEARANCES: readonly AgentAppearance[] = ["default", "glass"];
export const SIDES: readonly PlaygroundSide[] = ["left", "right"];
export const LAUNCHERS: readonly SidebarLauncher[] = ["tab", "button"];
export const SELECTION_SIDES: readonly AgentSelectionSide[] = [
  "top",
  "bottom",
  "left",
  "right",
];
export const TOOL_POLICIES: readonly ToolPolicy[] = [
  "auto",
  "confirm",
  "disabled",
];
export const THEMES: readonly PlaygroundTheme[] = ["light", "dark"];
export const BORDER_STYLES: readonly HighlightBorderStyle[] = [
  "solid",
  "dashed",
  "dotted",
];

// --- Query-string codec ------------------------------------------------------

interface Codec<T> {
  param: string;
  parse: (raw: string) => T | undefined;
  format: (value: T) => string;
}

const oneOf = <T extends string>(
  param: string,
  values: readonly T[],
): Codec<T> => ({
  param,
  parse: (raw) => values.find((value) => value === raw),
  format: (value) => value,
});

const flag = (param: string): Codec<boolean> => ({
  param,
  parse: (raw) =>
    raw === "1" || raw === "true"
      ? true
      : raw === "0" || raw === "false"
        ? false
        : undefined,
  format: (value) => (value ? "1" : "0"),
});

const integer = (param: string, min: number, max: number): Codec<number> => ({
  param,
  parse: (raw) => {
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value < min || value > max) return undefined;
    return value;
  },
  format: (value) => String(value),
});

const text = (param: string, maxLength: number): Codec<string> => ({
  param,
  parse: (raw) => (raw.length > 0 && raw.length <= maxLength ? raw : undefined),
  format: (value) => value,
});

/**
 * One codec per field. Written as a mapped type so adding a config key is a
 * type error until it is given a query-string representation too.
 */
const CODECS: { [K in keyof PlaygroundConfig]: Codec<PlaygroundConfig[K]> } = {
  panel: flag("panel"),
  theme: oneOf("theme", THEMES),

  variant: oneOf("variant", VARIANTS),
  appearance: oneOf("appearance", APPEARANCES),
  side: oneOf("side", SIDES),
  launcher: oneOf("launcher", LAUNCHERS),
  title: text("title", 40),
  header: flag("header"),
  inputSeparator: flag("separator"),
  starterPrompts: flag("starters"),
  detachable: flag("detach"),

  selectionAsk: flag("ask"),
  selectionSide: oneOf("askSide", SELECTION_SIDES),

  navigatePolicy: oneOf("navigate", TOOL_POLICIES),
  highlightPolicy: oneOf("highlight", TOOL_POLICIES),
  interactPolicy: oneOf("interact", TOOL_POLICIES),
  maxNavigationsPerTurn: integer("maxNav", 0, 10),
  maxInteractionsPerTurn: integer("maxClick", 0, 10),

  highlightOverride: flag("hl"),
  highlightDurationMs: integer("hlDuration", 250, 30_000),
  highlightPadding: integer("hlPad", 0, 64),
  highlightBorderColor: text("hlBorder", 32),
  highlightBorderWidth: integer("hlWidth", 0, 16),
  highlightBorderStyle: oneOf("hlStyle", BORDER_STYLES),
  highlightFill: text("hlFill", 40),
  highlightRingColor: text("hlRing", 40),
  highlightRingWidth: integer("hlRingWidth", 0, 16),
  highlightRadius: integer("hlRadius", 0, 64),
  highlightPulse: flag("hlPulse"),
};

const CONFIG_KEYS = Object.keys(CODECS) as (keyof PlaygroundConfig)[];

/** Read a config out of a query string, falling back to defaults per field. */
export function parseConfig(search: string): PlaygroundConfig {
  const params = new URLSearchParams(search);
  const config = { ...DEFAULT_CONFIG };
  for (const key of CONFIG_KEYS) {
    const raw = params.get(CODECS[key].param);
    if (raw === null) continue;
    // A malformed value is ignored rather than fatal: a hand-edited URL should
    // still load the playground.
    const parsed = (CODECS[key] as Codec<unknown>).parse(raw);
    if (parsed !== undefined) {
      (config as Record<string, unknown>)[key] = parsed;
    }
  }
  return config;
}

/** Serialize only what differs from the defaults, so URLs stay readable. */
export function configToSearch(config: PlaygroundConfig): string {
  const params = new URLSearchParams();
  for (const key of CONFIG_KEYS) {
    if (config[key] === DEFAULT_CONFIG[key]) continue;
    const codec = CODECS[key] as Codec<unknown>;
    params.set(codec.param, codec.format(config[key]));
  }
  const search = params.toString();
  return search.length > 0 ? `?${search}` : "";
}

// --- Derived props ----------------------------------------------------------

export function toToolPolicy(config: PlaygroundConfig): AgentToolPolicies {
  return {
    navigate: config.navigatePolicy,
    highlight: config.highlightPolicy,
    interact: config.interactPolicy,
  };
}

export function toHighlightOptions(
  config: PlaygroundConfig,
): AgentHighlightOptions | undefined {
  if (!config.highlightOverride) return undefined;
  return {
    durationMs: config.highlightDurationMs,
    padding: config.highlightPadding,
    borderColor: config.highlightBorderColor,
    borderWidth: config.highlightBorderWidth,
    borderStyle: config.highlightBorderStyle,
    backgroundColor: config.highlightFill,
    ringColor: config.highlightRingColor,
    ringWidth: config.highlightRingWidth,
    borderRadius: `${config.highlightRadius}px`,
    pulse: config.highlightPulse,
  };
}
