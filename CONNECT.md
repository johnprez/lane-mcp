# Connect Claude to Lane

Use Lane from **Claude Code** or the **Claude Desktop** app — ask it to read your
projects, draft plans, and make changes, all in plain language. The connector
runs **on your machine** and acts **as you**: it only ever sees what your Lane
login can see, and every change is one you could make yourself in the app.

Takes about 3 minutes.

## Before you start

- **Node.js 20+** — check with `node --version`. (Install: https://nodejs.org, or `brew install node`.)
- A **Lane account** you can sign into.
- Access to the connector repo: **https://github.com/johnprez/lane-mcp** (ask John if you can't see it).

## 1. Get your token

In Lane: **Settings → Connect Claude → Generate token**. Copy it right away —
it's shown only once. Treat it like a password (it's tied to your account).

## 2. Install the connector

```sh
git clone https://github.com/johnprez/lane-mcp.git
cd lane-mcp
./setup.sh
```

The script installs everything, asks for your token, and asks which client(s)
you use — **Claude Code**, **Claude Desktop**, or **Both**. Accept the default
Lane URL when prompted. That's it — it wires up the config for you.

- **Claude Code**: ready immediately.
- **Claude Desktop**: **fully quit and reopen it** (⌘Q, then relaunch) so it
  picks up the connector.

## 3. Try it

Ask Claude:

> **"List my Lane workspaces."**

Then things like:

> "What's the status of my projects in Lane?"
> "Add a milestone called 'Beta launch' to the Onboarding project, targeting Sept 30."
> "Turn my current plan into a timeline table."

For any change, you can ask it to **preview** first ("show me what would change")
before it applies anything.

## Interactive cards

In **Claude Desktop**, Lane replies with live, clickable cards (not just text):

- **Plan overview** — "What needs attention in my project?" → tiles you can click
  to drill into blocked / unscheduled / overdue items, a by-lane breakdown, and an
  upcoming-milestone timeline.
- **Activity editor** — "Edit the kickoff activity" / "Add an activity" → a tabbed
  editor (Details, Tasks, Notes, Links) with owners, color, and start/due dates.
- **Record editors** — "Edit the beta milestone", "Add a deliverable", "Set up a
  phase", "Log time off for Zach", "Add a team member", "Create a role/group" →
  editors for milestones, phases, deliverables, time off, people, roles, and
  groups (milestones & deliverables include a Notes tab).
- **Dependencies** — "Manage dependencies for this project" → add or remove
  predecessor → successor links with optional lag.
- **Approval card** — before a change, Lane shows the exact diff with **Apply** /
  **Cancel** buttons.
- **Quick forms** — create events (with start & end times), tasks, notes, and links inline.

Just ask in plain language; Claude opens the right card. (Older clients that don't
support interactive cards fall back to plain text automatically.)

## Good to know

- **It's scoped to you.** Reads and writes run under your own Lane identity
  (row-level security), so you can't see or touch anything you couldn't in the app.
- **Nothing shared lives on your machine.** Just your personal token, which you
  can revoke anytime in **Settings → Connect Claude**.
- **No always-on dev setup.** It talks to the live Lane app; nothing else to run.

## If something's off

- **Claude Desktop says "server disconnected"** → make sure you're on Node 20+,
  then re-run `./setup.sh`. Logs: `~/Library/Logs/Claude/mcp-server-lane.log`.
- **Claude Code `lane` not connected** → the local helper may not be running;
  re-run `./setup.sh`. Logs: `~/Library/Logs/lane-mcp.log`.
- **"Lane rejected this token"** → generate a fresh one in Settings → Connect
  Claude and re-run `./setup.sh`.
- Still stuck? Ping John with the relevant log.

Full technical details are in the repo's `README.md`.
