import { createServer } from "node:http";
import { Readable } from "node:stream";

import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";

import { registerLaneTools } from "./tools.js";
import { LANE_INSTRUCTIONS } from "./instructions.js";
import type { LaneSession } from "./session.js";

/**
 * Local HTTP transport. Runs the MCP server as a loopback daemon so it can be
 * added to Claude Code as an HTTP server — the transport enterprise policy
 * allows, where it blocks stdio/command servers. Bound to 127.0.0.1 only; the
 * PAT-backed session is process-global, so requests need no per-request auth
 * (nothing off this machine can reach it).
 */
const PATH = "/mcp";

export function serveHttp(session: LaneSession, opts: { host: string; port: number }): void {
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: "lane", version: "1.0.0" }, { capabilities: { tools: {} }, instructions: LANE_INSTRUCTIONS });
    registerLaneTools(server, session);
    return server;
  });

  const httpServer = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${opts.host}:${opts.port}`}`);
      if (url.pathname !== PATH) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      const method = req.method ?? "GET";
      let body: Buffer | undefined;
      if (method !== "GET" && method !== "HEAD") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        body = Buffer.concat(chunks);
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") headers.set(key, value);
      }
      const request = new Request(url, { method, headers, body });
      const response = await handler.fetch(request);

      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body as import("node:stream/web").ReadableStream).pipe(res);
      else res.end();
    } catch (error) {
      console.error("[lane-mcp] http error", error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal error");
      }
    }
  });

  httpServer.listen(opts.port, opts.host, () => {
    console.error(`[lane-mcp] ready (http) on http://${opts.host}:${opts.port}${PATH}`);
  });
}
