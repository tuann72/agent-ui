import { describe, expect, test } from "bun:test";
import {
  formatContext,
  scoreDocument,
  selectContext,
  type AgentServerManifest,
} from "./context";

const manifest: AgentServerManifest = {
  documents: [
    {
      route: "/",
      title: "Home",
      description: "Landing page.",
      body: "Welcome to the demo site.",
    },
    {
      route: "/pricing",
      title: "Pricing",
      description: "Plans and billing.",
      keywords: ["subscriptions"],
      body: "Free, Pro, and Enterprise plans. Pricing is monthly.",
    },
    {
      route: "/docs",
      title: "Docs",
      description: "Documentation.",
      body: "Quickstart guide for installation.",
    },
  ],
};

describe("scoreDocument", () => {
  test("weights title/keyword matches above body matches", () => {
    const pricing = manifest.documents[1]!;
    const docs = manifest.documents[2]!;
    const query = ["pricing"];
    expect(scoreDocument(pricing, query)).toBeGreaterThan(
      scoreDocument(docs, query),
    );
  });

  test("empty query scores zero", () => {
    expect(scoreDocument(manifest.documents[0]!, [])).toBe(0);
  });
});

describe("selectContext", () => {
  test("always puts the current route first", () => {
    const { blocks } = selectContext(manifest, "/docs", "pricing plans");
    expect(blocks[0]?.route).toBe("/docs");
    expect(blocks.map((b) => b.route)).toContain("/pricing");
  });

  test("omits unrelated documents", () => {
    const { blocks } = selectContext(manifest, "/", "quickstart");
    expect(blocks.map((b) => b.route)).toEqual(["/", "/docs"]);
  });

  test("is deterministic", () => {
    const a = selectContext(manifest, "/", "pricing quickstart");
    const b = selectContext(manifest, "/", "pricing quickstart");
    expect(a).toEqual(b);
  });

  test("truncates deterministically under the budget", () => {
    const { blocks, truncated } = selectContext(manifest, "/pricing", "", 10);
    expect(truncated).toBe(true);
    expect(blocks[0]?.body.length).toBe(10);
    expect(blocks[0]?.body).toBe(
      manifest.documents[1]!.body.slice(0, 10),
    );
  });

  test("handles unknown current route", () => {
    const { blocks } = selectContext(manifest, undefined, "pricing");
    expect(blocks[0]?.route).toBe("/pricing");
  });
});

describe("formatContext", () => {
  test("delimits every block with agent-context tags", () => {
    const { blocks } = selectContext(manifest, "/", "pricing");
    const formatted = formatContext(blocks);
    expect(formatted).toContain('<agent-context route="/" title="Home">');
    expect(formatted).toContain("</agent-context>");
  });
});
