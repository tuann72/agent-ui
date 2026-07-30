import type {
  AgentPublicManifest,
  AgentTarget,
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
 * Resolve a target id against the page the user is on. Both page actions share
 * this because both are current-route-only, and both need the same distinction
 * the plain "unknown" answer throws away: a target that *does* exist, just on
 * another page. Reporting that route back turns a dead end into a recoverable
 * step — the model navigates there and retries instead of concluding the
 * element is unreachable.
 */
type TargetLookup =
  | { kind: "found"; entry: AgentTarget }
  // Discriminated on a string, not a boolean: the playground typechecks without
  // `strict`, where a boolean discriminant does not narrow.
  | { kind: "rejected"; output: AgentToolOutput };

function findTarget(
  manifest: AgentPublicManifest,
  currentRoute: string,
  target: unknown,
): TargetLookup {
  const reject = (output: AgentToolOutput): TargetLookup => ({
    kind: "rejected",
    output,
  });
  if (typeof target !== "string" || target.length === 0) {
    return reject({ ok: false, reason: "invalid-target" });
  }
  const page = manifest.routes.find((r) => r.route === currentRoute);
  if (!page) return reject({ ok: false, reason: "unknown-route" });
  const entry = page.targets.find((t) => t.id === target);
  if (entry) return { kind: "found", entry };
  const owner = manifest.routes.find(
    (r) => r.route !== currentRoute && r.targets.some((t) => t.id === target),
  );
  return reject(
    owner
      ? {
          ok: false,
          reason: "target-on-another-route",
          expectedRoute: owner.route,
        }
      : { ok: false, reason: "unknown-target" },
  );
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
  const found = findTarget(manifest, currentRoute, target);
  return found.kind === "rejected" ? found.output : { ok: true };
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
  const found = findTarget(manifest, currentRoute, target);
  if (found.kind === "rejected") return found.output;
  if (!found.entry.interactive) {
    return { ok: false, reason: "target-not-interactive" };
  }
  return { ok: true };
}
