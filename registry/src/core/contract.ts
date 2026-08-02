/**
 * The tool contract: one description of the wire between the chat client and
 * whatever backend answers it.
 *
 * Every tool here is defined in two halves that must agree exactly — a
 * declaration the model sees, and an executor that runs the call — and the two
 * halves live in different files, sometimes on different machines. Before this
 * module the names were retyped in seven places (declarations, the request part
 * allowlist, the policy map, the `AgentTools` map, the client union, its runtime
 * guard, and the dispatch), with nothing checking that they matched. A misspelled
 * name still typechecked, and forgetting the part allowlist produced the worst
 * failure shape available: the tool worked once, then the *next* request 400'd
 * when the transcript came back carrying a part type the server did not know.
 *
 * So: names, part types, descriptions, and the prompt rules that stop being true
 * without the tools all live here, and everything else derives from them.
 *
 * This file deliberately imports nothing. The zod schemas are next door in
 * `contract.schemas.ts` because zod is a server dependency, and pulling it into
 * a module the browser bundle imports at runtime would put a validator in every
 * consumer's client bundle to serve code that only ever runs on the server.
 */

/**
 * Tools the model calls and the **client** executes. They are declared with no
 * `execute`, so the SDK forwards the call to the browser, where `useAgentChat`
 * applies the per-tool policy before touching the page. That forwarding is the
 * whole reason approval works, and it is why these names must be identical on
 * both sides: the server names the tool, the client recognizes it.
 */
export const CLIENT_TOOL_NAMES = ["navigate", "highlight", "interact"] as const;

/**
 * Tools the **server** executes and returns a result for. The client never sees
 * these as actions — no policy, no approval card, no page effect — it only
 * renders that they ran.
 */
export const SERVER_TOOL_NAMES = ["search_content"] as const;

/** Every tool the model is offered, in declaration order. */
export const AGENT_TOOL_NAMES = [
  ...CLIENT_TOOL_NAMES,
  ...SERVER_TOOL_NAMES,
] as const;

export type AgentClientToolName = (typeof CLIENT_TOOL_NAMES)[number];
export type AgentServerToolName = (typeof SERVER_TOOL_NAMES)[number];
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

const CLIENT_TOOL_NAME_SET: ReadonlySet<string> = new Set(CLIENT_TOOL_NAMES);

/**
 * Runtime guard for model-supplied tool names — never trust the wire. Derived
 * from `CLIENT_TOOL_NAMES` rather than re-listing it, because the two copies
 * this replaces could disagree silently: a tool added to the union but not the
 * guard is declared to the model, called by it, and then dropped on arrival.
 */
export function isAgentToolName(name: unknown): name is AgentClientToolName {
  return typeof name === "string" && CLIENT_TOOL_NAME_SET.has(name);
}

/**
 * The `tool-${name}` part type the AI SDK writes into a UI message for each
 * call. The server's request allowlist is built from this, so a new tool cannot
 * be declared without its transcript part being accepted back.
 */
export type AgentToolPartType = `tool-${AgentToolName}`;

export const AGENT_TOOL_PART_TYPES = AGENT_TOOL_NAMES.map(
  (name) => `tool-${name}` as const,
);

/**
 * What each tool tells the model about itself. These are prompt text, not
 * documentation: the constraints they state ("only routes from the site
 * manifest", "only targets marked (clickable)") are the model's only warning
 * before the client rejects a call, and `interact`'s closing sentence is where
 * auto-approve is explained to the model at all.
 */
export const TOOL_DESCRIPTIONS: Record<AgentToolName, string> = {
  navigate:
    "Navigate the user to another page of this site. Only routes from the site manifest are valid. Call this first whenever the element you want to highlight or click belongs to a route other than the user's current one. May require user approval.",
  highlight:
    "Highlight a registered element on the page the user is on right now. Only target ids registered for the current route are valid — for a target listed under a different route, call navigate to that route first and wait for its result.",
  interact:
    "Click a registered interactive element (a button) on the page the user is on right now. Only target ids marked (clickable) in the catalog for the current route are valid — for a target listed under a different route, call navigate to that route first and wait for its result. Requires user approval unless the user enabled auto-approve.",
  search_content:
    "Search the site's documentation for additional excerpts when the provided context is not enough.",
};

/**
 * The system-prompt rule covering what the tools accept and who enforces it.
 *
 * The last sentence is the load-bearing one: the client applies policy
 * independently, so a model that narrates a click as done the moment it issues
 * the call is lying to the user while the approval card is still unanswered.
 */
export const TOOL_SECURITY_RULE = `- Tools only accept values from the manifests below. Navigation is limited to the listed routes; highlighting is limited to the listed target ids on the user's current page; clicking is limited to the current page's targets marked (clickable). The client independently enforces these rules and user approval policies, so do not promise actions the user has not approved.`;

/**
 * Ordering rules for page actions.
 *
 * `highlight` and `interact` reach only the page the user is on, so a target
 * belonging to another route is not merely unavailable — it does not exist yet.
 * The model has to sequence a navigate ahead of it and wait for the result,
 * which is not something it infers from the tool list on its own.
 */
export const TOOL_ORDERING_PROTOCOL = `Page actions are ordered, and the order is your responsibility:
- highlight and interact only reach the page the user is on right now. A target listed in the catalog under a different route does not exist for them yet.
- So before highlighting or clicking, check which route owns the target. If it is not the user's current route, call navigate to that route first, wait for the navigate result, and only then highlight or click.
- A result of {"reason":"target-on-another-route"} means exactly this: the target is real but lives on the "expectedRoute" in that result. Navigate there and retry rather than giving up or trying a different target.
- One page action per goal, in dependency order. Never issue a highlight or click for a page you have not arrived on.`;
