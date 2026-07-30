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
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  buildAgentConfig,
  CliError,
  detectPackageManager,
  installCommand,
  isProviderId,
  mergeDependencies,
  noProviderHint,
  PROVIDERS,
  type ProviderId,
} from "./lib";

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

async function chooseProvider(interactive: boolean): Promise<ProviderId | "none"> {
  if (!interactive) return "none";
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (
      await rl.question(
        "Add a provider adapter to your dependencies? (openai / anthropic / google / none) [none]: ",
      )
    )
      .trim()
      .toLowerCase();
    if (answer === "" || answer === "none") return "none";
    if (isProviderId(answer)) return answer;
    throw new CliError(
      `Unknown provider "${answer}" — expected openai, anthropic, google, or none.`,
    );
  } finally {
    rl.close();
  }
}

export async function runInit(argv: string[], cliVersion: string): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      dir: { type: "string", default: "src/agent" },
      provider: { type: "string" },
      yes: { type: "boolean", short: "y", default: false },
      force: { type: "boolean", default: false },
    },
  });
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

  let provider: ProviderId | "none";
  if (values.provider !== undefined) {
    const flag = values.provider.toLowerCase();
    if (flag !== "none" && !isProviderId(flag)) {
      throw new CliError(
        `Unknown provider "${values.provider}" — expected openai, anthropic, google, or none.`,
      );
    }
    provider = flag as ProviderId | "none";
  } else {
    provider = await chooseProvider(
      Boolean(process.stdin.isTTY) && !values.yes,
    );
  }

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
    JSON.stringify(buildAgentConfig(cliVersion, dir, provider, hashes), null, 2) +
      "\n",
  );

  // Template dependency ranges come from the bundled manifest (generated from
  // registry/package.json at build time, so they cannot drift).
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as TemplateManifest;
  const wanted = { ...manifest.dependencies };
  if (provider !== "none") {
    wanted[PROVIDERS[provider].pkg] = PROVIDERS[provider].range;
  }
  const rawPkg = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(rawPkg) as Record<string, unknown>;
  const merge = mergeDependencies(pkg, wanted);
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

  const hasReact = Boolean(devMerge.pkg.dependencies?.react);
  const pm = detectPackageManager(readdirSync(cwd));

  console.log(`\nAgent scaffolded into ${dir} (${fileCount} files).`);
  console.log("Wrote .agent.json (paths, provider, install-time file hashes).");
  const addedNames = Object.keys(added);
  if (addedNames.length > 0) {
    console.log(`Added to package.json: ${addedNames.join(", ")}.`);
  }
  if (kept.length > 0) {
    console.log(`Already in your package.json (left untouched): ${kept.join(", ")}.`);
  }
  if (!hasReact) {
    console.log("\n⚠ No react dependency found — agent-ui requires React 19.");
  }

  const src = dir.replace(/\/+$/, "");
  console.log("\nNext steps:");
  console.log(`  1. ${installCommand(pm)}`);
  console.log(
    `  2. Import the styles once (e.g. in your root layout): import "./${src}/styles.css"`,
  );
  console.log(
    `  3. Render <AgentChat api="/api/agent" currentRoute={…} navigate={…} manifest={…} /> from ${dir}.`,
  );
  console.log(
    "  4. Describe your pages: a browser-safe AgentPublicManifest (routes + target ids),",
  );
  console.log(
    `     then withContent(publicManifest, {...}) in a server-only module for the page markdown.`,
  );
  console.log(
    "     Skipping this is why an assistant answers \"that is not in the site content\".",
  );
  console.log(
    `  5. Mount createAgentHandler (from ${src}/server) on POST /api/agent.`,
  );
  if (provider !== "none") {
    const info = PROVIDERS[provider];
    console.log(
      `     Wire the model there: import { ${info.importName} } from "${info.pkg}" and pass`,
    );
    console.log(
      `     model: ${info.importName}("${info.defaultModel}") to createAgentHandler.`,
    );
    console.log(
      `  6. Put ${info.env}=... in a server-side .env at your project root, then restart.`,
    );
    console.log(
      "     Never prefix it VITE_ or NEXT_PUBLIC_ — those publish the value to the browser.",
    );
  } else {
    console.log("");
    for (const line of noProviderHint(pm)) console.log(line);
  }
  console.log(
    "\nDocs, manifest format, context-authoring guidance, and server-mounting examples\n(Next.js, Vite): https://github.com/tuann72/agent-ui#readme\n",
  );
}
