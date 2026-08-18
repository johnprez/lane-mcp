/**
 * Ask Lane generative view. Rendered for lane_render_view — the server computes a
 * data-bound LaneView spec (availability/PTO, overview, milestones, deliverables,
 * activities, signals, portfolio) and this paints it. Read-only. Reuses the
 * shared MCP-App CSS shell (.card, .listrow, .st-*, .tprog, theme vars).
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;
type Spec = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const arr = (v: unknown): Spec[] => (Array.isArray(v) ? (v as Spec[]) : []);

function fmtDate(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  const d = new Date(`${s}T00:00:00Z`);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function range(a: unknown, b: unknown): string {
  const s = fmtDate(a);
  const e = fmtDate(b);
  return s && e ? (s === e ? s : `${s} – ${e}`) : s || e;
}
function statusPill(status: string): string {
  const s = status.toLowerCase();
  return `<span class="st st-${esc(s)}">${esc(status.replace(/_/g, " "))}</span>`;
}
function bar(progress: number): string {
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  return `<span class="tprog" aria-hidden="true"><i style="width:${p}%"></i></span><span class="muted mono">${p}%</span>`;
}
function avatars(owners: Spec[]): string {
  if (!owners.length) return "";
  return `<span class="avstack">${owners.slice(0, 6).map((o) => `<i title="${esc(str(o.name))}">${esc(str(o.initials) || str(o.name).slice(0, 2).toUpperCase())}</i>`).join("")}</span>`;
}
function head(title: string, sub?: string): string {
  return `<header class="vh">${badge("Lane")}<h2>${esc(title)}</h2>${sub ? `<p class="muted">${esc(sub)}</p>` : ""}</header>`;
}
function emptyRow(text: string): string {
  return `<p class="muted vempty">${esc(text)}</p>`;
}

function renderAvailability(s: Spec): string {
  const scope = str(s.scope) === "workspace" ? "Across the workspace" : `Project · ${str(s.projectName) || "this project"}`;
  const out = arr(s.out);
  const current = out.filter((o) => o.current === true);
  const upcoming = out.filter((o) => o.current !== true);
  const conflicts = arr(s.conflicts);
  const person = (o: Spec) => `<div class="listrow static"><span class="grow"><strong>${esc(str(o.personName))}</strong>${o.role ? ` <span class="muted">· ${esc(str(o.role))}</span>` : ""}${o.note ? `<span class="sub">${esc(str(o.note))}</span>` : ""}</span><span class="muted nowrap">${esc(range(o.startsOn, o.endsOn))}</span></div>`;
  return `${head("Availability", scope)}
    <section class="vsec"><p class="vlabel">Currently out</p>${current.length ? current.map(person).join("") : emptyRow("Nobody is out right now.")}</section>
    <section class="vsec"><p class="vlabel">Upcoming time off</p>${upcoming.length ? upcoming.map(person).join("") : emptyRow("No upcoming time off on the books.")}</section>
    ${conflicts.length ? `<section class="vsec"><p class="vlabel warn">Scheduling conflicts (${conflicts.length})</p>${conflicts.map((c) => `<div class="listrow static"><span class="grow"><strong>${esc(str(c.personName))}</strong> is out during <span class="muted">${esc(str(c.activityTitle))}</span>${c.projectName ? `<span class="sub">${esc(str(c.projectName))}</span>` : ""}</span><span class="muted nowrap">${esc(range(c.startsOn, c.endsOn))}</span></div>`).join("")}</section>` : ""}`;
}

function renderMilestones(s: Spec): string {
  const ms = arr(s.milestones);
  const at = str(s.today);
  return `${head("Milestones", str(s.projectName))}
    <section class="vsec">${ms.length ? ms.map((m) => {
      const date = str(m.targetDate);
      const overdue = date && at && date < at && str(m.status) !== "completed";
      return `<div class="listrow static"><span class="grow"><strong>${esc(str(m.title))}</strong> ${statusPill(str(m.status))}</span><span class="muted nowrap">${date ? esc(fmtDate(date)) : "no date"}${overdue ? ` · <span class="warn">overdue</span>` : ""}</span></div>`;
    }).join("") : emptyRow("No milestones yet.")}</section>`;
}

function renderDeliverables(s: Spec): string {
  const ds = arr(s.deliverables);
  return `${head("Deliverables", str(s.projectName))}
    <section class="vsec">${ds.length ? ds.map((d) => `<div class="listrow static"><span class="grow"><strong>${esc(str(d.title))}</strong> ${statusPill(str(d.status))}</span><span class="metaend">${bar(num(d.progress))}<span class="muted nowrap">${d.deliveryDate ? esc(fmtDate(d.deliveryDate)) : "no date"}</span></span></div>`).join("") : emptyRow("No deliverables yet.")}</section>`;
}

function renderActivities(s: Spec): string {
  const acts = arr(s.activities);
  const byLane = new Map<string, Spec[]>();
  for (const a of acts) {
    const lane = str(a.laneName) || "Ungrouped";
    byLane.set(lane, [...(byLane.get(lane) ?? []), a]);
  }
  const lanes = [...byLane.entries()].map(([lane, items]) => `<section class="vsec"><p class="vlabel">${esc(lane)} <span class="muted">· ${items.length}</span></p>${items.map((a) => `<div class="listrow static"><span class="grow"><strong>${esc(str(a.title))}</strong> ${statusPill(str(a.status))}${a.taskTotal ? `<span class="sub">${num(a.taskDone)}/${num(a.taskTotal)} tasks</span>` : ""}</span><span class="metaend">${avatars(arr(a.owners))}${bar(num(a.progress))}</span></div>`).join("")}</section>`).join("");
  return `${head("Activities", str(s.projectName))}${acts.length ? lanes : emptyRow("No activities yet.")}`;
}

function renderOverview(s: Spec): string {
  const read = (s.read && typeof s.read === "object" ? s.read : {}) as Spec;
  const ms = arr(s.milestones);
  const ds = arr(s.deliverables);
  return `${head(str(s.projectName) || "Project overview")}
    <section class="vhero"><p class="veyebrow">${esc(str(read.eyebrow))}</p><p class="vtitle">${esc(str(read.title))}</p><p class="muted">${esc(str(read.detail))}</p>
      <div class="vstat"><span>${statusPill(str(s.health) || "unknown")}</span><span class="metaend">${bar(num(s.progress))}</span></div></section>
    ${ms.length ? `<section class="vsec"><p class="vlabel">Open milestones</p>${ms.map((m) => `<div class="listrow static"><span class="grow"><strong>${esc(str(m.title))}</strong> ${statusPill(str(m.status))}</span><span class="muted nowrap">${m.targetDate ? esc(fmtDate(m.targetDate)) : "no date"}</span></div>`).join("")}</section>` : ""}
    ${ds.length ? `<section class="vsec"><p class="vlabel">Deliverables</p>${ds.map((d) => `<div class="listrow static"><span class="grow"><strong>${esc(str(d.title))}</strong></span><span class="metaend">${bar(num(d.progress))}<span class="muted nowrap">${d.deliveryDate ? esc(fmtDate(d.deliveryDate)) : ""}</span></span></div>`).join("")}</section>` : ""}`;
}

function renderSignals(s: Spec): string {
  const m = (s.metrics && typeof s.metrics === "object" ? s.metrics : {}) as Spec;
  const stats = (m.stats && typeof m.stats === "object" ? m.stats : {}) as Spec;
  const tile = (n: number | string, label: string, tone = "") => `<div class="tile ${tone}"><span class="tnum">${esc(String(n))}</span><span class="tlabel">${esc(label)}</span></div>`;
  return `${head("Signals", str(s.projectName))}
    <section class="vtiles">
      ${tile(num(m.atRiskScore), "At-risk score", num(m.atRiskScore) > 40 ? "warn" : "")}
      ${tile(arr(m.blockedItems).length, "Blocked", arr(m.blockedItems).length ? "warn" : "")}
      ${tile(arr(m.overdueMilestones).length, "Overdue milestones", arr(m.overdueMilestones).length ? "warn" : "")}
      ${tile(arr(m.scheduleSlips).length, "Behind schedule")}
      ${tile(num(stats.unassigned), "Unassigned")}
      ${tile(num(stats.progress) + "%", "Progress")}
    </section>`;
}

function renderPortfolio(s: Spec): string {
  const ps = arr(s.projects);
  return `${head("Portfolio health")}
    <section class="vsec">${ps.length ? ps.map((p) => `<div class="listrow static"><span class="grow"><strong>${esc(str(p.name))}</strong> ${statusPill(str(p.health) || "unknown")}${p.nextMilestoneTitle ? `<span class="sub">Next: ${esc(str(p.nextMilestoneTitle))}${p.nextMilestoneDate ? ` · ${esc(fmtDate(p.nextMilestoneDate))}` : ""}</span>` : ""}</span><span class="metaend">${num(p.blocked) ? `<span class="st st-blocked">${num(p.blocked)} blocked</span>` : ""}${bar(num(p.progress))}</span></div>`).join("") : emptyRow("No projects to roll up.")}</section>`;
}

function renderCallout(s: Spec): string {
  const tone = str(s.tone) || "info";
  return `<div class="card vcallout tone-${esc(tone)}">${badge("Lane")}<h2>${esc(str(s.title))}</h2><p class="muted">${esc(str(s.body))}</p></div>`;
}

function render(spec: Spec | null): void {
  if (!spec) { root.innerHTML = `<div class="card">${badge("Lane")}<p class="muted vempty">Loading…</p></div>`; return; }
  const view = str(spec.view);
  let body: string;
  switch (view) {
    case "availability": body = renderAvailability(spec); break;
    case "milestones": body = renderMilestones(spec); break;
    case "deliverables": body = renderDeliverables(spec); break;
    case "activities": body = renderActivities(spec); break;
    case "project_overview": body = renderOverview(spec); break;
    case "project_signals": body = renderSignals(spec); break;
    case "portfolio_health": body = renderPortfolio(spec); break;
    case "callout": root.innerHTML = renderCallout(spec); return;
    default: body = `${head("View")}${emptyRow(`Unsupported view: ${view || "unknown"}.`)}`;
  }
  root.innerHTML = `<div class="card vcard">${body}</div>`;
}

// App-local styles layered on the shared shell.
const style = document.createElement("style");
style.textContent = `
  .vcard { max-width: 560px; }
  .vh { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; margin-bottom:6px; }
  .vh h2 { margin:0; font-size:17px; letter-spacing:-.02em; }
  .vh p { margin:0; }
  .vsec { margin-top:14px; }
  .vlabel { margin:0 0 6px; font-size:10.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); }
  .vlabel.warn { color:var(--amber); }
  .listrow.static { cursor:default; align-items:flex-start; }
  .listrow.static:hover { background:transparent; }
  .grow { display:flex; flex-direction:column; gap:2px; min-width:0; flex:1; }
  .sub { color:var(--muted); font-size:11.5px; }
  .nowrap { white-space:nowrap; }
  .mono { font-variant-numeric:tabular-nums; }
  .metaend { display:inline-flex; align-items:center; gap:8px; flex:none; }
  .avstack { display:inline-flex; }
  .avstack i { display:grid; place-items:center; width:22px; height:22px; margin-left:-5px; border:2px solid var(--card-bg); border-radius:50%; background:var(--purple-bg); color:var(--purple); font-size:9px; font-weight:700; font-style:normal; }
  .avstack i:first-child { margin-left:0; }
  .vhero { margin-top:6px; padding:14px; border:1px solid var(--line); border-radius:13px; background:var(--subtle); }
  .veyebrow { margin:0; font-size:10.5px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--purple); }
  .vtitle { margin:3px 0 4px; font-size:16px; font-weight:650; letter-spacing:-.01em; }
  .vstat { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:10px; }
  .vtiles { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
  .tile.warn { border-color:color-mix(in srgb,var(--amber) 40%,var(--line)); }
  .tnum { font-size:22px; font-weight:640; letter-spacing:-.03em; }
  .tlabel { font-size:10.5px; font-weight:600; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); }
  .vempty { padding:6px 0; }
  .tprog { display:inline-block; width:64px; }
`;
document.head.appendChild(style);

const app = new App({ name: "Lane View", version: "0.1.0" });
wireTheme(app);

let spec: Spec | null = null;
let loaded = false;
let toolArgs: Record<string, unknown> = {};
render(null);

app.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
  if (params?.arguments && typeof params.arguments === "object") toolArgs = params.arguments;
};

app.ontoolresult = (result: unknown) => {
  if (loaded) return;
  const sc = (result as { structuredContent?: Spec }).structuredContent;
  if (sc && typeof sc === "object" && typeof sc.view === "string") { loaded = true; spec = sc; render(spec); }
};

app.onerror = (error: unknown) => console.error("[lane-view]", error);

// The host doesn't reliably replay the triggering tool's RESULT to a freshly
// loaded app, so if `ontoolresult` hasn't delivered the spec by the time we're
// connected, re-run the tool ourselves with the captured input args.
app
  .connect()
  .then(async () => {
    applyInitialTheme(app);
    if (loaded) return;
    try {
      const args = { view: str(toolArgs.view) || "project_overview", ...(toolArgs.projectId ? { projectId: toolArgs.projectId } : {}), ...(toolArgs.workspaceId ? { workspaceId: toolArgs.workspaceId } : {}) };
      const result = await app.callServerTool({ name: "lane_render_view", arguments: args });
      const sc = (result as { structuredContent?: Spec }).structuredContent;
      if (sc && typeof sc === "object" && typeof sc.view === "string") { loaded = true; spec = sc; render(spec); }
    } catch (error) {
      console.error("[lane-view] self-fetch failed", error);
    }
  })
  .catch((error) => console.error("[lane-view] connect failed", error));
