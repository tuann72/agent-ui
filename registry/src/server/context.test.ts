import { describe, expect, test } from "bun:test";
import type { AgentPublicManifest } from "../core/types";
import {
  formatContext,
  scoreDocument,
  selectContext,
  withContent,
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

describe("withContent", () => {
  const publicManifest: AgentPublicManifest = {
    routes: [
      {
        route: "/",
        title: "Home",
        description: "Landing page.",
        targets: [{ id: "hero", description: "Hero banner." }],
      },
      {
        route: "/pricing",
        title: "Pricing",
        description: "Plans and billing.",
        targets: [
          { id: "plans", description: "Plan cards." },
          { id: "buy", description: "Buy button.", interactive: true },
        ],
      },
    ],
  };

  test("carries route metadata and targets over from the public manifest", () => {
    const server = withContent(publicManifest, {
      "/pricing": { body: "Pro is $20.", keywords: ["cost"] },
    });
    expect(server.documents).toHaveLength(2);
    expect(server.documents[1]).toEqual({
      route: "/pricing",
      title: "Pricing",
      description: "Plans and billing.",
      keywords: ["cost"],
      targets: [
        { id: "plans", description: "Plan cards." },
        { id: "buy", description: "Buy button.", interactive: true },
      ],
      body: "Pro is $20.",
    });
  });

  test("keeps every public route, so both halves describe the same pages", () => {
    const server = withContent(publicManifest, {});
    expect(server.documents.map((doc) => doc.route)).toEqual(["/", "/pricing"]);
    expect(server.documents[0]?.body).toBe("");
  });

  test("omits keywords rather than emitting an empty list", () => {
    const server = withContent(publicManifest, { "/": { body: "Hello." } });
    expect(server.documents[0]).not.toHaveProperty("keywords");
  });

  test("throws on content for a route the public manifest does not have", () => {
    expect(() =>
      withContent(publicManifest, { "/pricng": { body: "typo." } }),
    ).toThrow('"/pricng" is not a route in the public manifest');
  });
});
