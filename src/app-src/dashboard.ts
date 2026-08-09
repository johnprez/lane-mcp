/**
 * Ask Lane plan overview. Rendered for lane_get_context: needs-attention tiles
 * (blocked / unscheduled / overdue), a short attention list, and an upcoming
 * milestone timeline — all read-only. The card reads the plan graph itself on
 * connect (scoped to the same projectId the model used, from ontoolinput) since
 * the host doesn't reliably replay the triggering result. Supports a fullscreen
 * toggle where the host allows it.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;

type Row = Record<string, unknown>;
type Ctx = { projects?: Row[]; milestones?: Row[]; activities?: Row[]; lanes?: Row[]; people?: Row[] };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isDone = (status: string): boolean => ["done", "complete", "completed"].includes(status.toLowerCase());

function fmtDate(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

let currentMode = "inline";
let canFullscreen = false;

function fsButton(): string {
  if (!canFullscreen) return "";
  return `<button class="fs-btn" type="button" id="fs">${currentMode === "fullscreen" ? "Exit fullscreen" : "Fullscreen"}</button>`;
}

function wireFullscreen(): void {
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

function errCard(message: string): string {
  return `<div class="card wide">${badge("Lane · Overview")}<h1>Overview</h1><p>${esc(message)}</p></div>`;
}

function render(ctx: Ctx): void {
  const activities = ctx.activities ?? [];
  const milestones = ctx.milestones ?? [];
  const projects = ctx.projects ?? [];
  const now = Date.now();

  const blocked = activities.filter((a) => str(a.status).toLowerCase() === "blocked");
  const unscheduled = activities.filter((a) => !str(a.starts_at) || !str(a.due_at));
  const doneCount = activities.filter((a) => isDone(str(a.status))).length;
  const overdue = milestones.filter((m) => {
    const t = new Date(str(m.target_date)).getTime();
    return !isNaN(t) && t < now && !isDone(str(m.status));
  });

  const upcoming = milestones
    .filter((m) => str(m.target_date))
    .slice()
    .sort((a, b) => new Date(str(a.target_date)).getTime() - new Date(str(b.target_date)).getTime())
    .slice(0, 6);

  const scope = projects.length === 1 ? esc(str(projects[0].name) || "Project") : `${projects.length} projects`;

  const tile = (n: number, label: string, tone = ""): string =>
    `<div class="tile ${n > 0 ? tone : ""}"><span class="n">${n}</span><span class="l">${esc(label)}</span></div>`;

  const attention: string[] = [];
  for (const a of blocked.slice(0, 5)) attention.push(`<li><span class="dot dot-red"></span>Blocked · ${esc(str(a.title) || "activity")}</li>`);
  for (const m of overdue.slice(0, 5)) attention.push(`<li><span class="dot dot-amber"></span>Overdue · ${esc(str(m.title) || "milestone")}</li>`);
  const attentionHtml = attention.length
    ? `<ul class="attn">${attention.join("")}</ul>`
    : '<p class="ok-note">Nothing needs attention right now.</p>';

  const milestoneRows =
    upcoming
      .map((m) => {
        const t = new Date(str(m.target_date)).getTime();
        const late = !isNaN(t) && t < now && !isDone(str(m.status));
        return (
          `<div class="item"><span class="item-title">${esc(str(m.title) || "Untitled milestone")}</span>` +
          `<span class="item-meta ${late ? "err" : ""}">${esc(fmtDate(m.target_date))}${late ? " · overdue" : ""}</span></div>`
        );
      })
      .join("") || '<div class="item"><span class="item-meta">No milestones with dates.</span></div>';

  root.innerHTML =
    `<div class="card wide">` +
    `<div class="head">${badge("Lane · Overview")}${fsButton()}</div>` +
    `<h1>${scope}</h1>` +
    `<div class="tiles">` +
    tile(activities.length, "Activities") +
    tile(doneCount, "Done") +
    tile(blocked.length, "Blocked", "warn-red") +
    tile(unscheduled.length, "Unscheduled", "warn-amber") +
    tile(milestones.length, "Milestones") +
    tile(overdue.length, "Overdue", "warn-red") +
    `</div>` +
    `<h2>Needs attention</h2>${attentionHtml}` +
    `<h2>Upcoming milestones</h2><div class="list">${milestoneRows}</div>` +
    `</div>`;
  wireFullscreen();
}

const app = new App({ name: "Lane Overview", version: "0.1.0" });
wireTheme(app);
root.innerHTML = `<div class="card wide">${badge("Lane · Overview")}<h1>Plan overview</h1><p>Reading your plan…</p></div>`;

let projectId: string | undefined;
let loaded = false;

app.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
  const pid = params?.arguments?.projectId;
  if (typeof pid === "string") projectId = pid;
};

app.ontoolresult = (result: unknown) => {
  if (loaded) return;
  const ctx = (result as { structuredContent?: Ctx }).structuredContent;
  if (ctx && (ctx.activities || ctx.milestones || ctx.projects)) {
    loaded = true;
    render(ctx);
  }
};

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
        render(ctx);
      } else {
        root.innerHTML = errCard("No plan data came back.");
      }
    } catch {
      root.innerHTML = errCard("Couldn't read your plan.");
    }
  })
  .catch((error: unknown) => console.error("[lane-overview]", error));
