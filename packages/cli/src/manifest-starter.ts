/**
 * The `agent-manifest.ts` starter: route ids discovered where a framework has a
 * file convention for them, rendered into a manifest the consumer then fills in.
 *
 * Pure, like `lib.ts` and `hosts.ts` — discovery takes a list of paths that
 * `init.ts` collected, so the walk stays on the IO side and the conventions stay
 * testable without a fixture tree on disk.
 *
 * What this can and cannot do is worth being plain about. Route *ids* are
 * discoverable; titles, descriptions, and target ids are not. Nothing here reads
 * the DOM, and the manifest is the assistant's entire knowledge of the site, so
 * a starter with real routes and placeholder prose is a scaffold rather than a
 * working manifest. It exists because "write an AgentPublicManifest" is the step
 * installs skip, and an empty one is why an assistant answers "that is not in
 * the site content" to every question.
 */

import { importSpecifier, withoutExtension } from "./lib";
import type { HostKind } from "./hosts";

/** Route-group and private segments Next.js strips from the URL. */
const NEXT_IGNORED_SEGMENT = /^[(@_]/;
/** A dynamic segment in any of the conventions below. */
const DYNAMIC_SEGMENT = /^[[$:]/;

function toRoute(segments: string[]): string {
  const kept = segments.filter((segment) => segment.length > 0);
  return kept.length === 0 ? "/" : `/${kept.join("/")}`;
}

/**
 * Next.js App Router: every `page.tsx` is a route, and its directory path *is*
 * the URL once route groups `(marketing)` and private `_folders` are dropped.
 */
function discoverNextRoutes(files: string[]): string[] {
  const routes: string[] = [];
  for (const file of files) {
    const match = /^(?:src\/)?app\/(.*)page\.(tsx|jsx|ts|js)$/.exec(file);
    if (match === null) continue;
    const segments = (match[1] ?? "").split("/").filter(Boolean);
    if (segments.some((segment) => DYNAMIC_SEGMENT.test(segment))) continue;
    routes.push(toRoute(segments.filter((s) => !NEXT_IGNORED_SEGMENT.test(s))));
  }
  return routes;
}

/**
 * TanStack Router file routes: `index.tsx` is the directory's own route,
 * `about.tsx` is `/about`. `__root` and `-`-prefixed files are not routes.
 */
function discoverTanStackRoutes(files: string[]): string[] {
  const routes: string[] = [];
  for (const file of files) {
    const match = /^(?:src|app)\/routes\/(.+)\.(tsx|jsx)$/.exec(file);
    if (match === null) continue;
    const segments = (match[1] ?? "").split("/");
    // Checked on every segment, not just the file name: `-components/card.tsx`
    // is an excluded *directory*, and TanStack treats the whole subtree as
    // non-routable.
    if (segments.some((s) => s.startsWith("__") || s.startsWith("-"))) continue;
    if (segments.some((segment) => DYNAMIC_SEGMENT.test(segment))) continue;
    const last = segments[segments.length - 1] ?? "";
    routes.push(toRoute(last === "index" ? segments.slice(0, -1) : segments));
  }
  return routes;
}

/**
 * Route ids for a host, or an empty list when it has no convention to read.
 *
 * React Router v7 is deliberately in the empty case: its routes are declared in
 * `routes.ts` as *code*, and guessing at them by globbing `app/routes/` gets
 * flat-route escapes and layout nesting wrong. A starter with a wrong route in
 * it is worse than one with a placeholder, because `withContent` throws on a
 * route the public manifest does not declare — the consumer would be debugging
 * our guess rather than writing their own.
 */
export function discoverRoutes(kind: HostKind, files: string[]): string[] {
  const found =
    kind === "next-app"
      ? discoverNextRoutes(files)
      : kind === "tanstack-start"
        ? discoverTanStackRoutes(files)
        : [];
  return [...new Set(found)].sort((a, b) =>
    a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b),
  );
}

function titleFor(route: string): string {
  if (route === "/") return "Home";
  const last = route.split("/").filter(Boolean).at(-1) ?? "";
  const words = last.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The starter file's text.
 *
 * Every discovered route lands with an empty description and no targets, and the
 * header says why that matters: this is the file that decides what the assistant
 * knows. Descriptions are left blank rather than auto-filled from the route name
 * — a plausible-looking wrong description is the failure that survives review,
 * whereas an empty string is visibly unfinished.
 */
export function manifestStarter(
  routes: string[],
  options: { dir: string; manifestPath: string },
): string {
  const specifier = importSpecifier(
    withoutExtension(options.dir),
    options.manifestPath,
  );
  const discovered = routes.length > 0;
  const entries = (discovered ? routes : ["/"])
    .map(
      (route) => `    {
      route: ${JSON.stringify(route)},
      title: ${JSON.stringify(titleFor(route))},
      description: "",
      targets: [],
    },`,
    )
    .join("\n");

  const preamble = discovered
    ? ` * Routes below were discovered from your project's file conventions. Titles
 * are guesses and descriptions are empty — both are read by the model, so fill
 * them in.`
    : ` * No route convention was detected for this project, so the list below is a
 * placeholder. Add one entry per page you want the assistant to know about.`;

  return `import type { AgentPublicManifest } from "${specifier}";

/**
 * What the assistant knows about this site.
 *
${preamble}
 *
 * This is the assistant's *entire* knowledge of your pages — nothing is crawled
 * from the DOM. A route that is not here does not exist to it, and an empty
 * manifest is why an assistant answers "that is not in the site content" to
 * every question.
 *
 * Safe for the browser: route ids, titles, descriptions, and target ids only.
 * Page markdown is attached server-side with \`withContent\` in your API route,
 * so it never ships to the client.
 *
 * \`targets\` are the elements the assistant may highlight or click. Each id must
 * match a \`data-agent-target\` attribute on the page:
 *
 *     <button data-agent-target="book-trial">Book a trial</button>
 *
 * Add \`interactive: true\` only to elements it may *click*. Highlightable never
 * implies clickable, and clicking asks for approval unless the user turned that
 * off.
 */
export const publicManifest: AgentPublicManifest = {
  routes: [
${entries}
  ],
};
`;
}
