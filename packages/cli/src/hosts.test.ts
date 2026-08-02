import { describe, expect, test } from "bun:test";
import {
  detectHost,
  HOSTS,
  mountHint,
  pickRootLayout,
  ROOT_LAYOUT_FILES,
  routeFilePath,
  routeTemplate,
  type HostKind,
  type RouteTemplateContext,
} from "./hosts";
import { styleImportSpecifier } from "./lib";

const present =
  (...files: string[]) =>
  (file: string) =>
    files.includes(file);

const context = (routePath?: string): RouteTemplateContext => ({
  dir: "src/agent",
  modelPath: "src/agent-model.ts",
  manifestPath: "src/agent-manifest.ts",
  routePath,
});

describe("detectHost", () => {
  test("identifies each framework from its root layout", () => {
    expect(detectHost(present("app/layout.tsx")).kind).toBe("next-app");
    expect(detectHost(present("app/root.tsx")).kind).toBe("react-router");
    expect(detectHost(present("src/routes/__root.tsx")).kind).toBe(
      "tanstack-start",
    );
    expect(detectHost(present("src/main.tsx")).kind).toBe("vite-spa");
  });

  test("a framework root outranks the generic entry it ships beside", () => {
    // React Router and TanStack projects routinely keep a src/main.tsx around.
    // Detecting the SPA there would write no route file for a project that has
    // a perfectly good place to put one.
    expect(detectHost(present("src/main.tsx", "app/root.tsx")).kind).toBe(
      "react-router",
    );
    expect(
      detectHost(present("src/App.tsx", "src/routes/__root.tsx")).kind,
    ).toBe("tanstack-start");
    expect(detectHost(present("src/main.tsx", "app/layout.tsx")).kind).toBe(
      "next-app",
    );
  });

  test("falls back to declared dependencies when no layout matches", () => {
    // Hono is the case this exists for: it has no file convention at all, so a
    // layout probe can never find it.
    const hono = detectHost(present(), { dependencies: { hono: "^4" } });
    expect(hono.kind).toBe("hono");
    expect(hono.layout).toBeUndefined();

    expect(detectHost(present(), { devDependencies: { vite: "^7" } }).kind).toBe(
      "vite-spa",
    );
  });

  test("a layout beats a dependency that disagrees with it", () => {
    // Next projects declare vite in devDependencies more often than you would
    // hope (test runners, tooling). The file on disk is the stronger signal.
    const detected = detectHost(present("app/layout.tsx"), {
      devDependencies: { vite: "^7" },
    });
    expect(detected.kind).toBe("next-app");
  });

  test("reports unknown rather than guessing", () => {
    const detected = detectHost(present("index.html"), {});
    expect(detected.kind).toBe("unknown");
    expect(routeFilePath(detected)).toBeUndefined();
  });
});

describe("routeFilePath", () => {
  test("anchors the route to the directory the layout was found in", () => {
    // A project with src/app/layout.tsx puts routes under src/app/ too; writing
    // to app/api/ would create a second, unrouted tree next to the real one.
    expect(routeFilePath(detectHost(present("app/layout.tsx")))).toBe(
      "app/api/agent/route.ts",
    );
    expect(routeFilePath(detectHost(present("src/app/layout.tsx")))).toBe(
      "src/app/api/agent/route.ts",
    );
    expect(routeFilePath(detectHost(present("app/root.tsx")))).toBe(
      "app/routes/api.agent.ts",
    );
    expect(routeFilePath(detectHost(present("src/routes/__root.tsx")))).toBe(
      "src/routes/api/agent.ts",
    );
  });

  test("hosts without a file convention get no path", () => {
    // Hono mounts on an app object and a Vite SPA has no server; both are files
    // that already exist with the consumer's code in them, which init does not
    // edit.
    expect(routeFilePath(detectHost(present(), { dependencies: { hono: "^4" } }))).toBeUndefined();
    expect(routeFilePath(detectHost(present("src/main.tsx")))).toBeUndefined();
  });
});

describe("routeTemplate", () => {
  const generated: HostKind[] = ["next-app", "react-router", "tanstack-start"];

  test("every generated route imports the handler, model, and manifest", () => {
    for (const kind of generated) {
      const source = routeTemplate(kind, context("app/api/agent/route.ts"));
      expect(source).toBeDefined();
      expect(source).toContain("createAgentHandler");
      expect(source).toContain("withContent");
      expect(source).toContain("{ model }");
      expect(source).toContain("{ publicManifest }");
    }
  });

  test("imports are relative to the route file, not the project root", () => {
    const source = routeTemplate("next-app", context("app/api/agent/route.ts"))!;
    // Three levels up from app/api/agent/ back to the project root, then down.
    expect(source).toContain('from "../../../src/agent/server"');
    expect(source).toContain('from "../../../src/agent-model"');
    expect(source).not.toContain('"src/agent/server"');
  });

  test("a route file deeper in the tree gets a longer path, not the same one", () => {
    const shallow = routeTemplate("next-app", context("app/api/agent/route.ts"))!;
    const deep = routeTemplate("next-app", context("src/app/api/agent/route.ts"))!;
    expect(shallow).not.toBe(deep);
    expect(deep).toContain('from "../../../agent/server"');
  });

  test("each host exports the entry point its router looks for", () => {
    expect(routeTemplate("next-app", context())).toContain(
      "export async function POST",
    );
    expect(routeTemplate("react-router", context())).toContain(
      "export async function action",
    );
    expect(routeTemplate("tanstack-start", context())).toContain(
      "createServerFileRoute",
    );
  });

  test("no template is produced for a host init does not write files for", () => {
    expect(routeTemplate("hono", context())).toBeUndefined();
    expect(routeTemplate("vite-spa", context())).toBeUndefined();
    expect(routeTemplate("unknown", context())).toBeUndefined();
  });

  test("the content map is present but empty, and commented", () => {
    // withContent throws on a route the public manifest does not declare, so a
    // pre-filled map would fail the first request on a project whose routes we
    // guessed. Empty is the only safe default.
    const source = routeTemplate("next-app", context())!;
    expect(source).toContain("withContent(publicManifest, {");
    expect(source).toMatch(/\/\/\s*"\/":/);
  });
});

describe("mountHint", () => {
  test("Hono is told to use the raw Request off the context", () => {
    const lines = mountHint("hono", context()).join("\n");
    expect(lines).toContain("c.req.raw");
    expect(lines).toContain('app.post("/api/agent"');
  });

  test("a Vite SPA is pointed at the Node bridge, and told it is dev only", () => {
    const lines = mountHint("vite-spa", context()).join("\n");
    expect(lines).toContain("toNodeHandler");
    expect(lines).toContain("configureServer");
    // The trap: this middleware does not exist in a production build.
    expect(lines).toContain("dev only");
  });

  test("an unknown host is told the handler is Fetch-standard", () => {
    const lines = mountHint("unknown", context()).join("\n");
    expect(lines).toContain("Fetch-standard");
    expect(lines).toContain("POST /api/agent");
  });

  test("every hint is complete: nothing it names is left undefined", () => {
    // A snippet referencing a bare `manifest` is one the reader has to finish
    // before it compiles — the exact gap these hints exist to close.
    for (const kind of ["hono", "vite-spa", "unknown"] as const) {
      const lines = mountHint(kind, context()).join("\n");
      expect(lines).toContain("import { publicManifest }");
      expect(lines).toContain("withContent(publicManifest");
      expect(lines).toContain("import { model }");
      expect(lines).toContain("createAgentHandler");
    }
  });
});

describe("generated routes are real TypeScript", () => {
  const transpiler = new Bun.Transpiler({ loader: "ts" });

  test("every template parses", () => {
    // These strings are never compiled in this repo — they are written into
    // someone else's project, where a syntax error surfaces as a build failure
    // in a file they did not write.
    for (const kind of ["next-app", "react-router", "tanstack-start"] as const) {
      const source = routeTemplate(kind, context("app/api/agent/route.ts"))!;
      expect(() => transpiler.transformSync(source)).not.toThrow();
    }
  });

  test("only TanStack needs a framework import to compile", () => {
    // Next and React Router routes are typed off `Request`, a global. That is
    // what lets CI typecheck them without installing either framework, so keep
    // it: reaching for `NextRequest` or `ActionFunctionArgs` would buy nothing
    // and cost the only coverage these files get.
    for (const kind of ["next-app", "react-router"] as const) {
      const imports = transpiler.scanImports(
        routeTemplate(kind, context("app/api/agent/route.ts"))!,
      );
      expect(imports.every((i) => i.path.startsWith("."))).toBe(true);
    }
    const tanstack = transpiler.scanImports(
      routeTemplate("tanstack-start", context("src/routes/api/agent.ts"))!,
    );
    expect(tanstack.some((i) => i.path === "@tanstack/react-start/server")).toBe(
      true,
    );
  });
});

describe("the host table itself", () => {
  test("pickRootLayout still resolves every layout the table lists", () => {
    for (const file of ROOT_LAYOUT_FILES) {
      expect(pickRootLayout(present(file))).toBe(file);
      expect(styleImportSpecifier("src/agent", file)).toMatch(
        /^\.{1,2}\/.*styles\.css$/,
      );
    }
  });

  test("a host that generates a route file also declares layouts to anchor it", () => {
    // routeFile() derives its path from the matched layout, so a host with a
    // generator and no layouts could never produce one.
    for (const host of HOSTS) {
      if (host.routeFile !== undefined) {
        expect(host.layouts.length).toBeGreaterThan(0);
      }
    }
  });

  test("no layout path is claimed by two hosts", () => {
    // Detection returns the first match, so a shared path would make one host
    // unreachable depending only on table order.
    const seen = new Set<string>();
    for (const host of HOSTS) {
      for (const layout of host.layouts) {
        expect(seen.has(layout)).toBe(false);
        seen.add(layout);
      }
    }
  });
});
