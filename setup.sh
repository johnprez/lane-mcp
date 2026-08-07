#!/usr/bin/env bash
# Lane local MCP — one-command setup.
# Installs deps, builds, collects your Lane token, and prints (or wires up) the
# Claude Code + Claude Desktop config. Pins an absolute modern-Node launcher so
# Claude Desktop can't fall back to an ancient `node`/`npx` on your PATH.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

say() { printf '\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

# --- 1. Find a Node >= 20 and use its absolute path everywhere -----------------
node_major() { "$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
find_node() {
  if command -v node >/dev/null 2>&1 && [ "$(node_major node)" -ge 20 ]; then command -v node; return 0; fi
  local c
  for c in /opt/homebrew/bin/node /usr/local/bin/node $(ls -d "$HOME"/.nvm/versions/node/v2*/bin/node 2>/dev/null | sort -V -r); do
    [ -x "$c" ] && [ "$(node_major "$c")" -ge 20 ] && { echo "$c"; return 0; }
  done
  return 1
}
NODE_BIN="$(find_node)" || die "Node.js 20+ is required and was not found. Install it (https://nodejs.org) and re-run."
NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="$NODE_DIR:$PATH"
say "Using Node $("$NODE_BIN" --version) at $NODE_BIN"

# --- 2. Install + build --------------------------------------------------------
say "Installing dependencies…"
npm install --silent
say "Building…"
npm run build --silent
DIST="$SCRIPT_DIR/dist/index.mjs"
[ -f "$DIST" ] || die "Build did not produce $DIST"

# --- 3. Collect config ---------------------------------------------------------
printf '\n'
read -rp "Paste your Lane token (Settings → Connect Claude → Generate): " TOKEN
[ -n "${TOKEN:-}" ] || die "A token is required."
read -rp "Lane API URL [https://app.iamlane.com]: " API_URL
API_URL="${API_URL:-https://app.iamlane.com}"

# --- 4. Emit the two client configs -------------------------------------------
CLI_CMD="claude mcp add lane --env LANE_MCP_TOKEN=$TOKEN --env LANE_API_URL=$API_URL -- \"$NODE_BIN\" \"$DIST\""
DESKTOP_JSON=$(cat <<JSON
{
  "mcpServers": {
    "lane": {
      "command": "$NODE_BIN",
      "args": ["$DIST"],
      "env": { "LANE_MCP_TOKEN": "$TOKEN", "LANE_API_URL": "$API_URL" }
    }
  }
}
JSON
)

printf '\n'; say "── Claude Code ──"
echo "$CLI_CMD"
printf '\n'; say "── Claude Desktop  (~/Library/Application Support/Claude/claude_desktop_config.json) ──"
echo "$DESKTOP_JSON"

# --- 5. Offer to wire it up automatically -------------------------------------
printf '\n'
if command -v claude >/dev/null 2>&1; then
  read -rp "Register with Claude Code now? [Y/n]: " ANS
  if [[ ! "${ANS:-Y}" =~ ^[Nn] ]]; then
    claude mcp add lane --env "LANE_MCP_TOKEN=$TOKEN" --env "LANE_API_URL=$API_URL" -- "$NODE_BIN" "$DIST" \
      && say "✓ Added to Claude Code." || warn "Could not add automatically — copy the command above."
  fi
fi

DESKTOP_CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
if [ -d "$(dirname "$DESKTOP_CFG")" ]; then
  read -rp "Merge into Claude Desktop config now? [y/N]: " ANS
  if [[ "${ANS:-N}" =~ ^[Yy] ]]; then
    LANE_NODE="$NODE_BIN" LANE_DIST="$DIST" LANE_TOKEN="$TOKEN" LANE_URL="$API_URL" LANE_CFG="$DESKTOP_CFG" "$NODE_BIN" <<'NODE'
const fs = require("node:fs");
const cfgPath = process.env.LANE_CFG;
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, "utf8")) : {};
if (fs.existsSync(cfgPath)) fs.copyFileSync(cfgPath, cfgPath + ".bak");
cfg.mcpServers = cfg.mcpServers || {};
cfg.mcpServers.lane = {
  command: process.env.LANE_NODE,
  args: [process.env.LANE_DIST],
  env: { LANE_MCP_TOKEN: process.env.LANE_TOKEN, LANE_API_URL: process.env.LANE_URL },
};
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
console.log("✓ Merged into " + cfgPath + " (backup: .bak). Fully quit and reopen Claude Desktop.");
NODE
  fi
fi

printf '\n'; say "Done. Try: “list my Lane workspaces”."
