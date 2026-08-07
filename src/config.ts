/**
 * Local server configuration. A teammate only ever needs to set LANE_MCP_TOKEN
 * (their PAT from Settings → Connect Claude). Everything else has a sensible
 * default and the Supabase config is fetched from the hosted /session response.
 *
 * Transport:
 *   - "stdio" (default) — Claude Desktop spawns the server over stdio.
 *   - "http"            — the server runs as a local daemon on 127.0.0.1 and
 *                         Claude Code connects to it as an HTTP MCP server
 *                         (required where enterprise policy blocks stdio servers).
 */
export type LaneTransport = "stdio" | "http";

export type LaneMcpConfig = {
  token: string;
  apiUrl: string;
  transport: LaneTransport;
  port: number;
  host: string;
};

export function loadConfig(): LaneMcpConfig {
  const token = process.env.LANE_MCP_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "LANE_MCP_TOKEN is not set. Generate one in Lane → Settings → Connect Claude, then set it in your Claude MCP config.",
    );
  }
  const apiUrl = (process.env.LANE_API_URL?.trim() || "https://app.iamlane.com").replace(/\/$/, "");
  const transport: LaneTransport = process.env.LANE_MCP_TRANSPORT?.trim() === "http" ? "http" : "stdio";
  const port = Number(process.env.LANE_MCP_PORT?.trim() || "7337");
  // Bind loopback only — never expose the server beyond this machine.
  const host = "127.0.0.1";
  return { token, apiUrl, transport, port, host };
}
