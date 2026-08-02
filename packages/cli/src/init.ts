/**
 * `agent-ui init` — copy the bundled templates into the consumer's repo, write
 * `.agent.json`, and add agent-ui's runtime dependencies to their package.json.
 * All IO lives here; the decisions are in `lib.ts`.
 */

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  detectHost,
  mountHint,
  pickRootLayout,
  routeFilePath,
  routeTemplate,
  type RouteTemplateContext,
} from "./hosts";
import {
  agentManifestPath,
  agentModelPath,
  agentModelStub,
  argvErrorMessage,
  buildAgentConfig,
  CliError,
  detectPackageManager,
  installCommand,
  mergeDependencies,
  needsNodeTypes,
  pickViteConfig,
  providerSetupHint,
  reactVersionWarning,
  styleImportSpecifier,
  TSCONFIG_FILES,
  viteEnvHint,
} from "./lib";
import { discoverRoutes, manifestStarter } from "./manifest-starter";
import { createPrompter } from "./prompt";

/** Bundled at build time by scripts/bundle-templates.ts, next to dist/. */
const templatesRoot = fileURLToPath(new URL("../templates", import.meta.url));

interface TemplateManifest {
  dependencies: Record<string, string>;
  /** Type packages the templates need to compile; merged into devDependencies. */
  devDependencies: Record<string, string>;
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.push(full);
    }
  };
  visit(root);
  return out.sort();
}

/** Directories a route convention never lives in, and that are expensive to walk. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".output",
  ".vercel",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "out",
]);

/**
 * Project-root-relative source paths, for route discovery.
 *
 * Bounded on purpose: route conventions are shallow (`app/`, `src/routes/`), and
 * an unbounded walk of someone's repository is a surprising amount of IO for a
 * feature whose whole output is a starter file. A project deep enough to exceed
 * these limits gets the placeholder manifest, which is the same thing it would
 * get from an unrecognized framework.
 */
function projectSourceFiles(root: string, maxDepth = 6, maxFiles = 4_000): string[] {
  const out: string[] = [];
  const visit = (dir: string, depth: number) => {
    if (depth > maxDepth || out.length >= maxFiles) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // Unreadable directory: not worth failing an otherwise fine init.
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        visit(join(dir, entry.name), depth + 1);
      } else if (/\.(tsx|jsx|ts|js)$/.test(entry.name)) {
        out.push(relative(root, join(dir, entry.name)).split("\\").join("/"));
      }
    }
  };
  visit(root, 0);
  return out;
}

export async function runInit(argv: string[], cliVersion: string): Promise<void> {
  let values: { dir?: string; yes?: boolean; force?: boolean };
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        dir: { type: "string", default: "src/agent" },
        yes: { type: "boolean", short: "y", default: false },
        force: { type: "boolean", default: false },
      },
    }));
  } catch (error) {
    const message = argvErrorMessage(error);
    if (message === undefined) throw error;
    throw new CliError(message);
  }
  const dir = values.dir ?? "src/agent";
  const cwd = process.cwd();

  const templatesDir = join(templatesRoot, "agent");
  const manifestPath = join(templatesRoot, "manifest.json");
  if (!existsSync(templatesDir) || !existsSync(manifestPath)) {
    throw new CliError(
      "Bundled templates are missing — this install of @tuann72/agent-ui is corrupted; reinstall it.",
    );
  }

  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    throw new CliError(
      "No package.json here — run `agent-ui init` from your project root.",
    );
  }
  const configPath = join(cwd, ".agent.json");
  if (existsSync(configPath) && !values.force) {
    throw new CliError(
      ".agent.json already exists — agent-ui is already initialized (use --force to re-scaffold).",
    );
  }
  const targetDir = resolve(cwd, dir);
  if (
    existsSync(targetDir) &&
    readdirSync(targetDir).length > 0 &&
    !values.force
  ) {
    throw new CliError(
      `${dir} already exists and is not empty (use --dir for another location, or --force to overwrite).`,
    );
  }

  const rawPkg = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(rawPkg) as Record<string, unknown>;

  // Copy templates and record install-time hashes for the future `agent-ui update`.
  const hashes: Record<string, string> = {};
  for (const source of walkFiles(templatesDir)) {
    const rel = relative(templatesDir, source).split("\\").join("/");
    const target = join(targetDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    hashes[rel] = createHash("sha256").update(readFileSync(source)).digest("hex");
  }
  const fileCount = Object.keys(hashes).length;

  writeFileSync(
    configPath,
    JSON.stringify(buildAgentConfig(cliVersion, dir, hashes), null, 2) + "\n",
  );

  // Template dependency ranges come from the bundled manifest (generated from
  // registry/package.json at build time, so they cannot drift).
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as TemplateManifest;
  // No provider adapter: `createAgentHandler` takes a `LanguageModel`, and which
  // one that is stays the consumer's decision, made in the model stub below.
  const merge = mergeDependencies(pkg, { ...manifest.dependencies });
  // Type packages land in devDependencies, so a consumer without @types/node
  // can still typecheck the server/node.ts bridge the CLI just wrote.
  const devMerge = mergeDependencies(
    merge.pkg,
    manifest.devDependencies,
    "devDependencies",
  );
  const added = { ...merge.added, ...devMerge.added };
  const kept = [...merge.kept, ...devMerge.kept];
  if (Object.keys(added).length > 0) {
    const indent = rawPkg.match(/^\{\n([ \t]+)/)?.[1] ?? "  ";
    writeFileSync(pkgPath, JSON.stringify(devMerge.pkg, null, indent) + "\n");
  }

  const src = dir.replace(/\/+$/, "");
  const pm = detectPackageManager(readdirSync(cwd));
  const exists = (file: string) => existsSync(join(cwd, file));
  const layout = pickRootLayout(exists);
  const viteConfig = pickViteConfig(exists);
  const reactWarning = reactVersionWarning(devMerge.pkg);
  const host = detectHost(exists, devMerge.pkg);

  // The compiler-visibility gap that `@types/node` in devDependencies does not
  // close, checked against the nearest config that owns the app's `types`.
  const tsconfig = TSCONFIG_FILES.find(exists);
  const pinnedTypes =
    tsconfig !== undefined &&
    needsNodeTypes(readFileSync(join(cwd, tsconfig), "utf8"));

  // The model seam. Written once and never again: it is the consumer's file to
  // edit, so an existing one is always kept, `--force` included.
  const modelPath = agentModelPath(src);
  const modelExisted = exists(modelPath);
  if (!modelExisted) {
    mkdirSync(dirname(join(cwd, modelPath)), { recursive: true });
    writeFileSync(join(cwd, modelPath), agentModelStub(pm));
  }

  const manifestStarterPath = agentManifestPath(src);
  const routePath = routeFilePath(host);
  const routeContext: RouteTemplateContext = {
    dir: src,
    modelPath,
    manifestPath: manifestStarterPath,
    routePath,
  };

  console.log(`\nAgent scaffolded into ${dir} (${fileCount} files).`);
  console.log(`Detected ${host.label}${host.layout ? ` (${host.layout})` : ""}.`);

  // The two files that turn a scaffold into a working install. Both sit beside
  // `--dir` for the same reason the model stub does, both are the consumer's to
  // edit, and neither is ever overwritten — `--force` re-scaffolds our source,
  // not their content.
  const prompter = createPrompter({ yes: values.yes ?? false });
  let routeWritten: string | undefined;
  let manifestWritten: string | undefined;
  try {
    const route = routePath ? routeTemplate(host.kind, routeContext) : undefined;
    if (routePath !== undefined && route !== undefined) {
      if (exists(routePath)) {
        console.log(`Kept your existing ${routePath}.`);
      } else if (
        await prompter.confirm(`\nWrite the API route to ${routePath}?`, true)
      ) {
        mkdirSync(dirname(join(cwd, routePath)), { recursive: true });
        writeFileSync(join(cwd, routePath), route);
        routeWritten = routePath;
      }
    }

    if (exists(manifestStarterPath)) {
      console.log(`Kept your existing ${manifestStarterPath}.`);
    } else if (
      await prompter.confirm(
        `Write a starter site manifest to ${manifestStarterPath}?`,
        true,
      )
    ) {
      const routes = discoverRoutes(host.kind, projectSourceFiles(cwd));
      mkdirSync(dirname(join(cwd, manifestStarterPath)), { recursive: true });
      writeFileSync(
        join(cwd, manifestStarterPath),
        manifestStarter(routes, { dir: src, manifestPath: manifestStarterPath }),
      );
      manifestWritten =
        routes.length > 0
          ? `${manifestStarterPath} (${routes.length} route${routes.length === 1 ? "" : "s"} discovered)`
          : `${manifestStarterPath} (no route convention detected — one placeholder entry)`;
    }
  } finally {
    prompter.close();
  }

  console.log(
    modelExisted
      ? `Kept your existing ${modelPath}.`
      : `Wrote ${modelPath} — export your model there (it throws until you do).`,
  );
  if (routeWritten !== undefined) console.log(`Wrote ${routeWritten}.`);
  if (manifestWritten !== undefined) console.log(`Wrote ${manifestWritten}.`);
  console.log("Wrote .agent.json (paths, install-time file hashes).");
  const addedNames = Object.keys(added);
  if (addedNames.length > 0) {
    console.log(`Added to package.json: ${addedNames.join(", ")}.`);
  }
  if (kept.length > 0) {
    console.log(`Already in your package.json (left untouched): ${kept.join(", ")}.`);
  }
  if (reactWarning !== undefined) {
    console.log(`\n⚠ ${reactWarning}`);
  }
  if (pinnedTypes) {
    console.log(
      `\n⚠ ${tsconfig} pins an explicit "types" array, which replaces automatic`,
    );
    console.log(
      `  @types/* pickup — so ${src}/server/node.ts will not compile on your next`,
    );
    console.log(
      `  build, even though @types/node was installed. Add "node" to that array,`,
    );
    console.log(
      `  alongside what is already there:  "types": ["vite/client", "node"]`,
    );
  }

  // What is left is only what init could not do for this project, so the list
  // shrinks as detection succeeds. A step that reads "already done" is noise;
  // a step that is missing is a broken install.
  const caveat = layout
    ? ""
    : "\n     (that path is from the project root — adjust it to the importing file).";
  const steps: string[][] = [
    [installCommand(pm)],
    [
      `Import the styles once, in ${layout ?? "your root layout"}: import "${styleImportSpecifier(src, layout)}"${caveat}`,
    ],
    [
      `Render <AgentChat api="/api/agent" currentRoute={…} navigate={…} manifest={publicManifest} />`,
      `from ${dir}, with publicManifest from ${manifestStarterPath}.`,
    ],
    [
      `Export your model from ${modelPath} — until you do, the first request throws`,
      `naming that file.`,
    ],
  ];

  steps.push(
    manifestWritten !== undefined || exists(manifestStarterPath)
      ? [
          `Fill in ${manifestStarterPath}: a description per route, and the target ids`,
          `the assistant may highlight or click. It is the assistant's entire knowledge`,
          `of your site — empty descriptions are why one answers "that is not in the`,
          `site content" to everything.`,
        ]
      : [
          `Describe your pages: a browser-safe AgentPublicManifest (routes + target ids),`,
          `then withContent(publicManifest, {...}) in a server-only module for the page`,
          `markdown. Skipping this is why an assistant answers "that is not in the site`,
          `content".`,
        ],
  );

  if (routeWritten === undefined && routePath === undefined) {
    steps.push([
      `Mount createAgentHandler on POST /api/agent (snippet below).`,
    ]);
  }

  console.log("\nNext steps:");
  steps.forEach((lines, index) => {
    console.log(`  ${index + 1}. ${lines[0]}`);
    for (const line of lines.slice(1)) console.log(`     ${line}`);
  });

  // A host with no file convention gets the snippet instead of a file.
  if (routePath === undefined) {
    console.log("");
    for (const line of mountHint(host.kind, routeContext)) console.log(line);
  }

  // Printed rather than linked: an adapter installed at `latest`, or a key Vite
  // never puts in process.env, both fail on the first message — too late to go
  // looking for a README.
  console.log("");
  for (const line of providerSetupHint(pm)) console.log(line);
  if (viteConfig !== undefined) {
    console.log("");
    for (const line of viteEnvHint(viteConfig)) console.log(line);
  }
  console.log(
    "\nDocs, manifest format, context-authoring guidance, and server-mounting examples\n(Next.js, Vite): https://github.com/tuann72/agent-ui#readme\n",
  );
}
