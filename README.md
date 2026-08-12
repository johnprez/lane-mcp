# Lane local MCP server

Run Lane's tools **on your own machine** and use them from **Claude Code** or the
**Claude Desktop** app. The server runs locally; it connects to your Lane
workspace with **your own personal access token**. No shared secrets ever touch
your machine — reads go straight to the database scoped to you, and writes go
through Lane's own API authenticated as you.

## What you get

Tools driven by your Claude, plus **interactive cards** in Claude Desktop
(dashboards, an approval card, quick create-forms, and a full tabbed activity
editor — see [CONNECT.md](./CONNECT.md#interactive-cards)). Clients that don't
support cards fall back to plain text.

| Tool | Does |
| --- | --- |
| `lane_list_workspaces` | Your workspaces, role, and which is active. |
| `lane_get_context` | Your plan graph — projects, milestones, activities, people, links, etc. Readable summary **and** structured data. |
| `lane_apply_action` | Create / update / delete one Lane object. Supports `preview` to see a change before applying it. |
| `lane_render_form` | Open an inline form to create an event, task, note, or link. |
| `lane_edit_activity` | Full activity editor (Details / Tasks / Notes / Links), create or edit. |
| `lane_edit_record` | Editor for a milestone, phase, deliverable, time-off entry, team member, role, or group. |
| `lane_edit_dependencies` | View / add / remove activity dependencies for a project. |
| `lane_view_tasks` | Interactive Tasks board — activities grouped by lane with progress, owner avatars, and their checklist tasks (Active/All/Done filters). |

## Prerequisites

- **Node.js 20+** (`node --version`). Install from https://nodejs.org or via nvm/homebrew.
- A **Lane account** you can sign into.

## Install

```sh
git clone <this-repo-url> lane-mcp
cd lane-mcp
./setup.sh
```

`setup.sh` finds a Node 20+, installs & builds, asks for your Lane token, and
wires up whichever client(s) you choose. The two clients run the server
differently (see below), but you don't have to think about it — `setup.sh` does
the right thing for each.

### Get your token

In Lane: **Settings → Connect Claude → Generate token**. Copy it (shown once) and
paste it when `setup.sh` asks.

## The two clients

- **Claude Code** runs the server as a small **local HTTP daemon** on
  `localhost` and connects to it as an HTTP MCP server. `setup.sh` installs a
  `launchd` agent so the daemon **auto-starts at login and stays running**, then
  runs `claude mcp add --transport http lane http://localhost:7337/mcp`.
  (Claude Code's enterprise policy permits HTTP-on-`localhost` servers, so this
  is the supported path — not stdio.)
- **Claude Desktop** spawns the server itself over **stdio**; `setup.sh` merges
  the config into `~/Library/Application Support/Claude/claude_desktop_config.json`.
  **Fully quit and reopen** Claude Desktop afterwards (it reads config on launch).

Then ask Claude: *"list my Lane workspaces."*

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

- **Claude Code: `lane` not connected** — the daemon may not be running. Check
  `launchctl list | grep lane-mcp`, restart it with
  `launchctl kickstart -k gui/$(id -u)/com.iamlane.lane-mcp`, and read
  `~/Library/Logs/lane-mcp.log`. The Claude Code URL **must** use hostname
  `localhost` (not `127.0.0.1`) — enterprise policy allows the former only.
- **"Server disconnected" in Claude Desktop** — almost always an old Node on the
  app's launch PATH. `setup.sh` pins an absolute Node 20+ path in the config; if
  you edited it by hand, make sure `command` points at a Node 20+ binary
  (e.g. `/opt/homebrew/bin/node`), not a bare `node`/`npx`. Logs:
  `~/Library/Logs/Claude/mcp-server-lane.log`.
- **"Lane rejected this token"** — regenerate one in Settings → Connect Claude
  and re-run `setup.sh`.
- **Connection errors** — check `LANE_API_URL` is reachable
  (`https://app.iamlane.com` by default). If it points at a local dev server,
  that server has to be running.

## Configuration

`setup.sh` handles this; for reference the server reads:

| Var | Default | Meaning |
| --- | --- | --- |
| `LANE_MCP_TOKEN` | _(required)_ | Your Lane personal access token. |
| `LANE_API_URL` | `https://app.iamlane.com` | Which Lane app to connect to. |
| `LANE_MCP_TRANSPORT` | `stdio` | `stdio` (Desktop) or `http` (Claude Code daemon). |
| `LANE_MCP_PORT` | `7337` | Port for the HTTP daemon (bound to `localhost`). |

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
