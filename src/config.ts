/**
 * Local server configuration. A teammate only ever needs to set LANE_MCP_TOKEN
 * (their PAT from Settings → Connect Claude). Everything else has a sensible
 * default and the Supabase config is fetched from the hosted /session response.
 */
export type LaneMcpConfig = {
  token: string;
  apiUrl: string;
};

export function loadConfig(): LaneMcpConfig {
  const token = process.env.LANE_MCP_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "LANE_MCP_TOKEN is not set. Generate one in Lane → Settings → Connect Claude, then set it in your Claude MCP config.",
    );
  }
  const apiUrl = (process.env.LANE_API_URL?.trim() || "https://app.iamlane.com").replace(/\/$/, "");
  return { token, apiUrl };
}
