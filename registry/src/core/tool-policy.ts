import type {
  AgentPublicManifest,
  AgentToolOutput,
  AgentToolPolicies,
} from "./types";

export const DEFAULT_TOOL_POLICIES: AgentToolPolicies = {
  navigate: "confirm",
  highlight: "auto",
  // Clicking mutates page state, so it defaults to confirm like navigation.
  interact: "confirm",
};

export function resolveToolPolicies(
  overrides?: Partial<AgentToolPolicies>,
): AgentToolPolicies {
  return { ...DEFAULT_TOOL_POLICIES, ...overrides };
}

/**
 * Deterministic route allowlisting. Only exact, relative routes present in the
 * generated manifest are accepted, regardless of what the model produced.
 */
export function validateRoute(
  manifest: AgentPublicManifest,
  route: unknown,
): AgentToolOutput {
  if (typeof route !== "string" || route.length === 0) {
    return { ok: false, reason: "invalid-route" };
  }
  if (!route.startsWith("/") || route.startsWith("//")) {
    return { ok: false, reason: "route-not-relative" };
  }
  if (!manifest.routes.some((r) => r.route === route)) {
    return { ok: false, reason: "unknown-route" };
  }
  return { ok: true };
}

/**
 * A highlight target is valid only when it is registered in the manifest for
 * the page the user is currently on.
 */
export function validateTarget(
  manifest: AgentPublicManifest,
  currentRoute: string,
  target: unknown,
): AgentToolOutput {
  if (typeof target !== "string" || target.length === 0) {
    return { ok: false, reason: "invalid-target" };
  }
  const page = manifest.routes.find((r) => r.route === currentRoute);
  if (!page) {
    return { ok: false, reason: "unknown-route" };
  }
  if (!page.targets.some((t) => t.id === target)) {
    return { ok: false, reason: "unknown-target" };
  }
  return { ok: true };
}

/**
 * Interaction requires a second opt-in on top of target registration: the
 * manifest entry must be flagged `interactive`. A target registered for
 * highlighting is never clickable by default.
 */
export function validateInteraction(
  manifest: AgentPublicManifest,
  currentRoute: string,
  target: unknown,
): AgentToolOutput {
  if (typeof target !== "string" || target.length === 0) {
    return { ok: false, reason: "invalid-target" };
  }
  const page = manifest.routes.find((r) => r.route === currentRoute);
  if (!page) {
    return { ok: false, reason: "unknown-route" };
  }
  const entry = page.targets.find((t) => t.id === target);
  if (!entry) {
    return { ok: false, reason: "unknown-target" };
  }
  if (!entry.interactive) {
    return { ok: false, reason: "target-not-interactive" };
  }
  return { ok: true };
}
