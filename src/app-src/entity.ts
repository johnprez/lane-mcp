/**
 * Ask Lane record editor — config-driven create/edit for milestones, phases,
 * deliverables, and time off (behind lane_edit_record). Details tab for every
 * kind; a Notes tab for kinds that support notes (milestone, deliverable). Loads
 * the existing record + notes from context on connect; every mutation is a
 * lane_apply_action call, after which we re-read context for fresh lists/versions.
 * Edit needs an entityId; create is Details-only until saved + reopened.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;
const app = new App({ name: "Lane Record", version: "0.1.0" });
wireTheme(app);

type Row = Record<string, unknown>;
type Ctx = {
  milestones?: Row[]; phases?: Row[]; deliverables?: Row[]; timeOff?: Row[]; lanes?: Row[]; people?: Row[]; roles?: Row[]; groups?: Row[];
  assignments?: { phaseLanes?: Row[]; personRoles?: Row[]; groupMembers?: Row[] };
  notes?: { milestones?: Row[]; deliverables?: Row[] };
};
type Kind = "milestone" | "phase" | "deliverable" | "pto" | "person" | "role" | "group";
type Field =
  | { name: string; label: string; type: "text" | "textarea" | "date" | "number"; required?: boolean; value?: string }
  | { name: string; label: string; type: "select"; options: Opt[]; required?: boolean; value?: string }
  | { name: string; label: string; type: "multi"; options: Opt[]; selected: string[] }
  | { name: string; label: string; type: "color"; value: string };
type Opt = { value: string; label: string };

const COLORS = ["#7357e8", "#2f9e6a", "#e0891a", "#e5484d", "#3f6ff5", "#8a5cf6", "#0ea5a5", "#5368f4"];
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const dateVal = (v: unknown): string => (str(v).length >= 10 ? str(v).slice(0, 10) : "");
const opt = (values: string[]): Opt[] => values.map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

let kind: Kind = "milestone";
let projectId: string | undefined;
let workspaceId: string | undefined;
let entityId: string | undefined;
let ctx: Ctx = {};
let tab: "details" | "notes" = "details";
let connected = false;
let started = false;
let busy = false;

const NOUN: Record<Kind, string> = { milestone: "milestone", phase: "phase", deliverable: "deliverable", pto: "time off", person: "team member", role: "role", group: "group" };
const WORKSPACE_KINDS = new Set<Kind>(["pto", "person", "role", "group"]);

function peopleOpts(): Opt[] {
  return (ctx.people ?? []).map((p) => ({ value: str(p.id), label: str(p.full_name) || str(p.name) || "Unnamed" })).filter((o) => o.value);
}
function roleOpts(): Opt[] {
  return (ctx.roles ?? []).map((r) => ({ value: str(r.id), label: str(r.name) || "Role" })).filter((o) => o.value);
}
function laneOpts(): Opt[] {
  return (ctx.lanes ?? []).map((l) => ({ value: str(l.id), label: str(l.name) || "Lane" })).filter((o) => o.value);
}
function current(): Row | undefined {
  const list = kind === "milestone" ? ctx.milestones : kind === "phase" ? ctx.phases : kind === "deliverable" ? ctx.deliverables
    : kind === "pto" ? ctx.timeOff : kind === "person" ? ctx.people : kind === "role" ? ctx.roles : ctx.groups;
  return (list ?? []).find((r) => str(r.id) === entityId);
}
function phaseLaneIds(): string[] {
  return (ctx.assignments?.phaseLanes ?? []).filter((r) => str(r.phase_id) === entityId).map((r) => str(r.workstream_id));
}
function personRoleIds(): string[] {
  return (ctx.assignments?.personRoles ?? []).filter((r) => str(r.person_id) === entityId).map((r) => str(r.role_id));
}
function personPrimaryRole(): string {
  return str((ctx.assignments?.personRoles ?? []).find((r) => str(r.person_id) === entityId && Boolean(r.is_primary))?.role_id);
}
function groupMemberIds(): string[] {
  return (ctx.assignments?.groupMembers ?? []).filter((r) => str(r.group_id) === entityId).map((r) => str(r.person_id));
}
function notesList(): Row[] {
  const list = kind === "milestone" ? ctx.notes?.milestones : kind === "deliverable" ? ctx.notes?.deliverables : undefined;
  const parent = kind === "milestone" ? "milestone_id" : "deliverable_id";
  return (list ?? []).filter((n) => str(n[parent]) === entityId);
}
const hasNotes = (): boolean => kind === "milestone" || kind === "deliverable";

function fields(): Field[] {
  const a = current() ?? {};
  const color = (def: string): Field => ({ name: "color", label: "Color", type: "color", value: str(a.color) || def });
  switch (kind) {
    case "milestone":
      return [
        { name: "title", label: "Title", type: "text", required: true, value: str(a.title) },
        { name: "description", label: "Description", type: "textarea", value: str(a.description) },
        { name: "status", label: "Status", type: "select", options: opt(["planned", "in_progress", "completed", "missed", "canceled"]), value: str(a.status) || "planned" },
        { name: "targetDate", label: "Target date", type: "date", value: dateVal(a.target_date) },
      ];
    case "phase":
      return [
        { name: "name", label: "Name", type: "text", required: true, value: str(a.name) },
        { name: "description", label: "Description", type: "textarea", value: str(a.description) },
        { name: "startDate", label: "Start", type: "date", required: true, value: dateVal(a.starts_on) },
        { name: "dueDate", label: "End", type: "date", required: true, value: dateVal(a.ends_on) },
        color("#7357e8"),
        { name: "laneIds", label: "Lanes", type: "multi", options: laneOpts(), selected: phaseLaneIds() },
      ];
    case "deliverable":
      return [
        { name: "title", label: "Title", type: "text", required: true, value: str(a.title) },
        { name: "description", label: "Description", type: "textarea", value: str(a.description) },
        { name: "deliveryDate", label: "Delivery date", type: "date", required: true, value: dateVal(a.delivery_date) },
        { name: "progress", label: "Progress %", type: "number", value: String(num(a.progress)) },
        color("#5368f4"),
      ];
    case "pto":
      return [
        { name: "personId", label: "Person", type: "select", required: true, options: peopleOpts(), value: str(a.person_id) },
        { name: "startDate", label: "Start", type: "date", required: true, value: dateVal(a.starts_on) },
        { name: "endDate", label: "End", type: "date", required: true, value: dateVal(a.ends_on) },
        { name: "note", label: "Note", type: "textarea", value: str(a.note) },
      ];
    case "person":
      return [
        { name: "fullName", label: "Full name", type: "text", required: true, value: str(a.full_name) },
        { name: "personKind", label: "Kind", type: "select", options: opt(["team_member", "client"]), value: str(a.person_kind) || "team_member" },
        { name: "email", label: "Email", type: "text", value: str(a.email) },
        { name: "roleTitle", label: "Role title", type: "text", value: str(a.role_title) },
        { name: "organizationName", label: "Organization", type: "text", value: str(a.organization_name) },
        { name: "level", label: "Level", type: "select", options: [{ value: "", label: "—" }, ...opt(Array.from({ length: 12 }, (_, i) => `L${i + 1}`))], value: str(a.level) },
        { name: "allocation", label: "Allocation %", type: "number", value: entityId ? String(num(a.default_allocation_percent)) : "100" },
        { name: "availabilityNote", label: "Availability note", type: "textarea", value: str(a.availability_note) },
        { name: "notes", label: "Notes", type: "textarea", value: str(a.notes) },
        { name: "roleIds", label: "Roles", type: "multi", options: roleOpts(), selected: personRoleIds() },
        { name: "primaryRoleId", label: "Primary role", type: "select", options: [{ value: "", label: "—" }, ...roleOpts()], value: personPrimaryRole() },
      ];
    case "role":
      return [
        { name: "name", label: "Name", type: "text", required: true, value: str(a.name) },
        { name: "description", label: "Description", type: "textarea", value: str(a.description) },
        color("#7357e8"),
      ];
    case "group":
      return [
        { name: "name", label: "Name", type: "text", required: true, value: str(a.name) },
        { name: "description", label: "Description", type: "textarea", value: str(a.description) },
        color("#7357e8"),
        { name: "personIds", label: "Members", type: "multi", options: peopleOpts(), selected: groupMemberIds() },
      ];
  }
}

function fieldHtml(f: Field): string {
  const id = `f_${f.name}`;
  const req = "required" in f && f.required ? ' <span class="req">*</span>' : "";
  const label = `<label class="flabel" for="${id}">${esc(f.label)}${req}</label>`;
  if (f.type === "text") return `<div class="field">${label}<input id="${id}" type="text" value="${esc(f.value ?? "")}"></div>`;
  if (f.type === "textarea") return `<div class="field">${label}<textarea id="${id}" rows="3">${esc(f.value ?? "")}</textarea></div>`;
  if (f.type === "date") return `<div class="field">${label}<input id="${id}" type="date" value="${esc(f.value ?? "")}"></div>`;
  if (f.type === "number") return `<div class="field">${label}<input id="${id}" type="number" min="0" max="100" value="${esc(f.value ?? "0")}"></div>`;
  if (f.type === "select") return `<div class="field">${label}<select id="${id}">${f.options.map((o) => `<option value="${esc(o.value)}"${o.value === (f.value ?? "") ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>`;
  if (f.type === "multi") {
    const body = f.options.length
      ? `<div class="people">${f.options.map((o) => `<label class="chk"><input type="checkbox" name="${id}" value="${esc(o.value)}"${f.selected.includes(o.value) ? " checked" : ""}> ${esc(o.label)}</label>`).join("")}</div>`
      : '<p class="muted-s">None available.</p>';
    return `<div class="field">${label}${body}</div>`;
  }
  // color
  const sw = COLORS.map((hex) => `<label class="swatch"><input type="radio" name="${id}" value="${hex}"${f.value.toLowerCase() === hex ? " checked" : ""}><span style="background:${hex}"></span></label>`).join("");
  return `<div class="field">${label}<div class="swatches">${sw}</div></div>`;
}

function val(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return el ? el.value.trim() : "";
}
function radio(name: string): string { return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? ""; }
function checks(name: string): string[] { return Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map((i) => i.value); }

function buildAction(): Record<string, unknown> | { error: string } {
  const a = current();
  const editing = Boolean(entityId && a);
  const ver = editing ? num(a!.version) : 0;
  const orNull = (x: string): string | null => (x ? x : null);
  if (kind === "milestone") {
    if (!projectId) return { error: "No project scoped." };
    const title = val("f_title");
    if (!title) return { error: "Title is required." };
    const base = { projectId, title, description: val("f_description"), status: val("f_status") || "planned", targetDate: orNull(val("f_targetDate")) };
    return editing ? { action: "milestone.update", milestoneId: entityId, expectedVersion: ver, ...base } : { action: "milestone.create", ...base };
  }
  if (kind === "phase") {
    if (!projectId) return { error: "No project scoped." };
    const name = val("f_name");
    const startDate = val("f_startDate");
    const dueDate = val("f_dueDate");
    if (!name) return { error: "Name is required." };
    if (!startDate || !dueDate) return { error: "Start and end dates are required." };
    if (dueDate < startDate) return { error: "End must be on or after start." };
    const base = { projectId, name, description: val("f_description"), startDate, dueDate, color: radio("f_color") || "#7357e8", laneIds: checks("f_laneIds") };
    return editing ? { action: "phase.update", phaseId: entityId, expectedVersion: ver, ...base } : { action: "phase.create", ...base };
  }
  if (kind === "deliverable") {
    if (!projectId) return { error: "No project scoped." };
    const title = val("f_title");
    const deliveryDate = val("f_deliveryDate");
    if (!title) return { error: "Title is required." };
    if (!deliveryDate) return { error: "Delivery date is required." };
    const base = { projectId, title, description: val("f_description"), deliveryDate, progress: Math.max(0, Math.min(100, Number(val("f_progress")) || 0)), color: radio("f_color") || "#5368f4" };
    return editing ? { action: "deliverable.update", deliverableId: entityId, expectedVersion: ver, ...base } : { action: "deliverable.create", ...base };
  }
  if (kind === "person") {
    if (!projectId || !workspaceId) return { error: "A person needs a project and workspace in scope." };
    const fullName = val("f_fullName");
    if (!fullName) return { error: "Full name is required." };
    const base = {
      projectId, workspaceId, personKind: val("f_personKind") || "team_member", fullName,
      email: val("f_email"), roleTitle: val("f_roleTitle"), organizationName: val("f_organizationName"),
      level: val("f_level") || null, allocation: Math.max(0, Math.min(100, Number(val("f_allocation")) || 0)),
      availabilityNote: val("f_availabilityNote"), notes: val("f_notes"),
      roleIds: checks("f_roleIds"), primaryRoleId: val("f_primaryRoleId") || null, newRoleName: "",
    };
    return editing ? { action: "person.update", personId: entityId, expectedVersion: ver, ...base } : { action: "person.create", ...base };
  }
  if (kind === "role") {
    if (!projectId || !workspaceId) return { error: "A role needs a project and workspace in scope." };
    const name = val("f_name");
    if (!name) return { error: "Name is required." };
    const base = { projectId, workspaceId, name, description: val("f_description"), color: radio("f_color") || "#7357e8" };
    return editing ? { action: "role.update", roleId: entityId, expectedVersion: ver, ...base } : { action: "role.create", ...base };
  }
  if (kind === "group") {
    if (!projectId || !workspaceId) return { error: "A group needs a project and workspace in scope." };
    const name = val("f_name");
    if (!name) return { error: "Name is required." };
    const base = { projectId, workspaceId, name, description: val("f_description"), color: radio("f_color") || "#7357e8", personIds: checks("f_personIds") };
    return editing ? { action: "group.update", groupId: entityId, expectedVersion: ver, ...base } : { action: "group.create", ...base };
  }
  // pto
  if (!projectId || !workspaceId) return { error: "Time off needs a project and workspace in scope." };
  const personId = val("f_personId");
  const startDate = val("f_startDate");
  const endDate = val("f_endDate");
  if (!personId) return { error: "Pick a person." };
  if (!startDate || !endDate) return { error: "Start and end dates are required." };
  if (endDate < startDate) return { error: "End must be on or after start." };
  const base = { projectId, workspaceId, personId, startDate, endDate, note: val("f_note") };
  return editing ? { action: "pto.update", timeOffId: entityId, expectedVersion: ver, ...base } : { action: "pto.create", ...base };
}

async function reload(): Promise<void> {
  if (!projectId) return;
  try {
    const result = await app.callServerTool({ name: "lane_get_context", arguments: { projectId } });
    ctx = (result as { structuredContent?: Ctx }).structuredContent ?? {};
  } catch {
    /* keep last */
  }
}
async function apply(action: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  const result = await app.callServerTool({ name: "lane_apply_action", arguments: { action, preview: false } });
  const sc = (result as { structuredContent?: { applied?: boolean; message?: string } }).structuredContent;
  return { ok: Boolean(sc?.applied), message: sc?.message ?? "Nothing changed." };
}
function flash(message: string, ok = true): void {
  const el = document.getElementById("flash");
  if (el) { el.textContent = message; el.className = `flash ${ok ? "ok" : "err"}`; el.style.display = ""; }
}
function guard(fn: () => Promise<void>): () => Promise<void> {
  return async () => { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } };
}

function notesTab(): string {
  if (!entityId) return `<p class="muted-s">Save the ${NOUN[kind]} first, then reopen it to add notes.</p>`;
  const rows = notesList().map((n) => `<div class="item"><span class="note-body">${esc(str(n.body))}</span><button class="link-btn" data-note-del="${esc(str(n.id))}" data-v="${num(n.version)}">Remove</button></div>`).join("") ||
    '<div class="item"><span class="item-meta">No notes yet.</span></div>';
  return `<div class="list">${rows}</div><div class="addrow"><textarea id="new_note" rows="2" placeholder="Add a note…"></textarea><button class="btn btn-primary" id="add_note">Add</button></div>`;
}

function render(): void {
  const editing = Boolean(entityId);
  const title = `${editing ? "Edit" : "New"} ${NOUN[kind]}`;
  const tabs = hasNotes()
    ? `<div class="tabs"><button class="tab${tab === "details" ? " tab-on" : ""}" data-tab="details">Details</button><button class="tab${tab === "notes" ? " tab-on" : ""}" data-tab="notes">Notes${notesList().length ? ` <span class="tabnum">${notesList().length}</span>` : ""}</button></div>`
    : "";
  const body = tab === "notes" && hasNotes()
    ? notesTab()
    : fields().map(fieldHtml).join("") + `<div class="actions"><button class="btn btn-primary" id="save">${editing ? "Save changes" : `Create ${NOUN[kind]}`}</button></div>`;
  root.innerHTML = `<div class="card">${badge("Lane")}<h1>${esc(title.charAt(0).toUpperCase() + title.slice(1))}</h1>${tabs}<p class="flash" id="flash" style="display:none"></p><div class="tabbody">${body}</div></div>`;
  wire();
}

function wire(): void {
  root.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab as "details" | "notes"; render(); }));
  document.getElementById("save")?.addEventListener("click", guard(async () => {
    const built = buildAction();
    if ("error" in built) return flash(built.error as string, false);
    const btn = document.getElementById("save") as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    const res = await apply(built);
    if (!res.ok) { flash(res.message, false); if (btn) { btn.disabled = false; btn.textContent = entityId ? "Save changes" : `Create ${NOUN[kind]}`; } return; }
    if (!entityId) { root.innerHTML = `<div class="card">${badge("Lane")}<h1 class="ok">Created ✓</h1><p>${esc(res.message)}</p>${hasNotes() ? `<p class="muted-s">Reopen this ${NOUN[kind]} to add notes.</p>` : ""}</div>`; return; }
    await reload(); render(); flash("Saved ✓");
  }));
  document.getElementById("add_note")?.addEventListener("click", guard(async () => {
    const body = (document.getElementById("new_note") as HTMLTextAreaElement)?.value.trim();
    if (!body || !entityId) return;
    const action = kind === "milestone"
      ? { action: "milestoneNote.create", projectId, milestoneId: entityId, body }
      : { action: "deliverableNote.create", projectId, deliverableId: entityId, body };
    const res = await apply(action);
    if (!res.ok) return flash(res.message, false);
    await reload(); render();
  }));
  root.querySelectorAll<HTMLButtonElement>("button[data-note-del]").forEach((b) => b.addEventListener("click", guard(async () => {
    const action = kind === "milestone"
      ? { action: "milestoneNote.delete", projectId, milestoneId: entityId, noteId: b.dataset.noteDel, expectedVersion: num(b.dataset.v) }
      : { action: "deliverableNote.delete", projectId, deliverableId: entityId, noteId: b.dataset.noteDel, expectedVersion: num(b.dataset.v) };
    const res = await apply(action);
    if (!res.ok) return flash(res.message, false);
    await reload(); render();
  })));
}

async function start(): Promise<void> {
  if (started || !connected || !kind || !projectId) return;
  started = true;
  await reload();
  render();
}

root.innerHTML = `<div class="card">${badge("Lane")}<h1>Loading…</h1></div>`;

app.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
  const a = params?.arguments ?? {};
  const k = str(a.kind);
  if (["milestone", "phase", "deliverable", "pto", "person", "role", "group"].includes(k)) kind = k as Kind;
  projectId = str(a.projectId) || undefined;
  workspaceId = str(a.workspaceId) || undefined;
  entityId = str(a.entityId) || undefined;
  void start();
};
app.onerror = (error: unknown) => console.error("[lane-record]", error);

app
  .connect()
  .then(() => {
    applyInitialTheme(app);
    connected = true;
    void start();
    window.setTimeout(() => {
      if (!started) root.innerHTML = `<div class="card">${badge("Lane")}<h1>Waiting for details</h1><p>Ask Lane to open the editor again.</p></div>`;
    }, 2500);
  })
  .catch((error: unknown) => console.error("[lane-record] connect failed", error));
