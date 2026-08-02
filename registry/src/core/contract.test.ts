import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  AGENT_TOOL_NAMES,
  AGENT_TOOL_PART_TYPES,
  CLIENT_TOOL_NAMES,
  isAgentToolName,
  SERVER_TOOL_NAMES,
  TOOL_DESCRIPTIONS,
  TOOL_ORDERING_PROTOCOL,
  TOOL_SECURITY_RULE,
} from "./contract";
import { toolInputSchemas } from "./contract.schemas";

describe("tool names", () => {
  test("client and server sets are disjoint and cover every tool", () => {
    // A tool in both sets would be declared with an `execute` and forwarded to
    // the browser, which the SDK resolves by running the server one — silently
    // skipping the policy check the client exists to perform.
    const overlap = CLIENT_TOOL_NAMES.filter((name) =>
      (SERVER_TOOL_NAMES as readonly string[]).includes(name),
    );
    expect(overlap).toEqual([]);
    expect([...AGENT_TOOL_NAMES].sort()).toEqual(
      [...CLIENT_TOOL_NAMES, ...SERVER_TOOL_NAMES].sort(),
    );
  });

  test("the guard accepts client tools and rejects server-executed ones", () => {
    for (const name of CLIENT_TOOL_NAMES) expect(isAgentToolName(name)).toBe(true);
    // search_content has no client executor. Were the guard to accept it, the
    // dispatch would look up a policy that does not exist for it.
    for (const name of SERVER_TOOL_NAMES) expect(isAgentToolName(name)).toBe(false);
  });

  test("the guard rejects non-strings rather than throwing on them", () => {
    // It runs on `toolCall.toolName` straight off the wire.
    for (const value of [undefined, null, 42, {}, ["navigate"], "Navigate", ""]) {
      expect(isAgentToolName(value)).toBe(false);
    }
  });
});

describe("derived shapes", () => {
  test("part types are one per tool, in the SDK's tool- form", () => {
    expect(AGENT_TOOL_PART_TYPES).toEqual(
      AGENT_TOOL_NAMES.map((name) => `tool-${name}` as const),
    );
  });

  test("every tool has a description and an input schema", () => {
    for (const name of AGENT_TOOL_NAMES) {
      expect(TOOL_DESCRIPTIONS[name]?.length ?? 0).toBeGreaterThan(0);
      expect(toolInputSchemas[name]).toBeDefined();
    }
    expect(Object.keys(TOOL_DESCRIPTIONS).sort()).toEqual([...AGENT_TOOL_NAMES].sort());
    expect(Object.keys(toolInputSchemas).sort()).toEqual([...AGENT_TOOL_NAMES].sort());
  });

  test("schemas accept the documented field and reject the wrong shape", () => {
    expect(toolInputSchemas.navigate.parse({ route: "/pricing" })).toEqual({
      route: "/pricing",
    });
    expect(toolInputSchemas.highlight.parse({ target: "hero" })).toEqual({
      target: "hero",
    });
    // The field name is the half of the contract a rename breaks silently: the
    // client reads `route`, so a schema that accepted `path` would hand the
    // executor undefined.
    expect(() => toolInputSchemas.navigate.parse({ path: "/pricing" })).toThrow();
    expect(() => toolInputSchemas.interact.parse({ target: 3 })).toThrow();
  });
});

describe("prompt fragments", () => {
  test("interact's description explains auto-approve to the model", () => {
    // The toggle is client state, but nothing tells the model what it means
    // except this sentence. Without it a model narrates the click as done while
    // the approval card is still unanswered.
    expect(TOOL_DESCRIPTIONS.interact).toContain("auto-approve");
  });

  test("the security rule states who enforces policy", () => {
    expect(TOOL_SECURITY_RULE).toContain("client independently enforces");
    expect(TOOL_SECURITY_RULE).toContain("not approved");
  });

  test("the ordering protocol names the navigate-first rule and its error", () => {
    expect(TOOL_ORDERING_PROTOCOL).toContain("navigate to that route first");
    // tool-policy.ts returns this exact reason; the prose tells the model to
    // retry on it rather than treat the target as unreachable.
    expect(TOOL_ORDERING_PROTOCOL).toContain("target-on-another-route");
  });
});

describe("bundle boundary", () => {
  test("contract.ts imports nothing, so the client pays nothing for it", () => {
    // The split between this file and contract.schemas.ts only holds while this
    // one stays dependency-free — one `import { z }` here and zod lands in
    // every consumer's browser bundle to serve code that runs on the server.
    const source = readFileSync(new URL("./contract.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
  });

  test("types.ts reaches the schemas through an erased type-only import", () => {
    const source = readFileSync(new URL("./types.ts", import.meta.url), "utf8");
    expect(source).toContain('import type { ToolInput } from "./contract.schemas"');
    expect(source).not.toMatch(/^import \{[^}]*\} from "\.\/contract\.schemas"/m);
  });
});
