/**
 * Pure decision logic for the agent-ui CLI — no fs, no process, no prompts.
 * Everything here is unit-tested with plain values; `init.ts` supplies the IO.
 */

import { posix } from "node:path";

/** A user-facing failure with a message safe to print without a stack trace. */
export class CliError extends Error {}

/**
 * The `init` flags, rendered once. `index.ts` interpolates this into `--help`
 * and `argvErrorMessage` prints it under a rejected flag, so the help text and
 * the error can never disagree about which flags exist.
 */
export const INIT_OPTIONS_HELP = `  --dir <path>        Where to copy the agent-ui source (default: src/agent)
  -y, --yes           Accept defaults, never prompt
  --force             Overwrite an existing .agent.json / non-empty --dir`;

/** The argv failures `parseArgs` raises. Anything else is a real bug, not input. */
const PARSE_ARGS_CODES = new Set([
  "ERR_PARSE_ARGS_UNKNOWN_OPTION",
  "ERR_PARSE_ARGS_INVALID_OPTION_VALUE",
  "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL",
]);

/**
 * Turn a `parseArgs` failure into a message worth printing.
 *
 * `parseArgs` throws a plain `TypeError`, which the entry point rethrows and
 * Node renders as a stack trace through its own internals — so every mistyped
 * flag looked like a crash in the CLI rather than a mistake in the command.
 * Bad input is the one thing a CLI can count on receiving.
 *
 * Returns `undefined` for anything that is not an argv error, so callers rethrow
 * what they cannot explain rather than dressing a real bug up as user error.
 */
export function argvErrorMessage(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== "string" || !PARSE_ARGS_CODES.has(code)) return undefined;
  // Node appends "To specify a positional argument starting with a '-', place
  // it at the end ... after '--'", which is wrong here: init takes no
  // positionals, so following it produces a second, more confusing error.
  const raw = String((error as Error).message);
  const detail = raw.split(". ")[0] ?? raw;
  return `${detail.replace(/\.$/, "")}.\n\nOptions for init:\n${INIT_OPTIONS_HELP}`;
}

/**
 * Reference data for the adapters a consumer can install. The CLI never installs
 * one and never writes provider code — the model is supplied by the consumer at
 * the `agent-model.ts` seam — so this exists purely to print accurate install
 * commands and env var names.
 */
export interface ProviderInfo {
  /** Adapter package installed in the *consumer's* project (invariant 12 — never a dependency of this repo). */
  pkg: string;
  /** Semver range compatible with AI SDK v5. `latest` adapters target a newer `ai` major and fail. */
  range: string;
  /** Env var the adapter reads server-side. */
  env: string;
  /** Default provider instance exported by the adapter package. */
  importName: string;
  /** Model id for the example line — rolling aliases where the provider offers them, so hints never retire. */
  exampleModel: string;
  label: string;
}

export const PROVIDERS = {
  openai: {
    pkg: "@ai-sdk/openai",
    range: "^2",
    env: "OPENAI_API_KEY",
    importName: "openai",
    exampleModel: "gpt-4o-mini",
    label: "OpenAI",
  },
  anthropic: {
    pkg: "@ai-sdk/anthropic",
    range: "^2",
    env: "ANTHROPIC_API_KEY",
    importName: "anthropic",
    exampleModel: "claude-haiku-4-5",
    label: "Anthropic",
  },
  google: {
    pkg: "@ai-sdk/google",
    range: "^2",
    env: "GOOGLE_GENERATIVE_AI_API_KEY",
    importName: "google",
    exampleModel: "gemini-flash-latest",
    label: "Google (Gemini)",
  },
} as const satisfies Record<string, ProviderInfo>;

const TEMPLATE_EXTENSIONS = [".ts", ".tsx", ".css"];

/** Windows separators to posix, so path math and matching work off one shape. */
function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Which registry files ship as templates (invariant 13): runtime source only,
 * by extension allowlist, never tests or the bun-test preload.
 */
export function isTemplateFile(relPath: string): boolean {
  const base = toPosix(relPath).split("/").at(-1) ?? relPath;
  if (base === "test-setup.ts") return false;
  if (/\.(test|spec|e2e)\./.test(base)) return false;
  return TEMPLATE_EXTENSIONS.some((ext) => base.endsWith(ext));
}

interface PackageJsonLike {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface DependencyMerge {
  pkg: PackageJsonLike;
  /** name -> range actually added to `dependencies`. */
  added: Record<string, string>;
  /** names already present somewhere in the consumer's manifest, left alone. */
  kept: string[];
}

/**
 * Add agent-ui's deps to a consumer package.json object, into `section`. A
 * dependency the consumer already declares anywhere (deps/devDeps/peerDeps)
 * keeps its range — the CLI never overwrites version choices it does not own,
 * and never moves one between sections.
 */
export function mergeDependencies(
  pkg: PackageJsonLike,
  wanted: Record<string, string>,
  section: "dependencies" | "devDependencies" = "dependencies",
): DependencyMerge {
  const out = structuredClone(pkg);
  const added: Record<string, string> = {};
  const kept: string[] = [];
  const declared = (name: string) =>
    Boolean(
      out.dependencies?.[name] ??
        out.devDependencies?.[name] ??
        out.peerDependencies?.[name],
    );
  for (const [name, range] of Object.entries(wanted)) {
    if (declared(name)) {
      kept.push(name);
    } else {
      out[section] = { ...out[section], [name]: range };
      added[name] = range;
    }
  }
  return { pkg: out, added, kept };
}

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

/** Pick the consumer's package manager from the lockfiles in their root. */
export function detectPackageManager(rootFiles: string[]): PackageManager {
  const names = new Set(rootFiles);
  if (names.has("bun.lock") || names.has("bun.lockb")) return "bun";
  if (names.has("pnpm-lock.yaml")) return "pnpm";
  if (names.has("yarn.lock")) return "yarn";
  return "npm";
}

export function installCommand(pm: PackageManager): string {
  return pm === "npm" ? "npm install" : `${pm} install`;
}

/** Command adding one package spec. Quoted: `^` in the range trips some shells. */
export function addCommand(pm: PackageManager, spec: string): string {
  const verb = pm === "npm" ? "install" : "add";
  return `${pm} ${verb} "${spec}"`;
}

/**
 * One `install <adapter>  # <label> — reads <ENV_VAR>` line per provider, with
 * the comments aligned into a column. Shared by the printed hint and the model
 * stub's header, so the two can never drift.
 */
function providerInstallLines(pm: PackageManager): string[] {
  const commands = Object.values<ProviderInfo>(PROVIDERS).map((info) => ({
    command: addCommand(pm, `${info.pkg}@${info.range}`),
    info,
  }));
  const width = Math.max(...commands.map((entry) => entry.command.length));
  return commands.map(
    ({ command, info }) =>
      `${command.padEnd(width)}  # ${info.label} — reads ${info.env}`,
  );
}

/**
 * The adapter install commands, printed on every run.
 *
 * agent-ui does not choose a provider, install an adapter, or generate provider
 * code: `createAgentHandler` takes a `LanguageModel`, and which one it is stays
 * the consumer's decision. What the CLI still owes them is the *pinned* range —
 * installing an adapter at `latest` pairs with a newer `ai` major and throws
 * AI_UnsupportedModelVersionError against the templates' ai@^5, and that trap is
 * invisible until the first request.
 */
export function providerSetupHint(pm: PackageManager): string[] {
  const lines = [
    "Install one provider adapter — pinned to the AI SDK 5-compatible major",
    "below. `latest` targets a newer `ai` major and fails against the templates'",
    "ai@^5 with AI_UnsupportedModelVersionError.",
    "",
  ];
  for (const line of providerInstallLines(pm)) lines.push(`    ${line}`);
  lines.push(
    "",
    "Put that adapter's key in a server-side .env at your project root. Never",
    "prefix it VITE_ or NEXT_PUBLIC_ — those prefixes publish the value to the",
    "browser. The adapter reads process.env itself; you never pass the key to",
    "createAgentHandler.",
  );
  return lines;
}

/**
 * Where the model stub goes: a sibling of the scaffolded source, not a file
 * inside it.
 *
 * `--dir` is hash-tracked in `.agent.json` so a future `agent-ui update` can
 * tell edited files from untouched ones, which makes it the wrong home for a
 * file whose whole purpose is to be edited. This is the split `theme.css` and
 * `styles.css` already draw: the file you edit and the file we rewrite are
 * different files.
 */
export function siblingPath(dir: string, name: string): string {
  const parent = posix.dirname(toPosix(dir).replace(/\/+$/, ""));
  return parent === "." ? name : `${parent}/${name}`;
}

export function agentModelPath(dir: string): string {
  return siblingPath(dir, "agent-model.ts");
}

/**
 * The public manifest starter, beside `--dir` for the same reason the model stub
 * is: describing your pages is the other edit every install needs, and a
 * hash-tracked directory is the wrong home for a file whose purpose is to grow.
 */
export function agentManifestPath(dir: string): string {
  return siblingPath(dir, "agent-manifest.ts");
}

/**
 * Contents of the model stub — the one file a consumer must edit before the
 * assistant can answer anything.
 *
 * It throws rather than exporting a cast-from-null placeholder. Both fail on an
 * unconfigured install; only one says why. The alternative surfaces as an
 * SDK-internal error on the first message, several layers from the file that
 * needs the edit.
 *
 * The throw is deferred to first property access rather than run at module
 * scope. A Vite SPA mounts the handler in `vite.config.ts`, which Vite evaluates
 * before every command it has — so a top-level throw here failed `vite dev` and
 * `vite build` outright, and an install left unconfigured over a weekend looked
 * like agent-ui had broken the project rather than like a step still to do. The
 * error is unchanged and still names this file; only its timing moved, to the
 * first request that actually reaches for the model.
 */
export function agentModelStub(pm: PackageManager): string {
  const options = providerInstallLines(pm)
    .map((line) => ` *      ${line}`)
    .join("\n");
  const example = PROVIDERS.openai;
  return `import type { LanguageModel } from "ai";

/**
 * The model this site's assistant runs on.
 *
 * Server-only. Your API route imports this; browser code never does, and the
 * key never leaves the server.
 *
 * 1. Install one adapter, at the pinned major — \`latest\` targets a newer \`ai\`
 *    major and fails with AI_UnsupportedModelVersionError:
 *
${options}
 *
 * 2. Replace the export below:
 *
 *      import { ${example.importName} } from "${example.pkg}";
 *      export const model: LanguageModel = ${example.importName}("${example.exampleModel}");
 *
 * 3. Put the key in a server-side .env at your project root. Never prefix it
 *    VITE_ or NEXT_PUBLIC_ — those prefixes publish the value to the browser.
 *    The adapter reads process.env itself; you never pass the key to
 *    createAgentHandler.
 */
export const model: LanguageModel = notConfigured();

// Throws when something first reaches for the model, not when this module is
// evaluated — importing an unconfigured stub must not break your build.
function notConfigured(): LanguageModel {
  const fail = (): never => {
    throw new Error(
      "agent-ui: no model configured yet — edit agent-model.ts and export one. " +
        "See the comment at the top of that file.",
    );
  };
  return new Proxy({} as object, { get: fail, has: fail }) as LanguageModel;
}
`;
}

// Root layouts and framework detection live in `hosts.ts`: the same paths that
// tell init where a stylesheet gets imported also tell it which framework this
// is and where an API route belongs, and one table is easier to keep honest
// than two lists that must agree.

/**
 * Vite config names, in the order Vite itself resolves them. Presence of one is
 * the definitive "this is a Vite project" signal — firmer than a root layout,
 * since `src/main.tsx` also shows up in CRA and hand-rolled bundler setups.
 */
export const VITE_CONFIG_FILES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "vite.config.mjs",
] as const;

/** The project's Vite config, or `undefined`. Same probe split as `pickRootLayout`. */
export function pickViteConfig(
  exists: (file: string) => boolean,
): string | undefined {
  return VITE_CONFIG_FILES.find(exists);
}

/**
 * TypeScript configs that can carry the `compilerOptions.types` array, nearest
 * to the app source first: `create vite`'s `react-ts` template splits the root
 * config into `tsconfig.app.json` and `tsconfig.node.json`, and the app one is
 * what compiles `src/`.
 */
export const TSCONFIG_FILES = ["tsconfig.app.json", "tsconfig.json"] as const;

/**
 * Whether a tsconfig's `types` array would hide `@types/node` from the compiler.
 *
 * An explicit `compilerOptions.types` array replaces the automatic `@types/*`
 * pickup rather than adding to it, and `create vite --template react-ts` pins
 * `"types": ["vite/client"]`. The scaffolded `server/node.ts` then fails to
 * compile on `node:http` and `node:stream` even though init added `@types/node`
 * correctly — a first `bun run build`, long after anyone read the README.
 *
 * Matched by regex, not `JSON.parse`: the template ships these files with
 * comments, making them JSONC, which does not parse. A `"types"` string inside
 * a comment ahead of the real key would fool this — costing one unnecessary
 * warning line, never a wrong file write.
 */
export function needsNodeTypes(tsconfigText: string): boolean {
  const types = /"types"\s*:\s*\[([^\]]*)\]/.exec(tsconfigText);
  if (types === null) return false;
  return !/["']node["']/.test(types[1] ?? "");
}

/**
 * Bridging `.env` into `process.env` for a Vite project, printed by init rather
 * than linked.
 *
 * Vite parses `.env` into `import.meta.env` and only for `VITE_`-prefixed names,
 * while the provider adapter runs in the Node process and reads `process.env`.
 * Nothing connects the two by default, so a correctly-placed key produces
 * `AI_LoadAPIKeyError` on the very first message.
 *
 * Gated on a Vite config alone: the CLI no longer knows which adapter the
 * consumer will reach for, but every one of them reads `process.env`, so the
 * gap is a property of the runtime rather than of the provider.
 */
export function viteEnvHint(config: string): string[] {
  return [
    "  Vite does not put .env into process.env, which is where the adapter reads",
    "  the key from — without this the first message fails with AI_LoadAPIKeyError.",
    `  Add to ${config}:`,
    "",
    '    import { defineConfig, loadEnv } from "vite";',
    "    export default defineConfig(({ mode }) => {",
    '      Object.assign(process.env, loadEnv(mode, process.cwd(), ""));',
    "      return { ...your existing config... };",
    "    });",
    "",
    "  The empty prefix loads unprefixed names too. This stays server-side —",
    "  never copy it into `define` or any client-visible config.",
  ];
}

/**
 * The lowest React major the templates run on. Both runtime dependencies accept
 * it (`@ai-sdk/react` peers on `^18 || ^19`, `react-markdown` on `>=18`) and no
 * React 19-only API appears in the templates, so the previous "requires 19" was
 * a claim rather than a constraint. Development and tests run on 19.
 */
export const MIN_REACT_MAJOR = 18;

/**
 * Warning text when the consumer's React cannot run the templates, or `undefined`
 * when it can.
 *
 * The major is read off the front of whatever range is declared (`^18.2.0`,
 * `>=18`, `18`), which covers the shapes a package.json actually carries. Ranges
 * that parse to nothing — a git URL, `workspace:*`, a tag — warn about nothing:
 * an unreadable range is not evidence of a wrong version, and a false alarm here
 * costs more trust than the check buys.
 */
export function reactVersionWarning(pkg: PackageJsonLike): string | undefined {
  const range = pkg.dependencies?.react ?? pkg.peerDependencies?.react;
  if (range === undefined) {
    return `No react dependency found — agent-ui requires React ${MIN_REACT_MAJOR} or newer.`;
  }
  const major = Number(/\d+/.exec(range)?.[0]);
  if (Number.isNaN(major) || major >= MIN_REACT_MAJOR) return undefined;
  return `react ${range} is below the React ${MIN_REACT_MAJOR} the templates need — upgrade before rendering <AgentChat>.`;
}

/**
 * A project-root-relative path rewritten as an import specifier *from* another
 * file. A bare `./${dir}/styles.css` is only correct for an importer sitting at
 * the project root, which `src/main.tsx` and `app/layout.tsx` never do — from
 * `src/main.tsx` the same file is `./agent/styles.css`.
 *
 * Every file init writes or describes needs this: the style hint, and each
 * generated route's imports of `server`, the model, and the manifest. Passing
 * `undefined` for `fromFile` yields the project-root-relative path, which the
 * caller then has to flag as needing adjustment.
 */
export function importSpecifier(target: string, fromFile?: string): string {
  const trimmed = (p: string) => toPosix(p).replace(/\/+$/, "");
  const from = fromFile ? posix.dirname(trimmed(fromFile)) : ".";
  const rel = posix.relative(from, trimmed(target));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

/** The `styles.css` specifier as written from the consumer's root layout. */
export function styleImportSpecifier(dir: string, layout?: string): string {
  return importSpecifier(`${toPosix(dir).replace(/\/+$/, "")}/styles.css`, layout);
}

/** Drop a `.ts`/`.tsx` extension: TypeScript import specifiers do not carry one. */
export function withoutExtension(path: string): string {
  return path.replace(/\.(tsx?|jsx?)$/, "");
}

/**
 * Published alongside the CLI so editors can complete and validate `.agent.json`
 * — the same affordance any JSON config file gets from a `$schema` key.
 */
export const AGENT_CONFIG_SCHEMA_URL =
  "https://raw.githubusercontent.com/tuann72/agent-ui/main/packages/cli/schema.json";

/**
 * Where the three consumer-owned files ended up.
 *
 * "Never overwritten" was only ever true at the path init would pick today: move
 * your manifest to `src/lib/agent-manifest.ts` and a `--force` re-run found
 * nothing at `src/agent-manifest.ts`, so it wrote a second starter there — a
 * stray file next to the real one, and the same hole for the model stub and the
 * route. Recording the paths is what lets a re-run look where the files
 * actually are.
 */
export interface AgentPaths {
  /** The model seam, relative to the project root. */
  model: string;
  /** The public manifest, relative to the project root. */
  manifest: string;
  /** The generated API route, absent on hosts init only prints a snippet for. */
  route?: string;
}

export interface AgentConfig {
  $schema: string;
  /** CLI version that scaffolded this install. */
  cli: string;
  /** Where the vendored agent-ui source lives, relative to the project root. */
  dir: string;
  /** Where the files init writes beside `dir` live. */
  paths: AgentPaths;
  /** Install-time sha256 per template file, for the future `agent-ui update`. */
  files: Record<string, string>;
}

export function buildAgentConfig(
  cliVersion: string,
  dir: string,
  paths: AgentPaths,
  files: Record<string, string>,
): AgentConfig {
  return {
    $schema: AGENT_CONFIG_SCHEMA_URL,
    cli: cliVersion,
    dir,
    paths: {
      model: paths.model,
      manifest: paths.manifest,
      ...(paths.route === undefined ? {} : { route: paths.route }),
    },
    files,
  };
}

/**
 * The paths a re-run should reuse, from a `.agent.json` that may be absent,
 * malformed, or written by an older CLI that recorded none of this.
 *
 * Every field is optional and every failure is silent: a config we cannot read
 * means init falls back to the defaults it has always used, which is exactly
 * what a first install does. Refusing to run because a JSON file is damaged
 * would be a worse outcome than writing to the standard location.
 */
export function readAgentPaths(raw: string | undefined): Partial<AgentPaths> {
  if (raw === undefined) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const paths = (parsed as { paths?: unknown } | null)?.paths;
  if (typeof paths !== "object" || paths === null) return {};

  const pick = (key: keyof AgentPaths): string | undefined => {
    const value = (paths as Record<string, unknown>)[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  };
  const model = pick("model");
  const manifest = pick("manifest");
  const route = pick("route");
  return {
    ...(model === undefined ? {} : { model }),
    ...(manifest === undefined ? {} : { manifest }),
    ...(route === undefined ? {} : { route }),
  };
}
