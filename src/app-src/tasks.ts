/**
 * Ask Lane Tasks board. Rendered for lane_view_tasks: the project's activities
 * grouped by lane, each with a progress bar, owner avatars, status pill, due
 * date, and its checklist tasks — mirroring the in-app Tasks tab. Read-only, but
 * rows are actionable: tapping an activity opens the full editor (via a chat
 * message the model turns into lane_edit_activity), and add-task / add-activity
 * route to the create flow. Writes go through the editor so per-task assignees
 * and notes (which the read context doesn't carry) are never clobbered. Reads the
 * plan itself on connect, scoped to the model's projectId.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;

type Row = Record<string, unknown>;
type Ctx = {
  projects?: Row[];
  activities?: Row[];
  tasks?: Row[];
  lanes?: Row[];
  people?: Row[];
  assignments?: { activities?: Row[] };
};
type Filter = "active" | "all" | "done";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : 0);
const isDone = (status: string): boolean => status.toLowerCase() === "done";

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog", ready: "Ready", in_progress: "In progress", blocked: "Blocked", done: "Done", canceled: "Canceled",
};
const PRIORITY_LABEL: Record<string, string> = { none: "", low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

function fmtDate(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const app = new App({ name: "Lane Tasks", version: "0.1.0" });
wireTheme(app);

let data: Ctx = {};
let projectId: string | undefined;
let loaded = false;
let filter: Filter = "active";
const expanded = new Set<string>();
let currentMode = "inline";
let canFullscreen = false;

// activity id -> [display name] via the activity->person assignment join.
function ownersByActivity(): Map<string, string[]> {
  const nameById = new Map<string, string>();
  for (const person of data.people ?? []) nameById.set(str(person.id), str(person.full_name) || "Someone");
  const out = new Map<string, string[]>();
  for (const link of data.assignments?.activities ?? []) {
    const wid = str(link.work_item_id);
    const name = nameById.get(str(link.person_id));
    if (!wid || !name) continue;
    out.set(wid, [...(out.get(wid) ?? []), name]);
  }
  return out;
}

function tasksByActivity(): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const task of data.tasks ?? []) {
    const wid = str(task.work_item_id);
    if (!wid) continue;
    out.set(wid, [...(out.get(wid) ?? []), task]);
  }
  return out;
}

function avatarsHtml(names: string[]): string {
  if (!names.length) return "";
  const shown = names.slice(0, 3).map((n) => `<span class="av" title="${esc(n)}">${esc(initials(n))}</span>`).join("");
  const more = names.length > 3 ? `<span class="av av-more">+${names.length - 3}</span>` : "";
  return `<span class="avs" aria-label="${esc(names.join(", "))}">${shown}${more}</span>`;
}

function fullscreenBtn(): string {
  if (!canFullscreen) return "";
  return `<button class="fs-btn" type="button" id="fs">${currentMode === "fullscreen" ? "Exit fullscreen" : "Fullscreen"}</button>`;
}

function render(): void {
  const activities = (data.activities ?? []).filter((a) => str(a.status).toLowerCase() !== "canceled");
  const projects = data.projects ?? [];
  const lanes = data.lanes ?? [];
  const owners = ownersByActivity();
  const tasksBy = tasksByActivity();

  const laneName = new Map<string, string>();
  for (const lane of lanes) laneName.set(str(lane.id), str(lane.name) || "Lane");
  const laneOrder = [...lanes.map((l) => str(l.id)), ""];

  const matchesFilter = (a: Row): boolean => {
    const done = isDone(str(a.status));
    return filter === "all" ? true : filter === "done" ? done : !done;
  };

  const doneCount = activities.filter((a) => isDone(str(a.status))).length;
  const scope = projects.length ? esc(str(projects[0].name) || "Project") : "Tasks";

  const tab = (id: Filter, label: string): string =>
    `<button class="tab${filter === id ? " tab-on" : ""}" data-filter="${id}">${label}</button>`;

  // Group activities by lane in lane order; ungrouped last.
  const byLane = new Map<string, Row[]>();
  for (const a of activities) {
    const key = laneName.has(str(a.workstream_id)) ? str(a.workstream_id) : "";
    byLane.set(key, [...(byLane.get(key) ?? []), a]);
  }

  const laneBlocks = laneOrder
    .filter((id, i) => laneOrder.indexOf(id) === i && byLane.has(id))
    .map((id) => {
      const laneRows = (byLane.get(id) ?? []);
      const visible = laneRows.filter(matchesFilter);
      const laneDone = laneRows.filter((a) => isDone(str(a.status))).length;
      const name = id ? (laneName.get(id) ?? "Lane") : "Ungrouped";
      if (!visible.length) return "";

      const cards = visible.map((a) => {
        const aid = str(a.id);
        const title = str(a.title) || "Untitled activity";
        const status = str(a.status);
        const prog = Math.max(0, Math.min(100, Math.round(num(a.progress))));
        const due = fmtDate(a.due_at);
        const priority = str(a.priority);
        const aTasks = tasksBy.get(aid) ?? [];
        const tDone = aTasks.filter((t) => t.is_done === true).length;
        const open = expanded.has(aid);
        const av = avatarsHtml(owners.get(aid) ?? []);
        const prioChip = (priority === "high" || priority === "urgent")
          ? `<span class="prio-hi">${esc(PRIORITY_LABEL[priority])}</span>` : "";
        const taskList = open && aTasks.length
          ? `<div class="tk-list">${aTasks.map((t) => {
              const td = t.is_done === true;
              return `<div class="tk"><span class="tk-box${td ? " on" : ""}" aria-hidden="true">${td ? "✓" : ""}</span>` +
                `<span class="tk-name${td ? " done" : ""}">${esc(str(t.name) || "Task")}</span></div>`;
            }).join("")}</div>`
          : "";
        const addTask = open
          ? `<button class="tk-add row-btn" data-addtask="${esc(aid)}">+ Add task</button>` : "";

        return `<div class="act${isDone(status) ? " act-done" : ""}">` +
          `<div class="act-top">` +
            `<button class="act-title row-btn" data-act="${esc(aid)}">${esc(title)}</button>` +
            av +
            prioChip +
            `<span class="st st-${esc(status)}">${esc(STATUS_LABEL[status] ?? status)}</span>` +
          `</div>` +
          `<div class="act-prog">` +
            `<span class="tprog"><i style="width:${prog}%"></i></span>` +
            `<span class="act-pct">${prog}%</span>` +
            (due ? `<span class="act-due">${esc(due)}</span>` : "") +
            (aTasks.length ? `<button class="tk-toggle" data-exp="${esc(aid)}">${tDone}/${aTasks.length} ${open ? "▾" : "▸"}</button>` : "") +
          `</div>` +
          taskList +
          addTask +
        `</div>`;
      }).join("");

      return `<div class="lane-group">` +
        `<div class="lane-h"><span class="lane-name">${esc(name)}</span><span class="lane-count">${laneDone}/${laneRows.length}</span></div>` +
        cards +
        `<button class="row-btn lane-add" data-addact="${esc(id)}">+ Add activity</button>` +
      `</div>`;
    }).join("");

  root.innerHTML =
    `<div class="card wide">` +
    `<div class="head">${badge("Lane · Tasks")}${fullscreenBtn()}</div>` +
    `<h1>${scope}</h1>` +
    `<p>${doneCount}/${activities.length} activities complete</p>` +
    `<div class="tabs tabs-filter">${tab("active", "Active")}${tab("all", "All")}${tab("done", "Done")}</div>` +
    (laneBlocks || `<p class="empty">No activities match this filter.</p>`) +
    `</div>`;
  wire();
}

function send(text: string): void {
  void app.sendMessage({ role: "user", content: [{ type: "text", text }] }).catch(() => {});
}

function titleOf(aid: string): string {
  const a = (data.activities ?? []).find((x) => str(x.id) === aid);
  return str(a?.title) || "this activity";
}
function laneLabel(id: string): string {
  const l = (data.lanes ?? []).find((x) => str(x.id) === id);
  return str(l?.name);
}

function wire(): void {
  root.querySelectorAll<HTMLButtonElement>("button[data-filter]").forEach((b) => b.addEventListener("click", () => {
    filter = b.dataset.filter as Filter;
    render();
  }));
  root.querySelectorAll<HTMLButtonElement>("button[data-exp]").forEach((b) => b.addEventListener("click", () => {
    const aid = b.dataset.exp!;
    if (expanded.has(aid)) expanded.delete(aid); else expanded.add(aid);
    render();
  }));
  root.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((b) => b.addEventListener("click", () =>
    send(`Open the activity editor for "${titleOf(b.dataset.act!)}".`)));
  root.querySelectorAll<HTMLButtonElement>("button[data-addtask]").forEach((b) => b.addEventListener("click", () =>
    send(`Add a task to the activity "${titleOf(b.dataset.addtask!)}".`)));
  root.querySelectorAll<HTMLButtonElement>("button[data-addact]").forEach((b) => b.addEventListener("click", () => {
    const lane = laneLabel(b.dataset.addact!);
    send(lane ? `Create a new activity in the "${lane}" lane.` : "Create a new activity.");
  }));
  document.getElementById("fs")?.addEventListener("click", async () => {
    const next = currentMode === "fullscreen" ? "inline" : "fullscreen";
    try {
      const result = await app.requestDisplayMode({ mode: next });
      currentMode = result.mode;
    } catch {
      /* host declined */
    }
    document.body.classList.toggle("fullscreen", currentMode === "fullscreen");
    render();
  });
}

function errCard(message: string): void {
  root.innerHTML = `<div class="card wide">${badge("Lane · Tasks")}<h1>Tasks</h1><p>${esc(message)}</p></div>`;
}

root.innerHTML = `<div class="card wide">${badge("Lane · Tasks")}<h1>Tasks</h1><p>Reading your plan…</p></div>`;

app.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
  const pid = params?.arguments?.projectId;
  if (typeof pid === "string") projectId = pid;
};

app.ontoolresult = (result: unknown) => {
  if (loaded) return;
  const ctx = (result as { structuredContent?: Ctx }).structuredContent;
  if (ctx && (ctx.activities || ctx.tasks)) {
    loaded = true;
    data = ctx;
    render();
  }
};

app.onerror = (error: unknown) => console.error("[lane-tasks]", error);

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
  .catch((error: unknown) => console.error("[lane-tasks] connect failed", error));
