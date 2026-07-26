import { expect, test } from "bun:test";
import type { AgentPublicManifest } from "@agent-ui/registry";
import { publicManifest } from "../src/manifest";
import { serverManifest } from "./manifest";

/**
 * The two manifests are hand-written until `agent sync` generates both from
 * one source. Until then this guards the split: the public manifest must be
 * exactly the server manifest minus everything server-only (bodies,
 * keywords) — same routes, same order, same metadata, same targets.
 */
test("public manifest is the server manifest's safe projection", () => {
  const projected: AgentPublicManifest = {
    routes: serverManifest.documents.map((doc) => ({
      route: doc.route,
      title: doc.title,
      description: doc.description,
      targets: doc.targets ?? [],
    })),
  };
  expect(publicManifest).toEqual(projected);
});

test("no route appears twice in the server manifest", () => {
  const routes = serverManifest.documents.map((doc) => doc.route);
  expect(new Set(routes).size).toBe(routes.length);
});
