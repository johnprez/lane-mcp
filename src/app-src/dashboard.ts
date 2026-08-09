/**
 * Ask Lane plan overview. Rendered for lane_get_context: needs-attention tiles
 * that DRILL IN to the underlying items, a by-lane breakdown, and an upcoming
 * milestone timeline. Read-only, but rows are actionable — clicking an item asks
 * Lane a follow-up (e.g. to open the activity editor), which the model turns into
 * the right card. Reads the plan itself on connect, scoped to the model's
 * projectId. Supports a fullscreen toggle where the host allows it.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;

type Row = Record<string, unknown>;
type Ctx = { projects?: Row[]; milestones?: Row[]; activities?: Row[]; lanes?: Row[] };
type Drill = "activities" | "done" | "blocked" | "unscheduled" | "milestones" | "overdue" | null;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isDone = (status: string): boolean => ["done", "complete", "completed"].includes(status.toLowerCase());
const now = (): number => Date.now();

function fmtDate(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const app = new App({ name: "Lane Overview", version: "0.1.0" });
wireTheme(app);

let data: Ctx = {};
let projectId: string | undefined;
let loaded = false;
let drill: Drill = null;
let currentMode = "inline";
let canFullscreen = false;

function overdueMilestones(): Row[] {
  return (data.milestones ?? []).filter((m) => {
    const t = new Date(str(m.target_date)).getTime();
    return !isNaN(t) && t < now() && !isDone(str(m.status));
  });
}

function drillItems(): { kind: "activity" | "milestone"; rows: Row[]; title: string } {
  const acts = data.activities ?? [];
  const mss = data.milestones ?? [];
  switch (drill) {
    case "done": return { kind: "activity", rows: acts.filter((a) => isDone(str(a.status))), title: "Done activities" };
    case "blocked": return { kind: "activity", rows: acts.filter((a) => str(a.status).toLowerCase() === "blocked"), title: "Blocked activities" };
    case "unscheduled": return { kind: "activity", rows: acts.filter((a) => !str(a.starts_at) || !str(a.due_at)), title: "Unscheduled activities" };
    case "milestones": return { kind: "milestone", rows: mss.slice(), title: "All milestones" };
    case "overdue": return { kind: "milestone", rows: overdueMilestones(), title: "Overdue milestones" };
    default: return { kind: "activity", rows: acts.slice(), title: "All activities" };
  }
}

function fullscreenBtn(): string {
  if (!canFullscreen) return "";
  return `<button class="fs-btn" type="button" id="fs">${currentMode === "fullscreen" ? "Exit fullscreen" : "Fullscreen"}</button>`;
}

function render(): void {
  const activities = data.activities ?? [];
  const milestones = data.milestones ?? [];
  const projects = data.projects ?? [];
  const lanes = data.lanes ?? [];

  const blocked = activities.filter((a) => str(a.status).toLowerCase() === "blocked").length;
  const unscheduled = activities.filter((a) => !str(a.starts_at) || !str(a.due_at)).length;
  const done = activities.filter((a) => isDone(str(a.status))).length;
  const overdue = overdueMilestones().length;
  const scope = projects.length === 1 ? esc(str(projects[0].name) || "Project") : `${projects.length} projects`;

  const tile = (id: Drill, n: number, label: string, tone = ""): string =>
    `<button class="tile${drill === id ? " tile-on" : ""} ${n > 0 ? tone : ""}" data-drill="${id}"><span class="n">${n}</span><span class="l">${esc(label)}</span></button>`;

  const upcoming = milestones
    .filter((m) => str(m.target_date))
    .slice()
    .sort((a, b) => new Date(str(a.target_date)).getTime() - new Date(str(b.target_date)).getTime())
    .slice(0, 6);
  const milestoneRows = upcoming.map((m) => {
    const t = new Date(str(m.target_date)).getTime();
    const late = !isNaN(t) && t < now() && !isDone(str(m.status));
    return `<button class="item row-btn" data-ms="${esc(str(m.title))}"><span class="item-title">${esc(str(m.title) || "Untitled milestone")}</span>` +
      `<span class="item-meta ${late ? "err" : ""}">${esc(fmtDate(m.target_date))}${late ? " · overdue" : ""}</span></button>`;
  }).join("") || '<div class="item"><span class="item-meta">No milestones with dates.</span></div>';

  // By-lane breakdown
  const laneName = new Map(lanes.map((l) => [str(l.id), str(l.name) || "Lane"]));
  const byLane = new Map<string, { total: number; blocked: number }>();
  for (const a of activities) {
    const key = str(a.workstream_id) || "";
    const entry = byLane.get(key) ?? { total: 0, blocked: 0 };
    entry.total += 1;
    if (str(a.status).toLowerCase() === "blocked") entry.blocked += 1;
    byLane.set(key, entry);
  }
  const laneRows = [...byLane.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([id, e]) => {
      const name = id ? (laneName.get(id) ?? "Lane") : "No lane";
      return `<button class="item row-btn" data-lane="${esc(name)}"><span class="item-title">${esc(name)}</span>` +
        `<span class="item-meta">${e.total}${e.blocked ? ` · <span class="err">${e.blocked} blocked</span>` : ""}</span></button>`;
    }).join("") || '<div class="item"><span class="item-meta">No activities yet.</span></div>';

  let drillPanel = "";
  if (drill) {
    const { kind, rows, title } = drillItems();
    const list = rows.slice(0, 40).map((r) => {
      if (kind === "activity") {
        const t = str(r.title) || "Activity";
        return `<button class="item row-btn" data-act="${esc(t)}"><span class="item-title">${esc(t)}</span><span class="item-meta">${esc(str(r.status).replace(/_/g, " "))}</span></button>`;
      }
      const t = str(r.title) || "Milestone";
      return `<button class="item row-btn" data-ms="${esc(t)}"><span class="item-title">${esc(t)}</span><span class="item-meta">${esc(fmtDate(r.target_date))}</span></button>`;
    }).join("") || '<div class="item"><span class="item-meta">Nothing here.</span></div>';
    drillPanel = `<div class="drill"><div class="drill-head"><h2>${esc(title)}</h2><button class="link-btn" id="drill-close">Close</button></div><div class="list">${list}</div></div>`;
  }

  root.innerHTML =
    `<div class="card wide">` +
    `<div class="head">${badge("Lane · Overview")}${fullscreenBtn()}</div>` +
    `<h1>${scope}</h1>` +
    `<div class="tiles">` +
    tile("activities", activities.length, "Activities") +
    tile("done", done, "Done") +
    tile("blocked", blocked, "Blocked", "warn-red") +
    tile("unscheduled", unscheduled, "Unscheduled", "warn-amber") +
    tile("milestones", milestones.length, "Milestones") +
    tile("overdue", overdue, "Overdue", "warn-red") +
    `</div>` +
    drillPanel +
    `<h2>By lane</h2><div class="list">${laneRows}</div>` +
    `<h2>Upcoming milestones</h2><div class="list">${milestoneRows}</div>` +
    `</div>`;
  wire();
}

function send(text: string): void {
  void app.sendMessage({ role: "user", content: [{ type: "text", text }] }).catch(() => {});
}

function wire(): void {
  root.querySelectorAll<HTMLButtonElement>(".tile").forEach((b) => b.addEventListener("click", () => {
    const next = b.dataset.drill as Drill;
    drill = drill === next ? null : next;
    render();
  }));
  document.getElementById("drill-close")?.addEventListener("click", () => { drill = null; render(); });
  root.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((b) => b.addEventListener("click", () => send(`Open the activity editor for "${b.dataset.act}".`)));
  root.querySelectorAll<HTMLButtonElement>("button[data-ms]").forEach((b) => b.addEventListener("click", () => send(`Tell me about the milestone "${b.dataset.ms}".`)));
  root.querySelectorAll<HTMLButtonElement>("button[data-lane]").forEach((b) => b.addEventListener("click", () => send(`What's happening in the ${b.dataset.lane} lane?`)));
  document.getElementById("fs")?.addEventListener("click", async () => {
    const next = currentMode === "fullscreen" ? "inline" : "fullscreen";
    try {
      const result = await app.requestDisplayMode({ mode: next });
      currentMode = result.mode;
    } catch {
      /* host declined */
    }
    document.body.classList.toggle("fullscreen", currentMode === "fullscreen");
    const btn = document.getElementById("fs");
    if (btn) btn.textContent = currentMode === "fullscreen" ? "Exit fullscreen" : "Fullscreen";
  });
}

function errCard(message: string): void {
  root.innerHTML = `<div class="card wide">${badge("Lane · Overview")}<h1>Overview</h1><p>${esc(message)}</p></div>`;
}

root.innerHTML = `<div class="card wide">${badge("Lane · Overview")}<h1>Plan overview</h1><p>Reading your plan…</p></div>`;

app.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
  const pid = params?.arguments?.projectId;
  if (typeof pid === "string") projectId = pid;
};

app.ontoolresult = (result: unknown) => {
  if (loaded) return;
  const ctx = (result as { structuredContent?: Ctx }).structuredContent;
  if (ctx && (ctx.activities || ctx.milestones || ctx.projects)) {
    loaded = true;
    data = ctx;
    render();
  }
};

app.onerror = (error: unknown) => console.error("[lane-overview]", error);

app
  .connect()
  .then(async () => {
    applyInitialTheme(app);
    const hc = app.getHostContext() as { displayMode?: string; availableDisplayModes?: string[] } | undefined;
    currentMode = hc?.displayMode ?? "inline";
    canFullscreen = Array.isArray(hc?.availableDisplayModes) && hc.availableDisplayModes.includes("fullscreen");
    if (loaded) return;
    try {
      const result = await app.callServerTool({ name: "lane_get_context", arguments: projectId ? { projectId } : {} });
      const ctx = (result as { structuredContent?: Ctx }).structuredContent;
      if (ctx) {
        loaded = true;
        data = ctx;
        render();
      } else {
        errCard("No plan data came back.");
      }
    } catch {
      errCard("Couldn't read your plan.");
    }
  })
  .catch((error: unknown) => console.error("[lane-overview] connect failed", error));
