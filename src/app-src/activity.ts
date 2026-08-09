/**
 * Ask Lane activity editor — the rich create/edit card behind lane_edit_activity.
 * Tabs: Details (all fields incl. owners people+groups, color, dates, progress),
 * Tasks (list/add/toggle/delete), Notes (list/add/delete), Links (add). Every
 * mutation is a lane_apply_action call; after each we re-read the plan context so
 * lists + versions stay fresh. Edit mode needs an activityId; create mode is
 * Details-only (the write tool returns no id to attach children to yet).
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;
const app = new App({ name: "Lane Activity", version: "0.1.0" });
wireTheme(app);

type Row = Record<string, unknown>;
type Ctx = {
  activities?: Row[]; tasks?: Row[]; lanes?: Row[]; milestones?: Row[]; people?: Row[]; groups?: Row[];
  assignments?: { activities?: Row[]; activityGroups?: Row[] };
  notes?: { activities?: Row[] };
  links?: Row[];
};
type Tab = "details" | "tasks" | "notes" | "links";

const COLORS = ["#7357e8", "#2f9e6a", "#e0891a", "#e5484d", "#3f6ff5", "#8a5cf6", "#0ea5a5"];
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const dateVal = (v: unknown): string => (str(v).length >= 10 ? str(v).slice(0, 10) : "");

let projectId: string | undefined;
let activityId: string | undefined;
let ctx: Ctx = {};
let tab: Tab = "details";
let connected = false;
let started = false;
let busy = false;

const activity = (): Row | undefined => (ctx.activities ?? []).find((a) => str(a.id) === activityId);
const tasksFor = (): Row[] => (ctx.tasks ?? []).filter((t) => str(t.work_item_id) === activityId);
const notesFor = (): Row[] => (ctx.notes?.activities ?? []).filter((n) => str(n.work_item_id) === activityId);
const ownerPeople = (): string[] => (ctx.assignments?.activities ?? []).filter((o) => str(o.work_item_id) === activityId).map((o) => str(o.person_id));
const ownerGroups = (): string[] => (ctx.assignments?.activityGroups ?? []).filter((o) => str(o.work_item_id) === activityId).map((o) => str(o.group_id));
const linksFor = (): Row[] => (ctx.links ?? []).filter((l) => str(l.object_type) === "work_item" && str(l.object_id) === activityId);

async function reload(): Promise<void> {
  if (!projectId) return;
  try {
    const result = await app.callServerTool({ name: "lane_get_context", arguments: { projectId } });
    ctx = (result as { structuredContent?: Ctx }).structuredContent ?? {};
  } catch {
    /* keep last context */
  }
}

async function apply(action: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  const result = await app.callServerTool({ name: "lane_apply_action", arguments: { action, preview: false } });
  const sc = (result as { structuredContent?: { applied?: boolean; message?: string } }).structuredContent;
  return { ok: Boolean(sc?.applied), message: sc?.message ?? "Nothing changed." };
}

function flash(message: string, ok = true): void {
  const el = document.getElementById("flash");
  if (el) {
    el.textContent = message;
    el.className = `flash ${ok ? "ok" : "err"}`;
    el.style.display = "";
  }
}

/* ---------- field collection (Details) ---------- */
function checkedValues(name: string): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map((i) => i.value);
}
function val(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return el ? el.value.trim() : "";
}

function detailsAction(): Record<string, unknown> | { error: string } {
  if (!projectId) return { error: "No project scoped." };
  const title = val("f_title");
  if (!title) return { error: "Title is required." };
  const color = (document.querySelector<HTMLInputElement>('input[name="f_color"]:checked')?.value) || "";
  const fields = {
    title,
    description: val("f_description"),
    status: val("f_status") || "backlog",
    priority: val("f_priority") || "none",
    laneId: val("f_laneId") || null,
    milestoneId: val("f_milestoneId") || null,
    startDate: val("f_startDate") || null,
    dueDate: val("f_dueDate") || null,
    progress: Math.max(0, Math.min(100, Number(val("f_progress")) || 0)),
    color: color || null,
    ownerPersonIds: checkedValues("f_ownerPersonIds"),
    ownerGroupIds: checkedValues("f_ownerGroupIds"),
  };
  const current = activity();
  if (activityId && current) {
    return { action: "activity.update", projectId, activityId, expectedVersion: num(current.version), ...fields };
  }
  return { action: "activity.create", projectId, ...fields };
}

/* ---------- rendering ---------- */
function options(items: Row[], idKey: string, labelKey: string, selected: string, none?: string): string {
  const head = none ? `<option value="">${esc(none)}</option>` : "";
  return head + items.map((it) => {
    const value = str(it[idKey]);
    return `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(str(it[labelKey]) || value)}</option>`;
  }).join("");
}

function peopleLabel(p: Row): string {
  const name = str(p.full_name) || str(p.name) || "Unnamed";
  return str(p.person_kind) === "client" ? `${name} · client` : name;
}

function checkList(name: string, items: Row[], idKey: string, labelFn: (r: Row) => string, selected: string[]): string {
  if (!items.length) return '<p class="muted-s">None in this project yet.</p>';
  return `<div class="people">${items.map((it) => {
    const value = str(it[idKey]);
    return `<label class="chk"><input type="checkbox" name="${name}" value="${esc(value)}"${selected.includes(value) ? " checked" : ""}> ${esc(labelFn(it))}</label>`;
  }).join("")}</div>`;
}

function detailsTab(): string {
  const a = activity() ?? {};
  const opt = (values: string[]): Row[] => values.map((v) => ({ id: v, label: v.replace(/_/g, " ") }));
  const swatch = (hex: string): string =>
    `<label class="swatch"><input type="radio" name="f_color" value="${hex}"${str(a.color).toLowerCase() === hex ? " checked" : ""}><span style="background:${hex}"></span></label>`;
  const laneDefault = `<label class="swatch swatch-none"><input type="radio" name="f_color" value=""${str(a.color) ? "" : " checked"}><span>Lane</span></label>`;
  return (
    `<div class="field"><label class="flabel" for="f_title">Title <span class="req">*</span></label><input id="f_title" type="text" value="${esc(str(a.title))}"></div>` +
    `<div class="field"><label class="flabel" for="f_description">Description</label><textarea id="f_description" rows="3">${esc(str(a.description))}</textarea></div>` +
    `<div class="grid2">` +
      `<div class="field"><label class="flabel" for="f_status">Status</label><select id="f_status">${options(opt(["backlog", "ready", "in_progress", "blocked", "done", "canceled"]), "id", "label", str(a.status) || "backlog")}</select></div>` +
      `<div class="field"><label class="flabel" for="f_priority">Priority</label><select id="f_priority">${options(opt(["none", "low", "medium", "high", "urgent"]), "id", "label", str(a.priority) || "none")}</select></div>` +
      `<div class="field"><label class="flabel" for="f_laneId">Lane</label><select id="f_laneId">${options(ctx.lanes ?? [], "id", "name", str(a.workstream_id), "— No lane —")}</select></div>` +
      `<div class="field"><label class="flabel" for="f_milestoneId">Milestone</label><select id="f_milestoneId">${options(ctx.milestones ?? [], "id", "title", str(a.milestone_id), "— No milestone —")}</select></div>` +
      `<div class="field"><label class="flabel" for="f_startDate">Start</label><input id="f_startDate" type="date" value="${dateVal(a.starts_at)}"></div>` +
      `<div class="field"><label class="flabel" for="f_dueDate">Due</label><input id="f_dueDate" type="date" value="${dateVal(a.due_at)}"></div>` +
      `<div class="field"><label class="flabel" for="f_progress">Progress %</label><input id="f_progress" type="number" min="0" max="100" value="${num(a.progress)}"></div>` +
    `</div>` +
    `<div class="field"><label class="flabel">Color</label><div class="swatches">${laneDefault}${COLORS.map(swatch).join("")}</div></div>` +
    `<div class="field"><label class="flabel">Team owners</label>${checkList("f_ownerPersonIds", ctx.people ?? [], "id", peopleLabel, ownerPeople())}</div>` +
    ((ctx.groups ?? []).length ? `<div class="field"><label class="flabel">Groups</label>${checkList("f_ownerGroupIds", ctx.groups ?? [], "id", (g) => str(g.name) || "Group", ownerGroups())}</div>` : "") +
    `<div class="actions"><button class="btn btn-primary" id="save">${activityId ? "Save changes" : "Create activity"}</button></div>`
  );
}

function childHint(kind: string): string {
  return `<p class="muted-s">Save the activity first, then reopen it to add ${kind}.</p>`;
}

function tasksTab(): string {
  if (!activityId) return childHint("tasks");
  const rows = tasksFor().map((t) => {
    const done = Boolean(t.is_done);
    return `<div class="item"><label class="chk"><input type="checkbox" data-task-toggle="${esc(str(t.id))}" data-v="${num(t.version)}"${done ? " checked" : ""}> <span class="${done ? "done" : ""}">${esc(str(t.name) || "Task")}</span></label>` +
      `<button class="link-btn" data-task-del="${esc(str(t.id))}" data-v="${num(t.version)}">Remove</button></div>`;
  }).join("") || '<div class="item"><span class="item-meta">No tasks yet.</span></div>';
  return `<div class="list">${rows}</div>` +
    `<div class="addrow"><input id="new_task" type="text" placeholder="Add a task…"><button class="btn btn-primary" id="add_task">Add</button></div>`;
}

function notesTab(): string {
  if (!activityId) return childHint("notes");
  const rows = notesFor().map((n) => `<div class="item"><span class="note-body">${esc(str(n.body))}</span><button class="link-btn" data-note-del="${esc(str(n.id))}" data-v="${num(n.version)}">Remove</button></div>`).join("") ||
    '<div class="item"><span class="item-meta">No notes yet.</span></div>';
  return `<div class="list">${rows}</div>` +
    `<div class="addrow"><textarea id="new_note" rows="2" placeholder="Add a note…"></textarea><button class="btn btn-primary" id="add_note">Add</button></div>`;
}

function linksTab(): string {
  if (!activityId) return childHint("links");
  const rows = linksFor().map((l) => {
    const url = str(l.url);
    const label = str(l.label) || url;
    return `<div class="item"><a class="link-a" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` +
      `<button class="link-btn" data-link-del="${esc(str(l.id))}" data-v="${num(l.version)}">Remove</button></div>`;
  }).join("") || '<div class="item"><span class="item-meta">No links yet.</span></div>';
  return `<div class="list">${rows}</div>` +
    `<div class="field"><label class="flabel" for="new_link_url">URL</label><input id="new_link_url" type="text" placeholder="https://…"></div>` +
    `<div class="field"><label class="flabel" for="new_link_label">Label</label><input id="new_link_label" type="text"></div>` +
    `<div class="actions"><button class="btn btn-primary" id="add_link">Add link</button></div>`;
}

function tabBody(): string {
  if (tab === "tasks") return tasksTab();
  if (tab === "notes") return notesTab();
  if (tab === "links") return linksTab();
  return detailsTab();
}

function render(): void {
  const editing = Boolean(activityId);
  const count = (n: number): string => (n ? ` <span class="tabnum">${n}</span>` : "");
  const tabBtn = (id: Tab, label: string, extra = ""): string =>
    `<button class="tab${tab === id ? " tab-on" : ""}" data-tab="${id}">${label}${extra}</button>`;
  root.innerHTML =
    `<div class="card wide">${badge("Lane")}<h1>${editing ? "Edit activity" : "New activity"}</h1>` +
    `<div class="tabs">${tabBtn("details", "Details")}${tabBtn("tasks", "Tasks", count(tasksFor().length))}${tabBtn("notes", "Notes", count(notesFor().length))}${tabBtn("links", "Links", count(linksFor().length))}</div>` +
    `<p class="flash" id="flash" style="display:none"></p>` +
    `<div class="tabbody">${tabBody()}</div></div>`;
  wire();
}

/* ---------- wiring ---------- */
function guard(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    if (busy) return;
    busy = true;
    try { await fn(); } finally { busy = false; }
  };
}

function wire(): void {
  root.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab as Tab; render(); }));

  document.getElementById("save")?.addEventListener("click", guard(async () => {
    const built = detailsAction();
    if ("error" in built) return flash(built.error as string, false);
    const btn = document.getElementById("save") as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    const res = await apply(built);
    if (!res.ok) { flash(res.message, false); if (btn) { btn.disabled = false; btn.textContent = activityId ? "Save changes" : "Create activity"; } return; }
    if (!activityId) {
      root.innerHTML = `<div class="card wide">${badge("Lane")}<h1 class="ok">Created ✓</h1><p>${esc(res.message)}</p><p class="muted-s">Reopen this activity to add tasks, notes, or links.</p></div>`;
      return;
    }
    await reload();
    render();
    flash("Saved ✓");
  }));

  document.getElementById("add_task")?.addEventListener("click", guard(async () => {
    const name = (document.getElementById("new_task") as HTMLInputElement)?.value.trim();
    if (!name || !activityId) return;
    const res = await apply({ action: "task.create", projectId, activityId, name, personIds: [], isDone: false, note: "", progress: 0 });
    if (!res.ok) return flash(res.message, false);
    await reload(); render();
  }));

  root.querySelectorAll<HTMLInputElement>("input[data-task-toggle]").forEach((c) => c.addEventListener("change", guard(async () => {
    const id = c.dataset.taskToggle!;
    const task = tasksFor().find((t) => str(t.id) === id);
    if (!task || !activityId) return;
    const res = await apply({ action: "task.update", projectId, activityId, taskId: id, expectedVersion: num(c.dataset.v), name: str(task.name), personIds: [], isDone: c.checked, note: "", progress: c.checked ? 100 : 0 });
    if (!res.ok) return flash(res.message, false);
    await reload(); render();
  })));

  root.querySelectorAll<HTMLButtonElement>("button[data-task-del]").forEach((b) => b.addEventListener("click", guard(async () => {
    const res = await apply({ action: "task.delete", projectId, activityId, taskId: b.dataset.taskDel, expectedVersion: num(b.dataset.v) });
    if (!res.ok) return flash(res.message, false);
    await reload(); render();
  })));

  document.getElementById("add_note")?.addEventListener("click", guard(async () => {
    const body = (document.getElementById("new_note") as HTMLTextAreaElement)?.value.trim();
    if (!body || !activityId) return;
    const res = await apply({ action: "activityNote.create", projectId, activityId, body });
    if (!res.ok) return flash(res.message, false);
    await reload(); render();
  }));

  root.querySelectorAll<HTMLButtonElement>("button[data-note-del]").forEach((b) => b.addEventListener("click", guard(async () => {
    const res = await apply({ action: "activityNote.delete", projectId, activityId, noteId: b.dataset.noteDel, expectedVersion: num(b.dataset.v) });
    if (!res.ok) return flash(res.message, false);
    await reload(); render();
  })));

  document.getElementById("add_link")?.addEventListener("click", guard(async () => {
    const url = (document.getElementById("new_link_url") as HTMLInputElement)?.value.trim();
    const label = (document.getElementById("new_link_label") as HTMLInputElement)?.value.trim();
    if (!url || !activityId) return flash("Enter a URL.", false);
    const res = await apply({ action: "link.create", projectId, objectType: "work_item", objectId: activityId, url, label: label || "" });
    if (!res.ok) return flash(res.message, false);
    await reload(); render();
  }));

  root.querySelectorAll<HTMLButtonElement>("button[data-link-del]").forEach((b) => b.addEventListener("click", guard(async () => {
    const res = await apply({ action: "link.delete", projectId, linkId: b.dataset.linkDel, expectedVersion: num(b.dataset.v) });
    if (!res.ok) return flash(res.message, false);
    await reload(); render();
  })));
}

async function start(): Promise<void> {
  if (started || !connected || !projectId) return;
  started = true;
  await reload();
  render();
}

root.innerHTML = `<div class="card wide">${badge("Lane")}<h1>Loading activity…</h1></div>`;

app.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
  const a = params?.arguments ?? {};
  projectId = str(a.projectId) || undefined;
  activityId = str(a.activityId) || undefined;
  void start();
};
app.onerror = (error: unknown) => console.error("[lane-activity]", error);

app
  .connect()
  .then(() => {
    applyInitialTheme(app);
    connected = true;
    void start();
    window.setTimeout(() => {
      if (!started) root.innerHTML = `<div class="card wide">${badge("Lane")}<h1>Waiting for details</h1><p>Ask Lane to open the activity again.</p></div>`;
    }, 2500);
  })
  .catch((error: unknown) => console.error("[lane-activity] connect failed", error));
