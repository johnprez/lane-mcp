# Lane local MCP server

Run Lane's tools **on your own machine** and use them from **Claude Code** or the
**Claude Desktop** app. The server runs locally; it connects to your Lane
workspace with **your own personal access token**. No shared secrets ever touch
your machine — reads go straight to the database scoped to you, and writes go
through Lane's own API authenticated as you.

## What you get

Three tools, driven by your Claude:

| Tool | Does |
| --- | --- |
| `lane_list_workspaces` | Your workspaces, role, and which is active. |
| `lane_get_context` | Your plan graph — projects, milestones, activities, people, etc. Returns a readable summary **and** structured data Claude can turn into tables/timelines. |
| `lane_apply_action` | Create / update / delete one Lane object. Supports `preview` to see a change before applying it. |

## Prerequisites

- **Node.js 20+** (`node --version`). Install from https://nodejs.org or via nvm/homebrew.
- A **Lane account** you can sign into.

## Install

```sh
git clone <this-repo-url> lane-mcp
cd lane-mcp
./setup.sh
```

`setup.sh` will find a Node 20+, install & build, ask for your Lane token, and
print — and optionally wire up — the config for Claude Code and Claude Desktop.

### Get your token

In Lane: **Settings → Connect Claude → Generate token**. Copy it (shown once) and
paste it when `setup.sh` asks.

## Launch

- **Claude Code** — let `setup.sh` run `claude mcp add`, or copy the printed
  command. Then ask Claude: *"list my Lane workspaces."*
- **Claude Desktop** — let `setup.sh` merge the config, or paste the printed JSON
  into `~/Library/Application Support/Claude/claude_desktop_config.json`. **Fully
  quit and reopen** Claude Desktop (it only reads the config on launch).

## How it works

```
Your machine                                   Hosted
────────────────────────────────              ─────────────────────
Claude (Code / Desktop)
   │ stdio
   ▼
lane-mcp  (this server)
   ├─ reads ── mint session from your PAT ───▶ Lane /api/mcp/session
   │           then query directly ──────────▶ Supabase (RLS = you)
   └─ writes ── send action + your PAT ───────▶ Lane /api/mcp/apply
                                                (validates as you, RLS,
                                                 version guards)
```

Your token is the only credential stored locally. It never grants more than your
own access — every read and write is row-level-security scoped to your account.

## Troubleshooting

- **"Server disconnected" in Claude Desktop** — almost always an old Node on the
  app's launch PATH. `setup.sh` pins an absolute Node 20+ path in the config; if
  you edited the config by hand, make sure `command` points at a Node 20+ binary
  (e.g. `/opt/homebrew/bin/node`), not a bare `node`/`npx`.
- **"Lane rejected this token"** — regenerate one in Settings → Connect Claude
  and re-run `setup.sh`.
- **Connection errors** — check `LANE_API_URL` is reachable
  (`https://app.iamlane.com` by default). If it points at a local dev server,
  that server has to be running.
- **Logs** — Claude Desktop: `~/Library/Logs/Claude/mcp-server-lane.log`.

## Configuration

`setup.sh` handles this; for reference the server reads two env vars:

| Var | Default | Meaning |
| --- | --- | --- |
| `LANE_MCP_TOKEN` | _(required)_ | Your Lane personal access token. |
| `LANE_API_URL` | `https://app.iamlane.com` | Which Lane app to connect to. |

---

## For maintainers — repo layout

This repo is **only** the local MCP server. The Lane app and its MCP backend
endpoints (`/api/mcp/session`, `/api/mcp/apply`, the PAT panel) live in the app
repo, **github.com/johnprez/e-lane**.

`src/lane/` is vendored from the app so this repo builds standalone. Those four
files are the app's source of truth; refresh them after the app changes with:

```sh
./scripts/sync.sh /path/to/e-lane
```

The script re-copies and re-applies the standalone transforms (drops the app's
typed `Database` generic and `@/` path aliases). Review the diff, then
`npm run typecheck && npm run build`.
