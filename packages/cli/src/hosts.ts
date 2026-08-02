/**
 * Which framework this project is, and what mounting the handler looks like
 * there.
 *
 * Pure decisions only, like `lib.ts`: detection takes an `exists` probe and a
 * parsed `package.json`, and route generation returns file *text*. `init.ts`
 * remains the only module that touches the filesystem.
 *
 * This table replaces what used to be a flat list of root-layout paths. The
 * knowledge was already here — `app/layout.tsx` meant Next, `src/routes/__root.tsx`
 * meant TanStack — it was just keyed to "where does a stylesheet get imported"
 * rather than to the framework, so nothing else could use it. Mounting the
 * handler is the step that actually decides whether an install works, and it was
 * the one step init could only describe in prose.
 */

import { posix } from "node:path";
import { importSpecifier, withoutExtension } from "./lib";

export type HostKind =
  | "next-app"
  | "react-router"
  | "tanstack-start"
  | "hono"
  | "vite-spa"
  | "unknown";

export interface HostDefinition {
  kind: HostKind;
  /** Shown to the user when init reports what it detected. */
  label: string;
  /**
   * Root layout candidates, outermost first. Presence identifies the host *and*
   * anchors every generated path, since a project with `src/app/layout.tsx` puts
   * its routes under `src/app/` too.
   */
  layouts: readonly string[];
  /** Dependency names that identify the host when no layout file matches. */
  packages: readonly string[];
  /**
   * Where the API route goes, derived from the matched layout. `undefined` means
   * the host has no file convention to write into — Hono mounts on an app object
   * the consumer owns, and a Vite SPA has no server at all — so init prints the
   * snippet instead of guessing a location.
   */
  routeFile?: (layout: string) => string;
}

/**
 * Ordered: the first host whose layout exists wins. A framework project often
 * still carries a `src/main.tsx` (migration leftovers, or a router SPA that has
 * both), so every framework must sort above the generic Vite tail or a Next app
 * gets detected as a plain SPA.
 */
export const HOSTS: readonly HostDefinition[] = [
  {
    kind: "next-app",
    label: "Next.js (App Router)",
    layouts: [
      "app/layout.tsx",
      "app/layout.jsx",
      "src/app/layout.tsx",
      "src/app/layout.jsx",
    ],
    packages: ["next"],
    // app/layout.tsx -> app/api/agent/route.ts
    routeFile: (layout) => `${posix.dirname(layout)}/api/agent/route.ts`,
  },
  {
    kind: "react-router",
    label: "React Router v7 / Remix",
    layouts: ["app/root.tsx", "app/root.jsx"],
    packages: ["@react-router/node", "react-router", "@remix-run/node"],
    // Flat-routes convention: the dots become slashes in the URL.
    routeFile: (layout) => `${posix.dirname(layout)}/routes/api.agent.ts`,
  },
  {
    kind: "tanstack-start",
    label: "TanStack Start",
    layouts: ["src/routes/__root.tsx", "app/routes/__root.tsx"],
    packages: ["@tanstack/react-start", "@tanstack/start"],
    // The route file sits beside __root.tsx in the same routes/ tree.
    routeFile: (layout) => `${posix.dirname(layout)}/api/agent.ts`,
  },
  {
    kind: "hono",
    label: "Hono",
    layouts: [],
    packages: ["hono"],
  },
  {
    kind: "vite-spa",
    label: "Vite SPA",
    layouts: ["src/main.tsx", "src/main.ts", "src/index.tsx", "src/App.tsx"],
    packages: ["vite"],
  },
];

/** Every root layout any host knows about, in host precedence order. */
export const ROOT_LAYOUT_FILES: readonly string[] = HOSTS.flatMap(
  (host) => host.layouts,
);

export interface DetectedHost {
  kind: HostKind;
  label: string;
  /** The layout that matched, if detection went through a file. */
  layout?: string;
  definition?: HostDefinition;
}

const UNKNOWN: DetectedHost = { kind: "unknown", label: "unknown framework" };

interface DependencyBag {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * The project's framework, by layout file first and declared dependency second.
 *
 * A layout file is the stronger signal because it pins *where* generated paths
 * go, which a dependency name cannot. The dependency pass exists for Hono, which
 * has no file convention at all, and for a project whose layout sits somewhere
 * this table does not list — knowing the framework is still worth something even
 * when init cannot place a file.
 */
export function detectHost(
  exists: (file: string) => boolean,
  pkg: DependencyBag = {},
): DetectedHost {
  for (const host of HOSTS) {
    const layout = host.layouts.find(exists);
    if (layout !== undefined) {
      return { kind: host.kind, label: host.label, layout, definition: host };
    }
  }
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const host of HOSTS) {
    if (host.packages.some((name) => name in declared)) {
      return { kind: host.kind, label: host.label, definition: host };
    }
  }
  return UNKNOWN;
}

/** The first candidate that exists, or `undefined`. Kept for the style-import hint. */
export function pickRootLayout(
  exists: (file: string) => boolean,
): string | undefined {
  return ROOT_LAYOUT_FILES.find(exists);
}

/**
 * Where this host's API route belongs, or `undefined` when it has no convention
 * to write into and init should print the snippet instead.
 */
export function routeFilePath(host: DetectedHost): string | undefined {
  if (host.definition?.routeFile === undefined || host.layout === undefined) {
    return undefined;
  }
  return host.definition.routeFile(host.layout);
}

export interface RouteTemplateContext {
  /** Scaffolded source directory, project-root-relative (`src/agent`). */
  dir: string;
  /** The model stub, project-root-relative (`src/agent-model.ts`). */
  modelPath: string;
  /** The manifest starter, project-root-relative (`src/agent-manifest.ts`). */
  manifestPath: string;
  /** The route file itself, so imports resolve from it. */
  routePath?: string;
}

/** The four imports every generated route shares, already made relative. */
function routeImports(context: RouteTemplateContext): string {
  const from = context.routePath;
  const server = importSpecifier(`${context.dir}/server`, from);
  const model = importSpecifier(withoutExtension(context.modelPath), from);
  const manifest = importSpecifier(withoutExtension(context.manifestPath), from);
  return `import { createAgentHandler, withContent } from "${server}";
import { model } from "${model}";
import { publicManifest } from "${manifest}";`;
}

/**
 * The body every host shares: attach page content to the public manifest, then
 * build the handler once at module scope.
 *
 * `withContent` is called here rather than in the manifest starter because it is
 * the server-only half. The starter ships route ids and target ids to the
 * browser; the markdown bodies must not follow them there, and the surest way to
 * keep that true is for the file that holds them to be one only a route imports.
 */
function routeBody(): string {
  return `/**
 * Page content for the assistant, attached server-side.
 *
 * Everything the assistant knows about this site comes from here — nothing is
 * crawled from the DOM. An empty body is why an assistant answers "that is not
 * in the site content" to everything.
 */
const manifest = withContent(publicManifest, {
  // "/": { body: "Markdown describing this page.", keywords: ["home"] },
});

const handler = createAgentHandler({ model, manifest });`;
}

/** The generated route file for a host, or `undefined` if it has no file convention. */
export function routeTemplate(
  kind: HostKind,
  context: RouteTemplateContext,
): string | undefined {
  const header = `${routeImports(context)}\n\n${routeBody()}\n`;

  if (kind === "next-app") {
    return `${header}
export async function POST(request: Request): Promise<Response> {
  return handler(request);
}
`;
  }

  if (kind === "react-router") {
    return `${header}
// Resource route: no default export, so React Router never renders it.
export async function action({ request }: { request: Request }) {
  return handler(request);
}
`;
  }

  if (kind === "tanstack-start") {
    return `import { createServerFileRoute } from "@tanstack/react-start/server";
${header}
export const ServerRoute = createServerFileRoute("/api/agent").methods({
  POST: ({ request }) => handler(request),
});
`;
  }

  return undefined;
}

/**
 * The mount snippet for a host init cannot write a file for, as printed lines.
 *
 * Hono owns its `app` object and a Vite SPA has no server process of its own, so
 * in both cases the handler goes into a file that already exists and already has
 * the consumer's code in it. Writing into those is the edit init does not make
 * (invariant 17): it prints, and the paste is one line.
 */
export function mountHint(
  kind: HostKind,
  context: RouteTemplateContext,
): string[] {
  const server = importSpecifier(`${context.dir}/server`, undefined);
  const model = importSpecifier(withoutExtension(context.modelPath), undefined);
  const manifest = importSpecifier(
    withoutExtension(context.manifestPath),
    undefined,
  );
  // The same three imports and the same `withContent` call the generated route
  // files carry. A snippet that referenced a bare `manifest` would be one the
  // reader has to finish before it compiles, which is the gap this whole phase
  // exists to close.
  const preamble = [
    `    import { createAgentHandler, withContent } from "${server}";`,
    `    import { model } from "${model}";`,
    `    import { publicManifest } from "${manifest}";`,
    "",
    "    const manifest = withContent(publicManifest, {});",
  ];

  if (kind === "hono") {
    return [
      "  Mount the handler on your Hono app:",
      "",
      ...preamble,
      "    const handler = createAgentHandler({ model, manifest });",
      "",
      '    app.post("/api/agent", (c) => handler(c.req.raw));',
    ];
  }

  if (kind === "vite-spa") {
    return [
      "  A Vite SPA has no server route, so the handler runs as dev-server",
      "  middleware through the bundled Node bridge. Add to vite.config.ts:",
      "",
      ...preamble,
      `    import { toNodeHandler } from "${server}/node";`,
      "",
      "    const agent = toNodeHandler(createAgentHandler({ model, manifest }));",
      "",
      "    // in plugins:",
      "    {",
      '      name: "agent-api",',
      "      configureServer(server) {",
      '        server.middlewares.use("/api/agent", agent);',
      "      },",
      "    }",
      "",
      "  Production needs a real server — this middleware is dev only.",
    ];
  }

  return [
    "  No framework detected, so init did not write a route. createAgentHandler",
    "  is a Fetch-standard (Request) => Response, so mount it wherever your",
    "  server accepts one, at POST /api/agent:",
    "",
    ...preamble,
    "    const handler = createAgentHandler({ model, manifest });",
  ];
}
