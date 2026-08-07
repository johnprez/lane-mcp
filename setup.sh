#!/usr/bin/env bash
# Lane local MCP — one-command setup (macOS).
# Installs deps, builds, collects your Lane token, and wires up your clients:
#   - Claude Code   → a loopback HTTP daemon (launchd, auto-starts) + `claude mcp add`
#                     (Claude Code's policy allows HTTP-on-localhost, not stdio)
#   - Claude Desktop→ a stdio server spawned by the app
# Pins an absolute modern-Node path so nothing falls back to an ancient node/npx.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

say() { printf '\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

# --- 1. Node >= 20 (absolute path) --------------------------------------------
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
say "Installing dependencies…"; npm install --silent
say "Building…"; npm run build --silent
DIST="$SCRIPT_DIR/dist/index.mjs"
[ -f "$DIST" ] || die "Build did not produce $DIST"

# --- 3. Config -----------------------------------------------------------------
printf '\n'
read -rp "Paste your Lane token (Settings → Connect Claude → Generate): " TOKEN
[ -n "${TOKEN:-}" ] || die "A token is required."
read -rp "Lane API URL [https://app.iamlane.com]: " API_URL; API_URL="${API_URL:-https://app.iamlane.com}"
read -rp "Local HTTP port for Claude Code [7337]: " PORT; PORT="${PORT:-7337}"

printf '\nWhich client(s)?\n  1) Claude Code\n  2) Claude Desktop\n  3) Both\n'
read -rp "Choose [3]: " CHOICE; CHOICE="${CHOICE:-3}"

# --- 4a. Claude Code — launchd HTTP daemon + claude mcp add -------------------
setup_claude_code() {
  local plist="$HOME/Library/LaunchAgents/com.iamlane.lane-mcp.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.iamlane.lane-mcp</string>
  <key>ProgramArguments</key><array>
    <string>$NODE_BIN</string><string>$DIST</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>LANE_MCP_TOKEN</key><string>$TOKEN</string>
    <key>LANE_API_URL</key><string>$API_URL</string>
    <key>LANE_MCP_TRANSPORT</key><string>http</string>
    <key>LANE_MCP_PORT</key><string>$PORT</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/lane-mcp.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/lane-mcp.log</string>
</dict></plist>
PLIST
  launchctl unload "$plist" >/dev/null 2>&1 || true
  launchctl load -w "$plist"
  say "✓ Daemon installed (launchd: com.iamlane.lane-mcp) — auto-starts at login, logs → ~/Library/Logs/lane-mcp.log"
  sleep 1
  if command -v claude >/dev/null 2>&1; then
    claude mcp remove lane >/dev/null 2>&1 || true
    # NOTE: the policy requires the hostname 'localhost' (not 127.0.0.1).
    claude mcp add --transport http lane "http://localhost:$PORT/mcp" \
      && say "✓ Added to Claude Code (http://localhost:$PORT/mcp)" || warn "Add manually: claude mcp add --transport http lane http://localhost:$PORT/mcp"
  else
    warn "claude CLI not found. Run: claude mcp add --transport http lane http://localhost:$PORT/mcp"
  fi
}

# --- 4b. Claude Desktop — stdio server ----------------------------------------
setup_desktop() {
  local cfg="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
  mkdir -p "$(dirname "$cfg")"
  LANE_NODE="$NODE_BIN" LANE_DIST="$DIST" LANE_TOKEN="$TOKEN" LANE_URL="$API_URL" LANE_CFG="$cfg" "$NODE_BIN" <<'NODE'
const fs = require("node:fs");
const p = process.env.LANE_CFG;
const cfg = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
if (fs.existsSync(p)) fs.copyFileSync(p, p + ".bak");
cfg.mcpServers = cfg.mcpServers || {};
cfg.mcpServers.lane = {
  command: process.env.LANE_NODE,
  args: [process.env.LANE_DIST],
  env: { LANE_MCP_TOKEN: process.env.LANE_TOKEN, LANE_API_URL: process.env.LANE_URL },
};
fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n");
console.log("✓ Merged into " + p + " (backup: .bak)");
NODE
  say "✓ Claude Desktop configured — fully quit and reopen it."
}

case "$CHOICE" in
  1) setup_claude_code ;;
  2) setup_desktop ;;
  *) setup_claude_code; printf '\n'; setup_desktop ;;
esac

printf '\n'; say "Done. Try: “list my Lane workspaces”."
