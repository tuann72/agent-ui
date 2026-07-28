#!/usr/bin/env bun
/**
 * dev-real.ts — one-command local smoke test against a REAL provider.
 *
 * This launcher is intentionally provider-NEUTRAL: it imports no provider
 * adapter, favors none, and adds nothing to any committed manifest. Everything
 * it *produces* stays uncommitted — the adapter is installed locally (and the
 * touched manifests are immediately restored), and the generated server file
 * matches the gitignored `*.local.ts` pattern. This mirrors what the future
 * `@tuann72/agent-ui` will do for a consumer, without violating invariant 12
 * (no provider adapter in the committed dependency tree; smoke-test setup
 * stays uncommitted).
 *
 * Usage (from the repo root):
 *   bun run scripts/dev-real.ts                    # defaults to Gemini
 *   bun run scripts/dev-real.ts --provider openai
 *   bun run scripts/dev-real.ts --model gemini-flash-lite-latest --port 5173
 *
 * The API key is read from the root `.env` (auto-loaded by Bun). Any of a
 * provider's accepted variable names works; the launcher normalizes it into
 * the adapter's canonical variable for the child process.
 */
import { resolve } from "node:path";

interface ProviderConfig {
  /** npm adapter package, installed locally and never committed */
  pkg: string;
  /** named factory export from that package */
  factory: string;
  /** model id used when --model is not passed */
  defaultModel: string;
  /** canonical env var the adapter reads on its own */
  canonicalEnv: string;
  /** extra names we accept and normalize into canonicalEnv */
  aliasEnv: string[];
  /** generated server filename under apps/playground/server (gitignored) */
  file: string;
  /** short human label for logs */
  label: string;
}

// The three V1 provider choices, listed symmetrically. Model ids for openai /
// anthropic are reasonable defaults only; Gemini is the validated path.
const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    pkg: "@ai-sdk/google",
    factory: "createGoogleGenerativeAI",
    // Rolling alias: always the current flash release, never retires. Same
    // suggestion `agent-ui init` prints, so the smoke test exercises what a
    // consumer is told to use.
    defaultModel: "gemini-flash-latest",
    canonicalEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
    aliasEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    file: "gemini.local.ts",
    label: "Gemini",
  },
  openai: {
    pkg: "@ai-sdk/openai",
    factory: "createOpenAI",
    defaultModel: "gpt-4o-mini",
    canonicalEnv: "OPENAI_API_KEY",
    aliasEnv: [],
    file: "openai.local.ts",
    label: "OpenAI",
  },
  anthropic: {
    pkg: "@ai-sdk/anthropic",
    factory: "createAnthropic",
    defaultModel: "claude-haiku-4-5",
    canonicalEnv: "ANTHROPIC_API_KEY",
    aliasEnv: [],
    file: "anthropic.local.ts",
    label: "Anthropic",
  },
};

const SYSTEM_PROMPT =
  "You are the front-desk guide for Basalt Bouldering Co., a fictional " +
  "climbing gym in Bend, Oregon. Answer immediately and concisely. Use no " +
  "more than three short sentences unless the user explicitly requests detail. " +
  "Do not restate the question, narrate your reasoning, or add unnecessary " +
  "background.";

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}

const repoRoot = resolve(import.meta.dir, "..");
const playgroundDir = resolve(repoRoot, "apps/playground");
const serverDir = resolve(playgroundDir, "server");

// Resolve to a non-optional ProviderConfig so the value stays narrowed when
// it is captured by the nested closures below (a top-level guard would be
// re-widened to `| undefined` inside them under noUncheckedIndexedAccess).
function pickProvider(key: string): ProviderConfig {
  const cfg = PROVIDERS[key];
  if (!cfg) {
    console.error(
      `Unknown provider "${key}". Choose one of: ${Object.keys(PROVIDERS).join(", ")}`,
    );
    process.exit(1);
  }
  return cfg;
}

const args = parseArgs(Bun.argv.slice(2));
const providerKey = (args.provider ?? "google").toLowerCase();
const config = pickProvider(providerKey);

const model = args.model ?? config.defaultModel;
const port = args.port ?? process.env.PORT ?? "5173";

// --- 1. Resolve the API key from any accepted name -------------------------
const acceptedNames = [config.canonicalEnv, ...config.aliasEnv];
const apiKey = acceptedNames.map((name) => process.env[name]).find(Boolean);

if (!apiKey) {
  console.error(
    `\nNo API key found for ${config.label}.\n` +
      `Add one of these to the repo-root .env (never a VITE_/NEXT_PUBLIC_ prefix):\n` +
      acceptedNames.map((name) => `  ${name}=...`).join("\n") +
      `\n\nSee .env.example.\n`,
  );
  process.exit(1);
}

// --- 2. Ensure the adapter is installed locally (never committed) ----------
function ensureAdapter(): void {
  try {
    Bun.resolveSync(config.pkg, playgroundDir);
    return; // already resolvable — nothing to do
  } catch {
    // not installed yet
  }

  console.log(`• Installing ${config.pkg} locally (uncommitted)…`);
  const add = Bun.spawnSync(["bun", "add", config.pkg], {
    cwd: playgroundDir,
    stdout: "inherit",
    stderr: "inherit",
  });

  // Restore the touched manifests so the committed tree stays provider-neutral.
  // The physical install (Bun store symlink) survives the revert, so the
  // adapter remains importable this run.
  Bun.spawnSync(
    ["git", "checkout", "--", "apps/playground/package.json", "bun.lock"],
    { cwd: repoRoot, stdout: "inherit", stderr: "inherit" },
  );

  if (!add.success) {
    console.error(`Failed to install ${config.pkg}.`);
    process.exit(1);
  }
  try {
    Bun.resolveSync(config.pkg, playgroundDir);
  } catch {
    console.error(
      `Installed ${config.pkg} but still cannot resolve it from ${playgroundDir}.`,
    );
    process.exit(1);
  }
}

ensureAdapter();

// --- 3. Generate the gitignored server file --------------------------------
function generateServerFile(): string {
  return `// GENERATED by scripts/dev-real.ts — DO NOT COMMIT.
// Gitignored via apps/playground/server/*.local.ts. This is the "consumer
// server code": the registry stays provider-neutral, and this file injects a
// concrete model. The adapter reads ${config.canonicalEnv} from the
// environment (the launcher normalizes any accepted alias into it), so no key
// is hardcoded or passed through the browser.
import { ${config.factory} } from "${config.pkg}";
import { createAgentHandler } from "@agent-ui/registry/server";
import { serverManifest } from "./manifest";

const provider = ${config.factory}();

export const handler = createAgentHandler({
  model: provider(${JSON.stringify(model)}),
  manifest: serverManifest,
  system:
    ${JSON.stringify(SYSTEM_PROMPT)},
  // Real responses can exceed the default handler timeout.
  limits: { maxDurationMs: 120_000 },
});

export const health = {
  ok: true,
  provider: ${JSON.stringify(providerKey)},
  model: ${JSON.stringify(model)},
};
`;
}

const serverFile = resolve(serverDir, config.file);
await Bun.write(serverFile, generateServerFile());
console.log(`• Wrote ${config.file} (uncommitted)`);

// --- 4. Launch Vite with the real API mounted as middleware ----------------
// Normalize the resolved key into the adapter's canonical variable so the
// generated file needs no alias handling of its own.
const childEnv = {
  ...process.env,
  [config.canonicalEnv]: apiKey,
  AGENT_PLAYGROUND_API_MODULE: `/server/${config.file}`,
};

console.log(
  `\n▶ ${config.label} smoke test — web + API on :${port}\n` +
    `  (this is NOT the scripted mock; Ctrl-C stops it)\n`,
);

const web = Bun.spawn(
  ["bun", "run", "--cwd", "apps/playground", "dev", "--", "--port", port],
  {
    cwd: repoRoot,
    env: childEnv,
    stdout: "inherit",
    stderr: "inherit",
  },
);

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  web.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await web.exited;
shutdown();
