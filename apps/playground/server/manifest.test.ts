import { expect, test } from "bun:test";
import { publicManifest } from "../src/manifest";
import { serverManifest } from "./manifest";

/**
 * `withContent` makes the two manifests structurally impossible to diverge, so
 * what is left to check is the content half: every page the browser knows about
 * needs a body, or the assistant has nothing to answer from on that route.
 */
test("every public route has server content", () => {
  for (const doc of serverManifest.documents) {
    expect(doc.body.length).toBeGreaterThan(0);
  }
  expect(serverManifest.documents).toHaveLength(publicManifest.routes.length);
});

test("no route appears twice in the public manifest", () => {
  const routes = publicManifest.routes.map((route) => route.route);
  expect(new Set(routes).size).toBe(routes.length);
});
