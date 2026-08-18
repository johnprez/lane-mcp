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

const LOAD_LABEL: Record<string, string> = { under: "Has room", balanced: "Balanced", high: "High", over: "Over capacity" };
function renderWorkload(s: Spec): string {
  const people = arr(s.people);
  const scope = str(s.scope) === "workspace" ? "Across the workspace" : `Project · ${str(s.projectName) || "this project"}`;
  const near = people.filter((p) => str(p.load) === "high" || str(p.load) === "over").length;
  return `${head("Workload", scope)}
    <section class="vsec"><p class="vlabel">Capacity <span class="muted">· ${near} near/over · ${people.length - near} have room</span></p>
    ${people.length ? people.map((p) => {
      const load = str(p.load);
      const out = p.outSoon && typeof p.outSoon === "object" ? p.outSoon as Spec : null;
      const n = num(p.activeCount);
      return `<div class="listrow static"><span class="grow"><strong>${esc(str(p.name))}</strong>${p.role ? ` <span class="muted">· ${esc(str(p.role))}</span>` : ""}<span class="sub">${n} active${out ? ` · out ${esc(range(out.startsOn, out.endsOn))}` : ""}</span></span><span class="load load-${esc(load)}">${esc(LOAD_LABEL[load] ?? load)}</span></div>`;
    }).join("") : emptyRow("No team members own open work here.")}</section>`;
}

function renderAttention(s: Spec): string {
  const m = (s.metrics && typeof s.metrics === "object" ? s.metrics : {}) as Spec;
  const first = (list: unknown): string => { const a = arr(list); return a.length ? str(a[0].title) : ""; };
  const worst = (list: unknown): string => { const a = arr(list); const d = a.length ? num(a[0].daysOverdue) : 0; return d > 0 ? `worst ${d}d` : ""; };
  const rows: string[] = [];
  const row = (dot: string, n: number, label: string, detail: string) => { if (n > 0) rows.push(`<div class="listrow static"><span class="grow"><span class="adot ${dot}"></span><strong>${n}</strong> ${esc(label)}${detail ? `<span class="sub">${esc(detail)}</span>` : ""}</span></div>`); };
  row("dot-red", arr(m.blockedItems).length, "blocked", first(m.blockedItems));
  row("dot-red", arr(m.overdueMilestones).length, "overdue milestones", worst(m.overdueMilestones) || first(m.overdueMilestones));
  row("dot-amber", arr(m.scheduleSlips).length, "behind schedule", worst(m.scheduleSlips) || first(m.scheduleSlips));
  row("dot-iris", arr(m.unassignedItems).length, "unassigned", "");
  row("dot-iris", arr(m.unscheduledItems).length, "unscheduled", "");
  return `${head("Needs attention", str(s.projectName))}
    <section class="vhero attn-hero"><span class="attn-score">${num(m.atRiskScore)}</span><span class="tlabel">At-risk score</span></section>
    <section class="vsec">${rows.length ? rows.join("") : emptyRow("Nothing needs attention — the route is clear.")}</section>`;
}

function agoTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d` : fmtDate(iso.slice(0, 10));
}
const LOG_VERB: Record<string, string> = { created: "created", updated: "updated", deleted: "deleted", archived: "archived", restored: "restored", insert: "added", update: "updated", delete: "removed", invited: "invited", joined: "joined", role_changed: "changed the role of" };
const LOG_NOUN: Record<string, string> = { work_item: "activity", task: "task", milestone: "milestone", deliverable: "deliverable", lane: "lane", phase: "phase", event: "event", plan_dependency: "dependency", work_item_dependency: "dependency", work_item_note: "note", milestone_note: "note", event_note: "note", deliverable_note: "note", person: "person", role: "role", group: "group", pto: "time off", project_access: "project access", workspace_membership: "membership", workspace_invitation: "invitation" };
function renderActivityLog(s: Spec): string {
  const entries = arr(s.entries);
  return `${head("Recent activity", str(s.projectName))}
    <section class="vsec">${entries.length ? entries.map((e) => {
      const verb = LOG_VERB[str(e.action)] ?? str(e.action).replace(/_/g, " ");
      const noun = LOG_NOUN[str(e.entityType)] ?? str(e.entityType).replace(/_/g, " ");
      const label = str(e.label) ? ` “${esc(str(e.label))}”` : "";
      const initials = str(e.actorName).split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
      return `<div class="listrow static logrow"><span class="avstack"><i>${esc(initials || "?")}</i></span><span class="grow"><span><strong>${esc(str(e.actorName))}</strong> ${esc(verb)} ${esc(noun)}${label}</span></span><span class="muted nowrap">${esc(agoTime(str(e.createdAt)))}</span></div>`;
    }).join("") : emptyRow("No activity recorded yet.")}</section>`;
}

function renderTimeline(s: Spec): string {
  const start = str(s.start), end = str(s.end), today = str(s.today);
  const t0 = Date.parse(`${start}T00:00:00Z`);
  const t1 = Date.parse(`${end}T00:00:00Z`);
  const span = Math.max(1, t1 - t0);
  const pos = (iso: string): number => { const t = Date.parse(`${iso}T00:00:00Z`); return isNaN(t) ? 0 : Math.min(100, Math.max(0, ((t - t0) / span) * 100)); };
  const lanes = arr(s.lanes), phases = arr(s.phases), milestones = arr(s.milestones);
  const ticks: string[] = [];
  const d = new Date(t0); d.setUTCDate(1);
  while (d.getTime() <= t1) {
    const iso = d.toISOString().slice(0, 10);
    const left = ((Date.parse(`${iso}T00:00:00Z`) - t0) / span) * 100;
    if (left >= -2 && left <= 100) ticks.push(`<span class="gtick" style="left:${Math.max(0, left)}%">${d.toLocaleDateString(undefined, { month: "short" })}</span>`);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  const todayLeft = pos(today);
  const todayLine = todayLeft >= 0 && todayLeft <= 100 ? `<div class="gtoday" style="left:${todayLeft}%"></div>` : "";
  const phaseBands = phases.map((p) => {
    const l = pos(str(p.startsOn)), r = pos(str(p.endsOn)), w = Math.max(1.5, r - l);
    const c = str(p.color);
    return `<div class="gphase" style="left:${l}%;width:${w}%;${c ? `background:${esc(c)}1f;border-color:${esc(c)}55` : ""}" title="${esc(str(p.name))}"><span>${esc(str(p.name))}</span></div>`;
  }).join("");
  const laneRows = lanes.map((lane) => {
    const bars = arr(lane.activities).map((a) => {
      const s0 = str(a.startsOn), d0 = str(a.dueOn);
      if (!s0 && !d0) return "";
      const l = pos(s0 || d0), r = pos(d0 || s0), w = Math.max(1.2, r - l);
      return `<div class="gbar gs-${esc(str(a.status))}" style="left:${l}%;width:${w}%" title="${esc(str(a.title))}"><i style="width:${num(a.progress)}%"></i><span>${esc(str(a.title))}</span></div>`;
    }).join("");
    return `<div class="glane"><span class="glabel" title="${esc(str(lane.name))}">${esc(str(lane.name))}</span><div class="gtrack">${todayLine}${bars}</div></div>`;
  }).join("");
  const msRow = milestones.length
    ? `<div class="glane"><span class="glabel muted">Milestones</span><div class="gtrack gtrack-ms">${todayLine}${milestones.map((m) => `<span class="gdia gs-${esc(str(m.status))}" style="left:${pos(str(m.targetDate))}%" title="${esc(str(m.title))} · ${esc(fmtDate(m.targetDate))}"></span>`).join("")}</div></div>`
    : "";
  const undated = num(s.undatedCount);
  return `${head("Timeline", `${str(s.projectName)} · ${fmtDate(start)} – ${fmtDate(end)}`)}
    <div class="gwrap">
      <div class="glane ghead"><span class="glabel"></span><div class="gtrack gmonths">${ticks.join("")}</div></div>
      ${phases.length ? `<div class="glane"><span class="glabel muted">Phases</span><div class="gtrack">${todayLine}${phaseBands}</div></div>` : ""}
      ${laneRows || emptyRow("No dated activities to plot.")}
      ${msRow}
    </div>
    ${undated ? `<p class="muted vempty">${undated} activit${undated === 1 ? "y has" : "ies have"} no dates and aren't shown.</p>` : ""}`;
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
    case "workload": body = renderWorkload(spec); break;
    case "attention": body = renderAttention(spec); break;
    case "activity_log": body = renderActivityLog(spec); break;
    case "timeline": body = renderTimeline(spec); break;
    case "portfolio_health": body = renderPortfolio(spec); break;
    case "callout": root.innerHTML = renderCallout(spec); return;
    default: body = `${head("View")}${emptyRow(`Unsupported view: ${view || "unknown"}.`)}`;
  }
  root.innerHTML = `<div class="card vcard${view === "timeline" ? " gantt" : ""}">${body}</div>`;
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
  .load { flex:none; padding:3px 10px; border-radius:999px; font-size:10.5px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:var(--muted); background:var(--subtle); }
  .load-high { color:var(--amber); background:color-mix(in srgb,var(--amber) 15%,transparent); }
  .load-over { color:var(--red); background:color-mix(in srgb,var(--red) 15%,transparent); }
  .load-under { color:var(--jade); background:color-mix(in srgb,var(--jade) 14%,transparent); }
  .adot { display:inline-block; width:8px; height:8px; margin-right:8px; border-radius:50%; vertical-align:middle; background:var(--muted); }
  .adot.dot-red { background:var(--red); } .adot.dot-amber { background:var(--amber); } .adot.dot-iris { background:var(--purple); }
  .attn-hero { display:flex; align-items:center; gap:12px; }
  .attn-score { font-size:30px; font-weight:640; letter-spacing:-.04em; color:var(--purple); }
  .logrow { align-items:center; }
  /* Timeline / Gantt */
  .gantt { max-width:820px; }
  .gwrap { margin-top:10px; border:1px solid var(--line); border-radius:12px; padding:6px 10px 10px; overflow-x:auto; }
  .glane { display:grid; grid-template-columns:112px 1fr; align-items:center; gap:10px; min-height:26px; }
  .glane + .glane { border-top:1px solid color-mix(in srgb,var(--line) 55%,transparent); }
  .glabel { overflow:hidden; font-size:11.5px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; color:var(--ink); }
  .glabel.muted { color:var(--muted); font-weight:700; font-size:10px; letter-spacing:.06em; text-transform:uppercase; }
  .gtrack { position:relative; height:24px; }
  .ghead { min-height:18px; } .ghead .gtrack { height:16px; }
  .gmonths .gtick { position:absolute; top:0; font-size:9.5px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); transform:translateX(1px); border-left:1px solid color-mix(in srgb,var(--line) 60%,transparent); padding-left:3px; }
  .gtoday { position:absolute; top:-2px; bottom:-2px; width:2px; background:color-mix(in srgb,var(--red) 55%,transparent); z-index:1; }
  .gphase { position:absolute; top:4px; height:16px; border:1px solid var(--line); border-radius:6px; background:var(--subtle); display:flex; align-items:center; overflow:hidden; }
  .gphase span { padding:0 6px; font-size:10px; font-weight:650; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .gbar { position:absolute; top:5px; height:15px; border-radius:5px; background:var(--subtle); overflow:hidden; display:flex; align-items:center; box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink) 8%,transparent); }
  .gbar > i { position:absolute; left:0; top:0; bottom:0; background:color-mix(in srgb,var(--purple) 28%,transparent); }
  .gbar > span { position:relative; padding:0 6px; font-size:10px; font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .gbar.gs-in_progress { background:var(--purple-bg); } .gbar.gs-in_progress > i { background:color-mix(in srgb,var(--purple) 34%,transparent); }
  .gbar.gs-blocked { background:color-mix(in srgb,var(--red) 16%,transparent); }
  .gbar.gs-done { background:color-mix(in srgb,var(--jade) 18%,transparent); } .gbar.gs-done > i { background:color-mix(in srgb,var(--jade) 30%,transparent); }
  .gtrack-ms { height:18px; }
  .gdia { position:absolute; top:3px; width:11px; height:11px; margin-left:-5px; transform:rotate(45deg); border-radius:2px; background:var(--purple); box-shadow:0 0 0 2px var(--card-bg); }
  .gdia.gs-completed { background:var(--jade); } .gdia.gs-missed { background:var(--red); }
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
