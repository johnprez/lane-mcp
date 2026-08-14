# Connect Lane to Claude — Mac setup guide

This lets you use **Lane** from **Claude** (the Claude Desktop app or Claude
Code). You'll be able to ask Claude, in plain English, to read your Lane
projects, draft plans, and make changes — and it acts **as you**: it only ever
sees or touches what your own Lane login can.

**No coding required.** This guide assumes you've never opened Terminal and
don't know what "git" or "Node" are. Just follow the steps in order and
copy-paste the commands. The one-time setup takes about **10–15 minutes**, most
of it waiting for things to download.

> **How to use the commands in this guide:** when you see a gray box with a
> command in it, click the little copy icon (or select the text and press
> **⌘C**), click on the Terminal window, paste with **⌘V**, and press
> **Return** to run it. That's the whole rhythm: copy → paste → Return.

---

## Part 1 — One-time setup

### Step 1 — Open Terminal

"Terminal" is a Mac app for typing commands. To open it:

1. Press **⌘ (Command) + Space** to open Spotlight search.
2. Type **`Terminal`**.
3. Press **Return**. A window with a blank prompt opens.

(Alternatively: **Finder → Applications → Utilities → Terminal**.)

Leave this window open — you'll use it for the next few steps.

> **Tip:** When you type or paste a password later, Terminal shows **nothing** —
> no dots, no stars. That's normal and on purpose. Just type it and press Return.

### Step 2 — Install Homebrew

**Homebrew** is the standard, safe way to install developer tools on a Mac. It
installs everything else we need. Copy this whole line, paste it into Terminal,
and press **Return**:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

While it runs:

- It will **ask for your Mac password** — type it (remember, nothing shows) and
  press Return.
- It may say it needs to install the **"Command Line Developer Tools"** — click
  **Install** and let it finish (a few minutes).
- It will print a line like *"Installation successful!"* when done.

**If you have an Apple Silicon Mac** (M1/M2/M3/M4 — most Macs since 2020),
Homebrew will print a **"Next steps"** note asking you to run two more commands.
Copy-paste these two lines to finish wiring it up:

```sh
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Check it worked:

```sh
brew --version
```

You should see something like `Homebrew 4.x.x`. If you get "command not found,"
close Terminal, reopen it (Step 1), and try `brew --version` again.

### Step 3 — Install Git and Node

These two tools let you download the connector and run it. One command installs
both:

```sh
brew install git node
```

Let it finish, then confirm both are installed:

```sh
git --version && node --version
```

You should see a git version and a Node version of **v20 or higher** (e.g.
`v22.x.x`). If Node shows v19 or lower, run `brew upgrade node`.

### Step 4 — Get your Lane token

A "token" is a private key that lets the connector sign in to Lane **as you**.
Treat it like a password.

1. Open **Lane** in your browser and sign in.
2. Go to **Settings → Connect Claude → Generate token**.
3. **Copy the token immediately** — it's shown only once. Paste it somewhere
   safe for a minute (you'll need it in Step 6).

You can revoke this token anytime from the same screen.

### Step 5 — Download the connector

This downloads the connector into a folder called `lane-mcp` in your home
directory. Paste these two lines (run them one at a time or together):

```sh
git clone https://github.com/johnprez/lane-mcp.git ~/lane-mcp
cd ~/lane-mcp
```

> If Git asks you to sign in to GitHub, use your GitHub account. If you get a
> "repository not found" or permission error, ask John to grant you access to
> **github.com/johnprez/lane-mcp**, then run the command again.

### Step 6 — Run the installer

One command sets everything up:

```sh
./setup.sh
```

The installer will:

1. Find your Node, install the connector's pieces, and build it.
2. **Ask for your Lane token** — paste the one from Step 4 and press Return.
3. **Ask which Claude app you use** — choose **Claude Code**, **Claude Desktop**,
   or **Both**.
4. **Ask for the Lane web address** — just press Return to accept the default
   (`https://app.iamlane.com`).

When it finishes it prints a success message.

### Step 7 — Finish in your Claude app

- **Claude Desktop:** fully **quit** the app (**⌘Q**) and reopen it, so it picks
  up the connector. (Just closing the window isn't enough.)
- **Claude Code:** it's ready immediately — no restart needed.

### Step 8 — Try it

In Claude, type:

> **"List my Lane workspaces."**

If you see your Lane workspaces come back, **you're done.** 🎉 Skip to
[Part 2](#part-2--what-you-can-do) to see everything you can ask.

If it doesn't work, see [Troubleshooting](#troubleshooting) — it's almost always
one of two small things.

---

## Part 2 — What you can do

You never type "commands" yourself — you just **ask Claude in plain English**,
and it picks the right tool and action. This section shows the full range so you
know what's possible.

### The tools Claude uses

| Tool | What it does |
| --- | --- |
| **List workspaces** (`lane_list_workspaces`) | Shows your workspaces, your role, and which one is active. |
| **Read context** (`lane_get_context`) | Reads your plan — projects, lanes, milestones, activities, tasks, events, people, notes, links, dependencies. Gives Claude both a readable summary and the structured data to build tables/timelines. |
| **Apply a change** (`lane_apply_action`) | Makes one change (create / update / delete). Supports **preview** — see exactly what would change before applying. |
| **Quick form** (`lane_render_form`) | Opens an inline form to create an event, task, note, or link. |
| **Activity editor** (`lane_edit_activity`) | Full editor for an activity — Details, Tasks, Notes, Links. |
| **Record editor** (`lane_edit_record`) | Editor for a milestone, phase, deliverable, time-off entry, team member, role, or group. |
| **Dependencies** (`lane_edit_dependencies`) | View, add, or remove activity dependencies for a project. |
| **Tasks board** (`lane_view_tasks`) | Interactive board — activities grouped by lane with progress, owners, and their checklist tasks. |

### Everything Claude can change for you

Under the hood, "Apply a change" supports **54 specific actions** across every
part of a Lane plan. You don't memorize these — you just describe what you want.
Here's the full set, grouped:

| Area | What Claude can do |
| --- | --- |
| **Lanes** (workstreams) | create, update, delete |
| **Phases** | create, update |
| **Milestones** | create, update, delete |
| **Activities** (work items) | create, update, delete, **bulk-update** many at once |
| **Tasks** (checklist items) | create, update, delete, **bulk-create** from a pasted list/table |
| **Events** | create, update |
| **Deliverables** | create, update, delete |
| **Dependencies** | create, update, delete (activity → activity, and plan-level links) |
| **People** | create, update, archive, remove from a project |
| **Roles** | create, update, archive |
| **Groups** (teams) | create, update, archive |
| **Time off** (PTO) | create, update, delete |
| **Notes** | create, update, delete — on activities, milestones, events, and deliverables |
| **Links** | create, update, delete |

**Always safe:** the connector can never do anything you couldn't do yourself in
Lane, it can only change **one thing per action**, and for anything you're unsure
about you can ask it to **preview first**. It never invites people, changes
permissions, or deletes without showing you.

### Example things to say

Reading:

> "What's the status of my projects in Lane?"
> "Which activities are blocked or overdue?"
> "Turn my current plan into a timeline table."
> "Who's out on PTO next week?"

Making changes (ask to **preview** first if you want to see it before it happens):

> "Add a milestone called 'Beta launch' to the Onboarding project, targeting Sept 30."
> "Create a 'Design' lane and add three activities: wireframes, prototype, handoff."
> "Here's a list of tasks from a doc — add them to the Kickoff activity." *(paste the list)*
> "Mark the research activity as in-progress and set its due date to Friday."
> "Add a dependency so 'Build' can't start until 'Design' finishes."
> "Log time off for Zach from the 12th to the 16th."

### Interactive cards (Claude Desktop only)

In **Claude Desktop**, Lane replies with live, clickable cards instead of plain
text:

- **Plan overview** — clickable tiles for blocked / unscheduled / overdue work, a
  by-lane breakdown, and an upcoming-milestone timeline.
- **Activity editor** — a tabbed editor (Details, Tasks, Notes, Links).
- **Record editors** — for milestones, phases, deliverables, time off, people,
  roles, and groups.
- **Dependencies** — add/remove predecessor → successor links.
- **Approval card** — before a change, Lane shows the exact diff with **Apply** /
  **Cancel** buttons.
- **Quick forms** — create events, tasks, notes, and links inline.

Just ask in plain language; Claude opens the right card. (Claude Code and older
clients fall back to plain text automatically.)

---

## Part 3 — Keeping it working

### Updating the connector later

When there's a new version, open Terminal and run:

```sh
cd ~/lane-mcp
git pull
./setup.sh
```

Then quit and reopen Claude Desktop (⌘Q) if you use it.

### Troubleshooting

Almost every problem is one of these. Open Terminal to run any fixes.

- **Claude Desktop says "server disconnected"** — usually an old Node. Run
  `node --version` (needs v20+); if it's older, `brew upgrade node`, then
  `cd ~/lane-mcp && ./setup.sh` and restart Claude Desktop.
  Log file: `~/Library/Logs/Claude/mcp-server-lane.log`
- **Claude Code: `lane` not connected** — the little background helper may not be
  running. Restart it:
  `launchctl kickstart -k gui/$(id -u)/com.iamlane.lane-mcp`
  Log file: `~/Library/Logs/lane-mcp.log`
- **"Lane rejected this token"** — generate a fresh token (Settings → Connect
  Claude), then `cd ~/lane-mcp && ./setup.sh` and paste the new one.
- **Still stuck?** Send John the relevant log file above.

### Turning it off / revoking access

- **Revoke the connection anytime** in Lane: **Settings → Connect Claude** →
  revoke the token. That instantly cuts off the connector — no matter what's on
  your machine.
- To remove the local files: `rm -rf ~/lane-mcp` (and, if you used Claude Code,
  `launchctl bootout gui/$(id -u)/com.iamlane.lane-mcp` to stop the helper).

### Your privacy & security

- **Scoped to you.** Every read and write runs under your own Lane identity
  (row-level security). You can't see or change anything you couldn't in the app.
- **Nothing shared lives on your machine.** The only credential stored locally is
  your personal token, which you can revoke anytime.
- **No always-on setup.** It talks to the live Lane app; there's nothing else to
  keep running.

---

## Reference (technical)

### How it works

```
Your machine                                   Hosted
────────────────────────────────              ─────────────────────
Claude (Code / Desktop)
   │ stdio (Desktop) or localhost HTTP (Code)
   ▼
lane-mcp  (this server)
   ├─ reads ── mint session from your PAT ───▶ Lane /api/mcp/session
   │           then query directly ──────────▶ Supabase (RLS = you)
   └─ writes ── send action + your PAT ───────▶ Lane /api/mcp/apply
                                                (validates as you, RLS,
                                                 version guards)
```

Two client transports (handled automatically by `setup.sh`):

- **Claude Desktop** spawns the server over **stdio**; config is merged into
  `~/Library/Application Support/Claude/claude_desktop_config.json`.
- **Claude Code** runs the server as a small **local HTTP daemon** on
  `localhost:7337` via a `launchd` agent (auto-starts at login), registered with
  `claude mcp add --transport http lane http://localhost:7337/mcp`. (Claude
  Code's enterprise policy permits HTTP-on-`localhost`, not stdio — the URL must
  use hostname `localhost`, not `127.0.0.1`.)

### Configuration

`setup.sh` writes these for you; for reference the server reads:

| Var | Default | Meaning |
| --- | --- | --- |
| `LANE_MCP_TOKEN` | _(required)_ | Your Lane personal access token. |
| `LANE_API_URL` | `https://app.iamlane.com` | Which Lane app to connect to. |
| `LANE_MCP_TRANSPORT` | `stdio` | `stdio` (Desktop) or `http` (Claude Code daemon). |
| `LANE_MCP_PORT` | `7337` | Port for the HTTP daemon (bound to `localhost`). |

### For maintainers

This repo is **only** the local MCP server. The Lane app and its MCP backend
endpoints (`/api/mcp/session`, `/api/mcp/apply`, the PAT panel) live in the app
repo, **github.com/johnprez/e-lane**.

`src/lane/` is vendored from the app so this repo builds standalone. Those files
are the app's source of truth; refresh them after the app changes with:

```sh
./scripts/sync.sh /path/to/e-lane
```

The script re-copies and re-applies the standalone transforms (drops the app's
typed `Database` generic and `@/` path aliases). Review the diff, then
`npm run typecheck && npm run build`.
