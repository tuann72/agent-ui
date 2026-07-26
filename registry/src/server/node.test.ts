import { describe, expect, test } from "bun:test";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { toFetchRequest, toNodeHandler } from "./node";

async function listen(server: Server): Promise<number> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("no port");
  }
  return address.port;
}

describe("toNodeHandler", () => {
  test("bridges a Fetch handler onto node:http with body, status, headers", async () => {
    const handler = toNodeHandler(async (request) => {
      const body = (await request.json()) as { value: number };
      expect(request.method).toBe("POST");
      expect(new URL(request.url).pathname).toBe("/api/agent");
      return Response.json(
        { echoed: body.value },
        { status: 201, headers: { "x-agent": "yes" } },
      );
    });
    const server = createServer(handler);
    const port = await listen(server);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/agent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 42 }),
      });
      expect(response.status).toBe(201);
      expect(response.headers.get("x-agent")).toBe("yes");
      expect(await response.json()).toEqual({ echoed: 42 });
    } finally {
      server.close();
    }
  });

  test("streams a chunked response body through", async () => {
    const handler = toNodeHandler(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("hello "));
          controller.enqueue(new TextEncoder().encode("stream"));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { "content-type": "text/plain" },
      });
    });
    const server = createServer(handler);
    const port = await listen(server);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(await response.text()).toBe("hello stream");
    } finally {
      server.close();
    }
  });

  test("a throwing handler answers 500 instead of hanging the socket", async () => {
    const handler = toNodeHandler(async () => {
      throw new Error("handler exploded");
    });
    const server = createServer(handler);
    const port = await listen(server);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        method: "POST",
        body: "{}",
      });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "internal-error" });
    } finally {
      server.close();
    }
  });
});

describe("toFetchRequest", () => {
  test("reconstructs method, URL, and headers from the node request", async () => {
    let captured: Request | undefined;
    const server = createServer((req, res) => {
      captured = toFetchRequest(req);
      res.end();
    });
    const port = await listen(server);
    try {
      await fetch(`http://127.0.0.1:${port}/deep/path?q=1`, {
        headers: { "x-custom": "abc" },
      });
      expect(captured).toBeDefined();
      const url = new URL(captured!.url);
      expect(captured!.method).toBe("GET");
      expect(url.pathname).toBe("/deep/path");
      expect(url.searchParams.get("q")).toBe("1");
      expect(captured!.headers.get("x-custom")).toBe("abc");
      expect(captured!.body).toBeNull();
    } finally {
      server.close();
    }
  });
});
