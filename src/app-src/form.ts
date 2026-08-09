/**
 * Ask Lane create form. Rendered by the lane_render_form tool: an interactive,
 * validated form the user fills in themselves to create a Lane record (activity,
 * milestone, event, task, note, link) — including assigning people. On submit it
 * assembles the exact lane_apply_action payload and applies it via callServerTool,
 * reporting the receipt inline. Options (people / lanes) are read from the plan
 * context on connect, scoped to the project the model passed.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;
const app = new App({ name: "Lane Form", version: "0.1.0" });
wireTheme(app);

type Row = Record<string, unknown>;
type Ctx = { people?: Row[]; lanes?: Row[]; milestones?: Row[] };
type FormInput = { kind?: string; projectId?: string; parentId?: string; parentType?: string; title?: string };
type Option = { value: string; label: string };
type Field =
  | { name: string; label: string; type: "text" | "textarea" | "date" | "datetime"; required?: boolean; value?: string; placeholder?: string }
  | { name: string; label: string; type: "select"; options: Option[]; value?: string }
  | { name: string; label: string; type: "checkbox" }
  | { name: string; label: string; type: "people"; options: Option[] };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const KIND_TITLE: Record<string, string> = {
  activity: "New activity", milestone: "New milestone", event: "New event",
  task: "New task", note: "New note", link: "Add link",
};

let input: FormInput = {};
let ctx: Ctx = {};
let connected = false;
let loaded = false;
let settled = false;

function peopleOptions(): Option[] {
  return (ctx.people ?? [])
    .map((p) => ({ value: str(p.id), label: str(p.full_name) || str(p.name) || str(p.fullName) || "Unnamed" }))
    .filter((o) => o.value);
}
function laneOptions(): Option[] {
  return [{ value: "", label: "— No lane —" }, ...(ctx.lanes ?? []).map((l) => ({ value: str(l.id), label: str(l.name) || "Lane" })).filter((o) => o.value)];
}

function fieldsFor(kind: string): Field[] {
  const opts = (values: string[]): Option[] => values.map((v) => ({ value: v, label: v.replace(/_/g, " ") }));
  switch (kind) {
    case "activity":
      return [
        { name: "title", label: "Title", type: "text", required: true, value: input.title },
        { name: "description", label: "Description", type: "textarea" },
        { name: "status", label: "Status", type: "select", value: "ready", options: opts(["backlog", "ready", "in_progress", "blocked", "done", "canceled"]) },
        { name: "priority", label: "Priority", type: "select", value: "none", options: opts(["none", "low", "medium", "high", "urgent"]) },
        { name: "dueDate", label: "Due date", type: "date" },
        { name: "laneId", label: "Lane", type: "select", options: laneOptions() },
        { name: "ownerPersonIds", label: "Assignees", type: "people", options: peopleOptions() },
      ];
    case "milestone":
      return [
        { name: "title", label: "Title", type: "text", required: true, value: input.title },
        { name: "description", label: "Description", type: "textarea" },
        { name: "status", label: "Status", type: "select", value: "planned", options: opts(["planned", "in_progress", "completed", "missed", "canceled"]) },
        { name: "targetDate", label: "Target date", type: "date" },
      ];
    case "event":
      return [
        { name: "title", label: "Title", type: "text", required: true, value: input.title },
        { name: "description", label: "Description", type: "textarea" },
        { name: "startsAt", label: "Starts", type: "datetime", required: true },
        { name: "allDay", label: "All day", type: "checkbox" },
        { name: "personIds", label: "Attendees", type: "people", options: peopleOptions() },
      ];
    case "task":
      return [
        { name: "name", label: "Task", type: "text", required: true, value: input.title },
        { name: "note", label: "Note", type: "textarea" },
        { name: "personIds", label: "Assignees", type: "people", options: peopleOptions() },
      ];
    case "note":
      return [{ name: "body", label: "Note", type: "textarea", required: true, value: input.title }];
    case "link":
      return [
        { name: "url", label: "URL", type: "text", required: true, placeholder: "https://…" },
        { name: "label", label: "Label", type: "text" },
      ];
    default:
      return [];
  }
}

function fieldHtml(f: Field): string {
  const id = `f_${f.name}`;
  const req = "required" in f && f.required ? ' <span class="req">*</span>' : "";
  if (f.type === "checkbox") {
    return `<div class="field"><label class="chk"><input id="${id}" type="checkbox"> ${esc(f.label)}</label></div>`;
  }
  let control = "";
  if (f.type === "text") control = `<input id="${id}" type="text" placeholder="${esc(f.placeholder ?? "")}" value="${esc(f.value ?? "")}">`;
  else if (f.type === "textarea") control = `<textarea id="${id}" rows="3">${esc(f.value ?? "")}</textarea>`;
  else if (f.type === "date") control = `<input id="${id}" type="date">`;
  else if (f.type === "datetime") control = `<input id="${id}" type="datetime-local">`;
  else if (f.type === "select") control = `<select id="${id}">${f.options.map((o) => `<option value="${esc(o.value)}"${o.value === (f.value ?? "") ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
  else control = f.options.length
    ? `<div class="people">${f.options.map((o) => `<label class="chk"><input type="checkbox" name="${id}" value="${esc(o.value)}"> ${esc(o.label)}</label>`).join("")}</div>`
    : '<p class="muted-s">No people in this project yet.</p>';
  return `<div class="field"><label class="flabel" for="${id}">${esc(f.label)}${req}</label>${control}</div>`;
}

function collect(fields: Field[]): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const id = `f_${f.name}`;
    if (f.type === "people") {
      out[f.name] = Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${id}"]:checked`)).map((i) => i.value);
    } else if (f.type === "checkbox") {
      out[f.name] = (document.getElementById(id) as HTMLInputElement | null)?.checked ?? false;
    } else {
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      out[f.name] = el ? el.value.trim() : "";
    }
    if ("required" in f && f.required && (out[f.name] === "" || out[f.name] == null)) return null;
  }
  return out;
}

function buildAction(kind: string, v: Record<string, unknown>): Record<string, unknown> | { error: string } {
  const projectId = input.projectId;
  if (!projectId) return { error: "No project is scoped for this form." };
  const orNull = (x: unknown): unknown => (x ? x : null);
  switch (kind) {
    case "activity":
      return { action: "activity.create", projectId, title: v.title, description: v.description || "", status: v.status || "ready", priority: v.priority || "none", startDate: null, dueDate: orNull(v.dueDate), laneId: orNull(v.laneId), milestoneId: null, progress: 0, color: null, ownerPersonIds: v.ownerPersonIds || [], ownerGroupIds: [] };
    case "milestone":
      return { action: "milestone.create", projectId, title: v.title, description: v.description || "", status: v.status || "planned", targetDate: orNull(v.targetDate) };
    case "event": {
      if (!v.startsAt) return { error: "Pick a start time." };
      const startsAt = new Date(String(v.startsAt)).toISOString();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      return { action: "event.create", projectId, title: v.title, description: v.description || "", startsAt, endsAt: null, allDay: Boolean(v.allDay), timezone, color: "#7357e8", laneIds: [], personIds: v.personIds || [], groupIds: [] };
    }
    case "task":
      if (!input.parentId) return { error: "This task needs a parent activity." };
      return { action: "task.create", projectId, activityId: input.parentId, name: v.name, personIds: v.personIds || [], isDone: false, note: v.note || "", progress: 0 };
    case "note": {
      if (!input.parentId) return { error: "This note needs a parent record." };
      const map: Record<string, [string, string]> = {
        activity: ["activityNote.create", "activityId"], milestone: ["milestoneNote.create", "milestoneId"],
        event: ["eventNote.create", "eventId"], deliverable: ["deliverableNote.create", "deliverableId"],
      };
      const [action, key] = map[input.parentType || "activity"] || map.activity;
      return { action, projectId, [key]: input.parentId, body: v.body };
    }
    case "link":
      if (!input.parentId || !input.parentType) return { error: "This link needs a target object." };
      return { action: "link.create", projectId, objectType: input.parentType, objectId: input.parentId, url: v.url, label: v.label || "" };
    default:
      return { error: `Unsupported form: ${kind}` };
  }
}

function statusCard(title: string, cls: "ok" | "err" | "", message: string): string {
  settled = true;
  return `<div class="card">${badge("Lane · Create")}<h1 class="${cls}">${esc(title)}</h1><p>${esc(message)}</p></div>`;
}

function showError(message: string): void {
  const el = document.getElementById("err");
  if (el) {
    el.style.display = "";
    el.textContent = message;
  }
}

async function onSubmit(kind: string, fields: Field[]): Promise<void> {
  const values = collect(fields);
  if (!values) return showError("Fill in the required fields.");
  const built = buildAction(kind, values);
  if ("error" in built) return showError(built.error as string);
  const save = document.getElementById("save") as HTMLButtonElement | null;
  const cancel = document.getElementById("cancel") as HTMLButtonElement | null;
  if (save) { save.disabled = true; save.textContent = "Creating…"; }
  if (cancel) cancel.disabled = true;
  try {
    const result = await app.callServerTool({ name: "lane_apply_action", arguments: { action: built, preview: false } });
    const sc = (result as { structuredContent?: { applied?: boolean; message?: string } }).structuredContent;
    const isError = (result as { isError?: boolean }).isError;
    if (sc?.applied) {
      root.innerHTML = statusCard("Created ✓", "ok", sc.message || "Item created.");
      return;
    }
    showError(sc?.message || (isError ? "Lane rejected this change." : "Nothing was created."));
  } catch {
    showError("Couldn't reach Lane to create this.");
  }
  if (save) { save.disabled = false; save.textContent = "Create"; }
  if (cancel) cancel.disabled = false;
}

function renderForm(): void {
  if (settled) return;
  const kind = input.kind || "";
  const fields = fieldsFor(kind);
  if (!fields.length) {
    root.innerHTML = statusCard("Unsupported form", "err", `Lane can't render a form for "${kind}".`);
    return;
  }
  root.innerHTML =
    `<div class="card">${badge("Lane · Create")}<h1>${esc(KIND_TITLE[kind] || "New item")}</h1>` +
    `<form id="laneform" autocomplete="off">${fields.map(fieldHtml).join("")}` +
    `<p class="err note" id="err" style="display:none"></p>` +
    `<div class="actions"><button class="btn btn-primary" type="submit" id="save">Create</button>` +
    `<button class="btn btn-ghost" type="button" id="cancel">Cancel</button></div></form></div>`;
  (document.getElementById("laneform") as HTMLFormElement | null)?.addEventListener("submit", (e) => {
    e.preventDefault();
    void onSubmit(kind, fields);
  });
  document.getElementById("cancel")?.addEventListener("click", () => {
    root.innerHTML = statusCard("Cancelled", "", "No item was created.");
  });
}

async function maybeLoad(): Promise<void> {
  if (loaded || !connected || !input.kind) return;
  loaded = true;
  if (input.projectId) {
    try {
      const result = await app.callServerTool({ name: "lane_get_context", arguments: { projectId: input.projectId } });
      ctx = (result as { structuredContent?: Ctx }).structuredContent ?? {};
    } catch {
      /* render with empty option lists */
    }
  }
  renderForm();
}

root.innerHTML = `<div class="card">${badge("Lane · Create")}<h1>Preparing form…</h1><p>Loading options…</p></div>`;

app.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
  const a = params?.arguments ?? {};
  input = {
    kind: str(a.kind) || undefined,
    projectId: str(a.projectId) || undefined,
    parentId: str(a.parentId) || undefined,
    parentType: str(a.parentType) || undefined,
    title: str(a.title) || undefined,
  };
  void maybeLoad();
};
app.onerror = (error: unknown) => console.error("[lane-form]", error);

app
  .connect()
  .then(() => {
    applyInitialTheme(app);
    connected = true;
    void maybeLoad();
    window.setTimeout(() => {
      if (loaded) return;
      if (input.kind) {
        loaded = true;
        renderForm();
      } else {
        root.innerHTML = statusCard("Waiting for form details", "", "Ask Lane to open the form again.");
        settled = false;
      }
    }, 2500);
  })
  .catch((error: unknown) => console.error("[lane-form] connect failed", error));
