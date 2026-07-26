import { toNodeHandler } from "@agent-ui/registry/server/node";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

const apiModule =
  process.env.AGENT_PLAYGROUND_API_MODULE ?? "/server/index.ts";

function agentApi(): Plugin {
  return {
    name: "agent-playground-api",
    configureServer(server) {
      server.middlewares.use("/api/health", async (_req, res, next) => {
        try {
          const module = await server.ssrLoadModule(apiModule);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(module.health ?? { ok: true }));
        } catch (error) {
          next(error);
        }
      });

      server.middlewares.use("/api/agent", async (req, res, next) => {
        try {
          const module = await server.ssrLoadModule(apiModule);
          if (typeof module.handler !== "function") {
            throw new TypeError(`${apiModule} must export a handler function.`);
          }
          toNodeHandler(module.handler)(req, res);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), agentApi()],
  resolve: {
    // The registry is a symlinked workspace package importing React itself;
    // dedupe so only one React instance ends up in the bundle.
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    exclude: ["@agent-ui/registry"],
  },
});
