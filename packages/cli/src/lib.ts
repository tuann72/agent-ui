/**
 * Pure decision logic for the agent-ui CLI — no fs, no process, no prompts.
 * Everything here is unit-tested with plain values; `init.ts` supplies the IO.
 */

import { posix } from "node:path";

/** A user-facing failure with a message safe to print without a stack trace. */
export class CliError extends Error {}

export interface ProviderInfo {
  /** Adapter package added to the *consumer's* project (invariant 12 — never a dependency of this repo). */
  pkg: string;
  /** Semver range compatible with AI SDK v5. `latest` adapters target a newer `ai` major and fail. */
  range: string;
  /** Env var the adapter reads server-side. */
  env: string;
  /** Default provider instance exported by the adapter package. */
  importName: string;
  /** Model id for hints — rolling aliases where the provider offers them, so hints never retire. */
  defaultModel: string;
  label: string;
}

export const PROVIDERS = {
  openai: {
    pkg: "@ai-sdk/openai",
    range: "^2",
    env: "OPENAI_API_KEY",
    importName: "openai",
    defaultModel: "gpt-4o-mini",
    label: "OpenAI",
  },
  anthropic: {
    pkg: "@ai-sdk/anthropic",
    range: "^2",
    env: "ANTHROPIC_API_KEY",
    importName: "anthropic",
    defaultModel: "claude-haiku-4-5",
    label: "Anthropic",
  },
  google: {
    pkg: "@ai-sdk/google",
    range: "^2",
    env: "GOOGLE_GENERATIVE_AI_API_KEY",
    importName: "google",
    defaultModel: "gemini-flash-latest",
    label: "Google (Gemini)",
  },
} as const satisfies Record<string, ProviderInfo>;

export type ProviderId = keyof typeof PROVIDERS;

export function isProviderId(value: string): value is ProviderId {
  return Object.hasOwn(PROVIDERS, value);
}

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
 * The provider whose adapter the project already declares, if any.
 *
 * A non-interactive run has no answer to the provider question and used to
 * assume `none`, which on a re-run means telling a project that already has
 * `@ai-sdk/google` that no adapter was installed — and writing that `none` into
 * `.agent.json`, losing a fact that was previously right. What the project
 * declares is the better answer than a default, so init asks the manifest.
 *
 * `PROVIDERS` order breaks ties: a project with two adapters has no single
 * correct answer, and picking deterministically beats picking by object
 * iteration.
 */
export function detectInstalledProvider(
  pkg: PackageJsonLike,
): ProviderId | undefined {
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
  const ids = Object.keys(PROVIDERS) as ProviderId[];
  return ids.find((id) => declared.has(PROVIDERS[id].pkg));
}

/**
 * Printed when init finishes without a provider (the `--yes`/non-interactive
 * default). Field-tested failure this prevents: installing an adapter at
 * `latest` pairs with a newer `ai` major and throws
 * AI_UnsupportedModelVersionError against the templates' ai@^5, so the hint
 * spells out the pinned installs.
 */
export function noProviderHint(pm: PackageManager): string[] {
  const lines = [
    "⚠ No provider adapter was installed. Add one before mounting the server",
    "  handler — pinned to the AI SDK 5-compatible major shown below. Installing",
    "  `latest` targets a newer `ai` major and fails with the templates' ai@^5.",
  ];
  for (const info of Object.values<ProviderInfo>(PROVIDERS)) {
    lines.push(
      `    ${addCommand(pm, `${info.pkg}@${info.range}`)}   # ${info.label} — reads ${info.env}`,
    );
  }
  return lines;
}

/**
 * Where a global stylesheet is conventionally imported, framework-specific
 * entries before the generic ones. `init` looks for these so the style-import
 * hint is written from the file the consumer actually pastes it into.
 *
 * Order is the contract: the outermost module wins. A framework project often
 * still carries a `src/main.tsx` (migration leftovers, or a router SPA that has
 * both), so every framework root has to sort above the generic tail or the hint
 * names the wrong file.
 */
export const ROOT_LAYOUT_FILES = [
  // Next.js App Router
  "app/layout.tsx",
  "app/layout.jsx",
  "src/app/layout.tsx",
  "src/app/layout.jsx",
  // React Router v7 framework mode / Remix
  "app/root.tsx",
  "app/root.jsx",
  // TanStack Start / Router (Vite plugin layout, then the older Vinxi one)
  "src/routes/__root.tsx",
  "app/routes/__root.tsx",
  // Plain Vite / CRA
  "src/main.tsx",
  "src/main.ts",
  "src/index.tsx",
  "src/App.tsx",
] as const;

/**
 * The first candidate that exists, or `undefined`. `exists` is the caller's
 * filesystem probe, which keeps the precedence order testable here without this
 * module touching `fs` — the same split `detectPackageManager` uses.
 */
export function pickRootLayout(
  exists: (file: string) => boolean,
): string | undefined {
  return ROOT_LAYOUT_FILES.find(exists);
}

/**
 * The `styles.css` specifier as written *from* `layout`. A bare
 * `./${dir}/styles.css` is only correct for an importer sitting at the project
 * root, which `src/main.tsx` and `app/layout.tsx` never do — from `src/main.tsx`
 * the same file is `./agent/styles.css`. With no known layout, the path falls
 * back to project-root-relative and the caller says so.
 */
export function styleImportSpecifier(dir: string, layout?: string): string {
  const trimmed = (p: string) => toPosix(p).replace(/\/+$/, "");
  const target = `${trimmed(dir)}/styles.css`;
  const from = layout ? posix.dirname(trimmed(layout)) : ".";
  const rel = posix.relative(from, target);
  return rel.startsWith(".") ? rel : `./${rel}`;
}

/**
 * Published alongside the CLI so editors can complete and validate `.agent.json`
 * — the same affordance any JSON config file gets from a `$schema` key.
 */
export const AGENT_CONFIG_SCHEMA_URL =
  "https://raw.githubusercontent.com/tuann72/agent-ui/main/packages/cli/schema.json";

export interface AgentConfig {
  $schema: string;
  /** CLI version that scaffolded this install. */
  cli: string;
  /** Where the vendored agent-ui source lives, relative to the project root. */
  dir: string;
  /** Markdown content directory for `agent-ui sync` (invariant 11 default). */
  content: string;
  provider: ProviderId | "none";
  /** Install-time sha256 per template file, for the future `agent-ui update`. */
  files: Record<string, string>;
}

export function buildAgentConfig(
  cliVersion: string,
  dir: string,
  provider: ProviderId | "none",
  files: Record<string, string>,
): AgentConfig {
  return {
    $schema: AGENT_CONFIG_SCHEMA_URL,
    cli: cliVersion,
    dir,
    content: "content/agent",
    provider,
    files,
  };
}
