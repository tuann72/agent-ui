import { z } from "zod";

import type { AgentToolName } from "./contract";

/**
 * The tool input schemas, and the single source of the matching TypeScript
 * types.
 *
 * Split out of `contract.ts` for one reason: zod is a server dependency. The
 * chat client never validates tool input — the server already did, and
 * `tool-policy.ts` re-checks the *values* against the manifest rather than the
 * shape — so a runtime import of this module from the browser bundle would ship
 * a validator that only the server executes.
 *
 * The client still gets the types. `import type` is erased at compile time, so
 * a client module can name `NavigateInput` without zod appearing anywhere in its
 * import graph. That is what lets the schemas be the source of truth for both
 * halves at zero cost to the bundle: the hand-written interfaces these replaced
 * could drift from the schemas silently, and a renamed field would typecheck on
 * both sides while the model sent one name and the client read the other.
 */
export const toolInputSchemas = {
  navigate: z.object({
    route: z.string().describe("Exact route from the site manifest"),
  }),
  highlight: z.object({
    target: z
      .string()
      .describe("Registered data-agent-target id on the current page"),
  }),
  interact: z.object({
    target: z
      .string()
      .describe("Registered clickable data-agent-target id on the current page"),
  }),
  search_content: z.object({ query: z.string() }),
} satisfies Record<AgentToolName, z.ZodType>;

/**
 * `satisfies` above checks that every declared tool has a schema, but it leaves
 * the inferred value type intact so each schema keeps its own shape below. This
 * is the direction the check cannot make: a schema for a tool that does not
 * exist.
 */
export type ToolInputSchemas = typeof toolInputSchemas;

/** A tool's input type, by name. Lets consumers map over names without naming zod. */
export type ToolInput<K extends AgentToolName> = z.infer<ToolInputSchemas[K]>;

export type NavigateInput = ToolInput<"navigate">;
export type HighlightInput = ToolInput<"highlight">;
export type InteractInput = ToolInput<"interact">;
export type SearchContentInput = ToolInput<"search_content">;
