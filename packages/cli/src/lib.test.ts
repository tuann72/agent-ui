import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  addCommand,
  AGENT_CONFIG_SCHEMA_URL,
  agentModelPath,
  agentModelStub,
  argvErrorMessage,
  buildAgentConfig,
  detectPackageManager,
  INIT_OPTIONS_HELP,
  installCommand,
  isTemplateFile,
  mergeDependencies,
  MIN_REACT_MAJOR,
  agentManifestPath,
  importSpecifier,
  needsNodeTypes,
  pickViteConfig,
  PROVIDERS,
  providerSetupHint,
  reactVersionWarning,
  styleImportSpecifier,
  viteEnvHint,
  withoutExtension,
} from "./lib";

/** An fs probe backed by a fixed set instead of a disk. */
const present =
  (...files: string[]) =>
  (file: string) =>
    files.includes(file);

describe("argvErrorMessage", () => {
  /**
   * Real `parseArgs` failures rather than hand-built codes: the point of the
   * helper is that Node's own errors reach the user readable, so a Node upgrade
   * that changes them should fail here rather than in someone's terminal.
   */
  const argvError = (args: string[]): unknown => {
    try {
      parseArgs({
        args,
        options: {
          dir: { type: "string", default: "src/agent" },
          yes: { type: "boolean", short: "y", default: false },
          force: { type: "boolean", default: false },
        },
      });
    } catch (error) {
      return error;
    }
    throw new Error(`expected ${args.join(" ")} to be rejected`);
  };

  test("names the rejected flag and lists the real ones", () => {
    const message = argvErrorMessage(argvError(["--porvider"]));
    expect(message).toContain("--porvider");
    expect(message).toContain("Options for init:");
    expect(message).toContain(INIT_OPTIONS_HELP);
  });

  test("explains --provider, the likeliest wrong flag", () => {
    // It was a real flag until the model became the consumer's; anyone working
    // from a draft or a copied command still types it.
    expect(argvErrorMessage(argvError(["--provider", "google"]))).toContain(
      "Unknown option '--provider'",
    );
  });

  test("drops Node's `--` advice, which init cannot act on", () => {
    // init takes no positionals, so following that hint produces a second error.
    expect(argvErrorMessage(argvError(["--nope"]))).not.toContain("after '--'");
  });

  test("covers a missing option value and a stray positional", () => {
    expect(argvErrorMessage(argvError(["--dir"]))).toContain("--dir");
    expect(argvErrorMessage(argvError(["src/agent"]))).toContain("src/agent");
  });

  test("declines anything that is not an argv error", () => {
    // A real bug must keep its stack trace instead of being blamed on the user.
    expect(argvErrorMessage(new TypeError("x is not a function"))).toBeUndefined();
    expect(argvErrorMessage(undefined)).toBeUndefined();
    expect(argvErrorMessage({ code: "ENOENT" })).toBeUndefined();
  });
});

describe("isTemplateFile", () => {
  test("accepts runtime source by extension", () => {
    expect(isTemplateFile("index.ts")).toBe(true);
    expect(isTemplateFile("components/dock.tsx")).toBe(true);
    expect(isTemplateFile("core/tool-policy.ts")).toBe(true);
    expect(isTemplateFile("styles.css")).toBe(true);
  });

  test("rejects tests, the test preload, and non-source files", () => {
    expect(isTemplateFile("core/resize.test.ts")).toBe(false);
    expect(isTemplateFile("components/variants.contract.test.tsx")).toBe(false);
    expect(isTemplateFile("test-setup.ts")).toBe(false);
    expect(isTemplateFile("nested/test-setup.ts")).toBe(false);
    expect(isTemplateFile("e2e/chat.e2e.ts")).toBe(false);
    expect(isTemplateFile("chat.spec.ts")).toBe(false);
    expect(isTemplateFile("README.md")).toBe(false);
    expect(isTemplateFile("logo.png")).toBe(false);
  });
});

describe("mergeDependencies", () => {
  test("adds missing deps to dependencies", () => {
    const { pkg, added, kept } = mergeDependencies(
      { name: "consumer" },
      { ai: "^5", zod: "^4" },
    );
    expect(pkg.dependencies).toEqual({ ai: "^5", zod: "^4" });
    expect(added).toEqual({ ai: "^5", zod: "^4" });
    expect(kept).toEqual([]);
  });

  test("never overwrites a range the consumer already declares anywhere", () => {
    const { pkg, added, kept } = mergeDependencies(
      {
        dependencies: { ai: "5.2.1" },
        devDependencies: { zod: "^3" },
        peerDependencies: { react: "^19" },
      },
      { ai: "^5", zod: "^4", react: "^19.2.7", hono: "^4" },
    );
    expect(pkg.dependencies).toEqual({ ai: "5.2.1", hono: "^4" });
    expect(pkg.devDependencies).toEqual({ zod: "^3" });
    expect(added).toEqual({ hono: "^4" });
    expect(kept).toEqual(["ai", "zod", "react"]);
  });

  test("does not mutate its input", () => {
    const input = { dependencies: { ai: "^5" } };
    mergeDependencies(input, { zod: "^4" });
    expect(input).toEqual({ dependencies: { ai: "^5" } });
  });

  test("targets devDependencies when asked", () => {
    const { pkg, added } = mergeDependencies(
      { dependencies: { react: "^19" } },
      { "@types/node": "^26.1.1", "@types/react": "^19" },
      "devDependencies",
    );
    expect(pkg.dependencies).toEqual({ react: "^19" });
    expect(pkg.devDependencies).toEqual({
      "@types/node": "^26.1.1",
      "@types/react": "^19",
    });
    expect(added).toEqual({ "@types/node": "^26.1.1", "@types/react": "^19" });
  });

  test("never moves a dep the consumer declared in another section", () => {
    const { pkg, added, kept } = mergeDependencies(
      { dependencies: { "@types/node": "^20" } },
      { "@types/node": "^26.1.1" },
      "devDependencies",
    );
    expect(pkg.dependencies).toEqual({ "@types/node": "^20" });
    expect(pkg.devDependencies).toBeUndefined();
    expect(added).toEqual({});
    expect(kept).toEqual(["@types/node"]);
  });
});

describe("detectPackageManager", () => {
  test("picks by lockfile", () => {
    expect(detectPackageManager(["bun.lock", "package.json"])).toBe("bun");
    expect(detectPackageManager(["bun.lockb"])).toBe("bun");
    expect(detectPackageManager(["pnpm-lock.yaml"])).toBe("pnpm");
    expect(detectPackageManager(["yarn.lock"])).toBe("yarn");
    expect(detectPackageManager(["package-lock.json"])).toBe("npm");
    expect(detectPackageManager(["package.json"])).toBe("npm");
  });

  test("install command matches the manager", () => {
    expect(installCommand("bun")).toBe("bun install");
    expect(installCommand("npm")).toBe("npm install");
  });

  test("add command quotes the spec and uses the manager's verb", () => {
    expect(addCommand("npm", "@ai-sdk/google@^2")).toBe(
      'npm install "@ai-sdk/google@^2"',
    );
    expect(addCommand("bun", "@ai-sdk/google@^2")).toBe(
      'bun add "@ai-sdk/google@^2"',
    );
    expect(addCommand("pnpm", "ai@^5")).toBe('pnpm add "ai@^5"');
    expect(addCommand("yarn", "ai@^5")).toBe('yarn add "ai@^5"');
  });
});

describe("providers", () => {
  test("every entry carries adapter, range, and env metadata", () => {
    for (const info of Object.values(PROVIDERS)) {
      expect(info.pkg).toStartWith("@ai-sdk/");
      expect(info.range).toBe("^2");
      expect(info.env.length).toBeGreaterThan(0);
      expect(info.importName.length).toBeGreaterThan(0);
      expect(info.exampleModel.length).toBeGreaterThan(0);
    }
  });

  test("setup hint lists every adapter with its pinned range", () => {
    const hint = providerSetupHint("npm").join("\n");
    for (const info of Object.values(PROVIDERS)) {
      expect(hint).toContain(`"${info.pkg}@${info.range}"`);
      expect(hint).toContain(info.env);
    }
    expect(hint).toContain("latest");
  });

  test("setup hint warns off the browser-visible env prefixes", () => {
    const hint = providerSetupHint("bun").join("\n");
    expect(hint).toContain("VITE_");
    expect(hint).toContain("NEXT_PUBLIC_");
  });

  test("no provider adapter is a dependency of the registry (invariant 12)", () => {
    const registryPkg = JSON.parse(
      readFileSync(
        new URL("../../../registry/package.json", import.meta.url),
        "utf8",
      ),
    ) as { dependencies?: Record<string, string> };
    for (const info of Object.values(PROVIDERS)) {
      expect(registryPkg.dependencies?.[info.pkg]).toBeUndefined();
    }
  });

  test("the CLI declares no provider adapter either", () => {
    const cliPkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    for (const info of Object.values(PROVIDERS)) {
      expect(cliPkg.dependencies?.[info.pkg]).toBeUndefined();
      expect(cliPkg.devDependencies?.[info.pkg]).toBeUndefined();
    }
  });
});

describe("agentModelPath", () => {
  test("sits beside the scaffolded dir, never inside it", () => {
    expect(agentModelPath("src/agent")).toBe("src/agent-model.ts");
    expect(agentModelPath("app/agent")).toBe("app/agent-model.ts");
    expect(agentModelPath("src/lib/agent")).toBe("src/lib/agent-model.ts");
  });

  test("a project-root dir puts the stub at the project root", () => {
    expect(agentModelPath("agent")).toBe("agent-model.ts");
  });

  test("trailing slashes and windows separators normalise", () => {
    expect(agentModelPath("src/agent/")).toBe("src/agent-model.ts");
    expect(agentModelPath("src\\agent")).toBe("src/agent-model.ts");
  });
});

describe("agentModelStub", () => {
  test("exports a typed model and throws until one is supplied", () => {
    const stub = agentModelStub("npm");
    expect(stub).toContain('import type { LanguageModel } from "ai"');
    expect(stub).toContain("export const model: LanguageModel");
    expect(stub).toContain("throw new Error");
  });

  test("carries the pinned install command for every adapter", () => {
    const stub = agentModelStub("pnpm");
    for (const info of Object.values(PROVIDERS)) {
      expect(stub).toContain(`pnpm add "${info.pkg}@${info.range}"`);
      expect(stub).toContain(info.env);
    }
  });

  test("warns off the browser-visible env prefixes", () => {
    const stub = agentModelStub("npm");
    expect(stub).toContain("VITE_");
    expect(stub).toContain("NEXT_PUBLIC_");
  });

  test("the comment block never terminates itself early", () => {
    // Every install command and example line is interpolated into one JSDoc
    // block; a stray */ from PROVIDERS data would split the file into
    // syntax garbage that only a scaffolded consumer would ever compile.
    const stub = agentModelStub("yarn");
    expect(stub.split("*/").length - 1).toBe(1);
  });
});

describe("importSpecifier", () => {
  test("rewrites a root-relative path as seen from the importing file", () => {
    expect(importSpecifier("src/agent/server", "app/api/agent/route.ts")).toBe(
      "../../../src/agent/server",
    );
    expect(importSpecifier("src/agent-model", "src/routes/api/agent.ts")).toBe(
      "../../agent-model",
    );
  });

  test("always produces a relative specifier, never a bare one", () => {
    // A bare `agent/styles.css` resolves as a package name, not a path — the
    // one output shape that fails silently by finding something else.
    expect(importSpecifier("src/agent/styles.css", "src/main.tsx")).toBe(
      "./agent/styles.css",
    );
    expect(importSpecifier("src/agent/styles.css")).toBe("./src/agent/styles.css");
  });
});

describe("withoutExtension", () => {
  test("strips the extension TypeScript specifiers omit", () => {
    expect(withoutExtension("src/agent-model.ts")).toBe("src/agent-model");
    expect(withoutExtension("src/agent-manifest.tsx")).toBe("src/agent-manifest");
    expect(withoutExtension("src/agent/server")).toBe("src/agent/server");
  });
});

describe("agentManifestPath", () => {
  test("sits beside --dir, like the model stub", () => {
    // Same rule and same reason: everything inside --dir is hash-tracked for a
    // future `agent-ui update`, and this is a file meant to be edited.
    expect(agentManifestPath("src/agent")).toBe("src/agent-manifest.ts");
    expect(agentManifestPath("app/components/agent/")).toBe(
      "app/components/agent-manifest.ts",
    );
    expect(agentManifestPath("agent")).toBe("agent-manifest.ts");
  });
});

describe("pickViteConfig", () => {
  test("finds a config under any of Vite's extensions", () => {
    expect(pickViteConfig(present("vite.config.ts"))).toBe("vite.config.ts");
    expect(pickViteConfig(present("vite.config.mjs"))).toBe("vite.config.mjs");
  });

  test("reports nothing for a project that is not Vite", () => {
    expect(pickViteConfig(present("next.config.js", "src/main.tsx"))).toBeUndefined();
  });

  test("names the config it found, so the hint points at a real file", () => {
    const hint = viteEnvHint("vite.config.mts").join("\n");
    expect(hint).toContain("vite.config.mts");
    expect(hint).toContain("loadEnv(mode, process.cwd(), \"\")");
    // The prefix warning has to travel with the snippet it qualifies.
    expect(hint).toContain("never copy it into `define`");
  });
});

describe("needsNodeTypes", () => {
  test("flags create-vite's pinned array, which hides @types/node", () => {
    expect(needsNodeTypes('{"compilerOptions":{"types":["vite/client"]}}')).toBe(
      true,
    );
  });

  test("passes an array that already lists node", () => {
    expect(
      needsNodeTypes('{"compilerOptions":{"types":["vite/client","node"]}}'),
    ).toBe(false);
  });

  test("passes a config with no types array, where pickup is automatic", () => {
    expect(needsNodeTypes('{"compilerOptions":{"strict":true}}')).toBe(false);
  });

  test("reads JSONC, which is what the template actually ships", () => {
    const jsonc = `{
      "compilerOptions": {
        /* Bundler mode */
        "moduleResolution": "bundler",
        "types": ["vite/client"]
      }
    }`;
    expect(needsNodeTypes(jsonc)).toBe(true);
  });
});

describe("reactVersionWarning", () => {
  test("warns when react is absent entirely", () => {
    expect(reactVersionWarning({})).toContain("No react dependency");
  });

  test("warns when the declared major is below the floor", () => {
    expect(reactVersionWarning({ dependencies: { react: "^17.0.2" } })).toContain(
      "below the React 18",
    );
  });

  test("passes the floor and anything above it", () => {
    expect(
      reactVersionWarning({ dependencies: { react: `^${MIN_REACT_MAJOR}.2.0` } }),
    ).toBeUndefined();
    expect(reactVersionWarning({ dependencies: { react: ">=18" } })).toBeUndefined();
    expect(
      reactVersionWarning({ dependencies: { react: "^19.2.7" } }),
    ).toBeUndefined();
  });

  test("stays quiet on ranges it cannot read, rather than guessing", () => {
    // A workspace protocol or git URL is not evidence of a wrong version, and a
    // false alarm costs more than the check is worth.
    expect(
      reactVersionWarning({ dependencies: { react: "workspace:*" } }),
    ).toBeUndefined();
  });

  test("accepts react declared as a peer dependency, as a library would", () => {
    expect(
      reactVersionWarning({ peerDependencies: { react: "^19" } }),
    ).toBeUndefined();
  });
});

describe("styleImportSpecifier", () => {
  test("writes the path from the importing layout, not the project root", () => {
    expect(styleImportSpecifier("src/agent", "src/main.tsx")).toBe(
      "./agent/styles.css",
    );
    expect(styleImportSpecifier("src/agent", "src/app/layout.tsx")).toBe(
      "../agent/styles.css",
    );
    expect(styleImportSpecifier("src/agent", "app/layout.tsx")).toBe(
      "../src/agent/styles.css",
    );
    expect(styleImportSpecifier("src/agent", "src/routes/__root.tsx")).toBe(
      "../agent/styles.css",
    );
  });

  test("falls back to a project-root path when no layout is known", () => {
    expect(styleImportSpecifier("src/agent")).toBe("./src/agent/styles.css");
  });

  test("tolerates a custom --dir, trailing slashes, and Windows separators", () => {
    expect(styleImportSpecifier("lib/assistant/", "src/main.tsx")).toBe(
      "../lib/assistant/styles.css",
    );
    expect(styleImportSpecifier("src\\agent", "src\\main.tsx")).toBe(
      "./agent/styles.css",
    );
  });
});

describe("buildAgentConfig", () => {
  test("records version, paths, and hashes", () => {
    const config = buildAgentConfig("0.1.0", "src/agent", {
      "index.ts": "abc123",
    });
    expect(config).toEqual({
      $schema: AGENT_CONFIG_SCHEMA_URL,
      cli: "0.1.0",
      dir: "src/agent",
      content: "content/agent",
      files: { "index.ts": "abc123" },
    });
  });

  test("no provider is recorded — the model is the consumer's, not init's", () => {
    const config = buildAgentConfig("0.1.0", "src/agent", {});
    expect(config).not.toHaveProperty("provider");
  });

  test("the published schema stays in step with what init writes", () => {
    const schema = JSON.parse(
      readFileSync(new URL("../schema.json", import.meta.url), "utf8"),
    ) as {
      $id: string;
      required: string[];
      properties: Record<string, { enum?: string[] }>;
    };
    const config = buildAgentConfig("0.1.0", "src/agent", {});
    expect(schema.$id).toBe(AGENT_CONFIG_SCHEMA_URL);
    expect(config.$schema).toBe(AGENT_CONFIG_SCHEMA_URL);
    for (const key of Object.keys(config)) {
      expect(Object.keys(schema.properties)).toContain(key);
    }
    for (const key of schema.required) {
      expect(Object.keys(config)).toContain(key);
    }
    // `additionalProperties: false` means a leftover property here would make
    // every file init writes invalid against its own published schema.
    expect(Object.keys(schema.properties).toSorted()).toEqual(
      Object.keys(config).toSorted(),
    );
  });
});
