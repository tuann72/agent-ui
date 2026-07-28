import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  addCommand,
  AGENT_CONFIG_SCHEMA_URL,
  buildAgentConfig,
  detectPackageManager,
  installCommand,
  isProviderId,
  isTemplateFile,
  mergeDependencies,
  noProviderHint,
  PROVIDERS,
} from "./lib";

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
