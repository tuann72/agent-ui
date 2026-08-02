import { describe, expect, test } from "bun:test";
import { discoverRoutes, manifestStarter } from "./manifest-starter";

const options = { dir: "src/agent", manifestPath: "src/agent-manifest.ts" };

describe("discoverRoutes: Next.js App Router", () => {
  test("a page.tsx is a route, and its directory is the URL", () => {
    expect(
      discoverRoutes("next-app", [
        "app/page.tsx",
        "app/pricing/page.tsx",
        "app/about/team/page.tsx",
      ]),
    ).toEqual(["/", "/about/team", "/pricing"]);
  });

  test("route groups and private folders are stripped from the URL", () => {
    // (marketing) and _components are organizational; neither appears in the
    // path a user visits, so neither may appear in the manifest.
    expect(
      discoverRoutes("next-app", [
        "app/(marketing)/pricing/page.tsx",
        "app/(shop)/page.tsx",
      ]),
    ).toEqual(["/", "/pricing"]);
  });

  test("a src/ prefixed app directory works the same", () => {
    expect(discoverRoutes("next-app", ["src/app/pricing/page.tsx"])).toEqual([
      "/pricing",
    ]);
  });

  test("dynamic routes are skipped rather than guessed at", () => {
    // "/blog/[slug]" is not a URL. Emitting it would put a route in the manifest
    // that the client never reports being on, so navigate to it always fails.
    expect(
      discoverRoutes("next-app", ["app/blog/[slug]/page.tsx", "app/blog/page.tsx"]),
    ).toEqual(["/blog"]);
  });

  test("layouts, components, and route handlers are not routes", () => {
    expect(
      discoverRoutes("next-app", [
        "app/layout.tsx",
        "app/api/agent/route.ts",
        "app/components/nav.tsx",
      ]),
    ).toEqual([]);
  });
});

describe("discoverRoutes: TanStack Router", () => {
  test("index is the directory's own route, a named file is its child", () => {
    expect(
      discoverRoutes("tanstack-start", [
        "src/routes/index.tsx",
        "src/routes/pricing.tsx",
        "src/routes/about/index.tsx",
      ]),
    ).toEqual(["/", "/about", "/pricing"]);
  });

  test("__root and -prefixed files are not routes", () => {
    expect(
      discoverRoutes("tanstack-start", [
        "src/routes/__root.tsx",
        "src/routes/-components/card.tsx",
        "src/routes/pricing.tsx",
      ]),
    ).toEqual(["/pricing"]);
  });

  test("dynamic segments are skipped", () => {
    expect(
      discoverRoutes("tanstack-start", ["src/routes/posts/$postId.tsx"]),
    ).toEqual([]);
  });
});

describe("discoverRoutes: hosts with no readable convention", () => {
  test("React Router returns nothing, because its routes are code", () => {
    // routes.ts declares them programmatically; globbing app/routes/ gets flat
    // -route escapes and layout nesting wrong. withContent throws on a route the
    // manifest does not declare, so a wrong guess breaks the first request —
    // worse than a placeholder the consumer can see is unfinished.
    expect(
      discoverRoutes("react-router", ["app/routes/home.tsx", "app/routes.ts"]),
    ).toEqual([]);
  });

  test("a Vite SPA, Hono, and unknown hosts return nothing", () => {
    const files = ["src/main.tsx", "src/pages/Home.tsx"];
    expect(discoverRoutes("vite-spa", files)).toEqual([]);
    expect(discoverRoutes("hono", files)).toEqual([]);
    expect(discoverRoutes("unknown", files)).toEqual([]);
  });
});

describe("discoverRoutes: ordering and duplicates", () => {
  test("results are deduplicated and sorted with / first", () => {
    const routes = discoverRoutes("next-app", [
      "app/zebra/page.tsx",
      "app/(a)/page.tsx",
      "app/(b)/page.tsx",
      "app/alpha/page.tsx",
    ]);
    expect(routes).toEqual(["/", "/alpha", "/zebra"]);
  });
});

describe("manifestStarter", () => {
  test("renders discovered routes with titles and empty descriptions", () => {
    const source = manifestStarter(["/", "/pricing"], options);
    expect(source).toContain('route: "/pricing"');
    expect(source).toContain('title: "Pricing"');
    expect(source).toContain('title: "Home"');
    // Descriptions stay empty on purpose: a plausible-looking wrong description
    // is the kind of thing that survives review, an empty one is not.
    expect(source).toContain('description: ""');
  });

  test("titles humanise a slug without inventing prose", () => {
    expect(manifestStarter(["/open-gym"], options)).toContain(
      'title: "Open gym"',
    );
  });

  test("with nothing discovered it emits one placeholder and says so", () => {
    const source = manifestStarter([], options);
    expect(source).toContain('route: "/"');
    expect(source).toContain("No route convention was detected");
  });

  test("the type import resolves from the manifest file's own location", () => {
    expect(manifestStarter([], options)).toContain(
      'from "./agent"',
    );
    expect(
      manifestStarter([], { dir: "app/lib/agent", manifestPath: "app/lib/agent-manifest.ts" }),
    ).toContain('from "./agent"');
  });

  test("the header states the two things that make a manifest work", () => {
    const source = manifestStarter(["/"], options);
    // Why it must be filled in, and what a target id has to match.
    expect(source).toContain("that is not in the site content");
    expect(source).toContain("data-agent-target");
    // And that this file is browser-visible, so markdown must not go in it.
    expect(source).toContain("Safe for the browser");
  });
});
