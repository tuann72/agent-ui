import { defineConfig, devices } from "@playwright/test";

/**
 * Browser suite for the Agent playground. Vite serves the app and mounts the
 * Fetch-standard mock API as dev middleware on :5173. The mock model is
 * deterministic, so these tests exercise real streaming, tool approval, and
 * DOM effects offline.
 */
export default defineConfig({
  testDir: "./e2e",
  // *.e2e.ts, not *.spec.ts/*.test.ts: `bun test` must never pick these up.
  testMatch: /.*\.e2e\.ts/,
  // Keep the narrow component baselines portable across local macOS and Linux
  // CI. The project name still separates browser renderers.
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    // A dedicated port, not dev's 5173: reusing a `bun run playground` or
    // dev-real server would silently run the suite against the wrong backend
    // (a real provider instead of the deterministic mock).
    baseURL: "http://localhost:5183",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev --port 5183 --strictPort",
    port: 5183,
    reuseExistingServer: !process.env.CI,
  },
});
