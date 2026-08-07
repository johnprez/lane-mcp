import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { loadConfig } from "./config.js";
import { LaneSession } from "./session.js";
import { registerLaneTools } from "./tools.js";
import { serveHttp } from "./http.js";

/**
 * Lane local MCP server. Runs on the teammate's machine and connects to their
 * Lane workspace with their own PAT: reads go direct to Supabase (RLS), writes
 * go to Lane's hosted, HMAC-signed write endpoint. No server-side secrets ever
 * live on this machine.
 *
 * Two transports (see config): stdio for Claude Desktop, or a loopback HTTP
 * daemon for Claude Code (where enterprise policy blocks stdio servers).
 */
function main() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    // stderr surfaces in the MCP client's server logs.
    console.error(`[lane-mcp] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const session = new LaneSession(config);

  if (config.transport === "http") {
    serveHttp(session, { host: config.host, port: config.port });
    return;
  }

  serveStdio(() => {
    const server = new McpServer({ name: "lane", version: "1.0.0" }, { capabilities: { tools: {} } });
    registerLaneTools(server, session);
    return server;
  });
  console.error("[lane-mcp] ready (stdio)");
}

main();
