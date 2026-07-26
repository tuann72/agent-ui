/**
 * Node http bridge for the Fetch-standard Agent handler. Vite dev middleware,
 * Express, and plain node:http servers speak (IncomingMessage, ServerResponse);
 * this adapter lets them mount `createAgentHandler` without hand-writing the
 * translation. Kept out of server/index.ts so Bun/edge consumers never load
 * node:http.
 *
 * Vite example (vite.config.ts):
 *
 *   import { createAgentHandler } from "./src/agent/server";
 *   import { toNodeHandler } from "./src/agent/server/node";
 *
 *   const agentDevServer = () => ({
 *     name: "agent-dev-server",
 *     configureServer(server) {
 *       const handler = toNodeHandler(createAgentHandler({ model, manifest }));
 *       server.middlewares.use("/api/agent", handler);
 *     },
 *   });
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

/** Build a Fetch Request from a Node request, streaming the body through. */
export function toFetchRequest(
  req: IncomingMessage,
  signal?: AbortSignal,
): Request {
  const protocol =
    (req.socket as { encrypted?: boolean }).encrypted === true
      ? "https"
      : "http";
  const url = new URL(req.url ?? "/", `${protocol}://${req.headers.host ?? "localhost"}`);
  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) for (const item of value) headers.append(name, item);
  }
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : // node:stream/web and DOM disagree on ReadableStream generics.
        (Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>);
  return new Request(url, {
    method,
    headers,
    body,
    signal,
    // Streaming request bodies require half-duplex; not yet in TS's RequestInit.
    ...(body ? { duplex: "half" } : {}),
  } as RequestInit);
}

/**
 * Wrap a Fetch `Request → Response` handler as a Node
 * `(req, res)` listener. Client disconnects abort the in-flight model call
 * via the request signal.
 */
export function toNodeHandler(
  handler: (request: Request) => Promise<Response>,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) controller.abort();
    });
    void (async () => {
      const response = await handler(toFetchRequest(req, controller.signal));
      const headers: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        headers[name] = value;
      });
      res.writeHead(response.status, headers);
      if (!response.body) {
        res.end();
        return;
      }
      Readable.fromWeb(
        response.body as unknown as NodeReadableStream<Uint8Array>,
      ).pipe(res);
    })().catch((error) => {
      if (controller.signal.aborted) return;
      console.error("[agent] node handler error:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
      }
      if (!res.writableEnded) res.end(JSON.stringify({ error: "internal-error" }));
    });
  };
}
