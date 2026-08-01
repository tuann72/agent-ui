import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  addCommand,
  AGENT_CONFIG_SCHEMA_URL,
  buildAgentConfig,
  detectInstalledProvider,
  detectPackageManager,
  installCommand,
  isProviderId,
  isTemplateFile,
  mergeDependencies,
  MIN_REACT_MAJOR,
  needsNodeTypes,
  noProviderHint,
  pickRootLayout,
  pickViteConfig,
  PROVIDERS,
  reactVersionWarning,
  ROOT_LAYOUT_FILES,
  styleImportSpecifier,
  viteEnvHint,
} from "./lib";

/** `pickRootLayout`'s fs probe, backed by a fixed set instead of a disk. */
const present =
  (...files: string[]) =>
  (file: string) =>
    files.includes(file);

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
  test("ids validate and carry adapter + env metadata", () => {
    expect(isProviderId("openai")).toBe(true);
    expect(isProviderId("anthropic")).toBe(true);
    expect(isProviderId("google")).toBe(true);
    expect(isProviderId("none")).toBe(false);
    expect(isProviderId("mistral")).toBe(false);
    for (const info of Object.values(PROVIDERS)) {
      expect(info.pkg).toStartWith("@ai-sdk/");
      expect(info.env.length).toBeGreaterThan(0);
      expect(info.importName.length).toBeGreaterThan(0);
      expect(info.defaultModel.length).toBeGreaterThan(0);
    }
  });

  test("no-provider hint lists every adapter with its pinned range", () => {
    const hint = noProviderHint("npm").join("\n");
    for (const info of Object.values(PROVIDERS)) {
      expect(hint).toContain(`"${info.pkg}@${info.range}"`);
      expect(hint).toContain(info.env);
    }
    expect(hint).toContain("latest");
  });

  test("an already-declared adapter is detected in any dependency section", () => {
    expect(
      detectInstalledProvider({ dependencies: { "@ai-sdk/google": "2.0.86" } }),
    ).toBe("google");
    expect(
      detectInstalledProvider({ devDependencies: { "@ai-sdk/openai": "^2" } }),
    ).toBe("openai");
    expect(
      detectInstalledProvider({ peerDependencies: { "@ai-sdk/anthropic": "^2" } }),
    ).toBe("anthropic");
  });

  test("no adapter, or only non-adapter deps, detects nothing", () => {
    expect(detectInstalledProvider({})).toBeUndefined();
    expect(
      detectInstalledProvider({ dependencies: { ai: "^5", zod: "^4" } }),
    ).toBeUndefined();
  });

  test("two adapters tie-break on PROVIDERS order, not object iteration", () => {
    const first = (Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[])[0];
    expect(
      detectInstalledProvider({
        dependencies: { "@ai-sdk/google": "^2" },
        devDependencies: { "@ai-sdk/openai": "^2" },
      }),
    ).toBe(first);
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
});

describe("pickRootLayout", () => {
  test("recognises each framework's root", () => {
    expect(pickRootLayout(present("app/layout.tsx"))).toBe("app/layout.tsx");
    expect(pickRootLayout(present("app/root.tsx"))).toBe("app/root.tsx");
    expect(pickRootLayout(present("src/routes/__root.tsx"))).toBe(
      "src/routes/__root.tsx",
    );
    expect(pickRootLayout(present("src/main.tsx"))).toBe("src/main.tsx");
  });

  test("a framework root outranks the generic entry it ships beside", () => {
    // React Router and TanStack projects routinely keep a src/main.tsx around;
    // the outermost module still owns the global stylesheet.
    expect(pickRootLayout(present("src/main.tsx", "app/root.tsx"))).toBe(
      "app/root.tsx",
    );
    expect(
      pickRootLayout(present("src/App.tsx", "src/routes/__root.tsx")),
    ).toBe("src/routes/__root.tsx");
    expect(pickRootLayout(present("src/App.tsx", "src/main.tsx"))).toBe(
      "src/main.tsx",
    );
  });

  test("reports nothing when no candidate exists", () => {
    expect(pickRootLayout(present())).toBeUndefined();
    expect(pickRootLayout(present("index.html", "vite.config.ts"))).toBeUndefined();
  });

  test("every candidate is a path styleImportSpecifier can resolve from", () => {
    for (const file of ROOT_LAYOUT_FILES) {
      expect(styleImportSpecifier("src/agent", file)).toMatch(
        /^\.{1,2}\/.*styles\.css$/,
      );
    }
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
  test("records version, paths, provider, and hashes", () => {
    const config = buildAgentConfig("0.1.0", "src/agent", "anthropic", {
      "index.ts": "abc123",
    });
    expect(config).toEqual({
      $schema: AGENT_CONFIG_SCHEMA_URL,
      cli: "0.1.0",
      dir: "src/agent",
      content: "content/agent",
      provider: "anthropic",
      files: { "index.ts": "abc123" },
    });
  });

  test("the published schema stays in step with what init writes", () => {
    const schema = JSON.parse(
      readFileSync(new URL("../schema.json", import.meta.url), "utf8"),
    ) as {
      $id: string;
      required: string[];
      properties: Record<string, { enum?: string[] }>;
    };
    const config = buildAgentConfig("0.1.0", "src/agent", "none", {});
    expect(schema.$id).toBe(AGENT_CONFIG_SCHEMA_URL);
    expect(config.$schema).toBe(AGENT_CONFIG_SCHEMA_URL);
    for (const key of Object.keys(config)) {
      expect(Object.keys(schema.properties)).toContain(key);
    }
    for (const key of schema.required) {
      expect(Object.keys(config)).toContain(key);
    }
    expect(schema.properties.provider?.enum?.toSorted()).toEqual(
      [...Object.keys(PROVIDERS), "none"].toSorted(),
    );
  });
});
