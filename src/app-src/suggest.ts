/**
 * Ask Lane suggested-dependencies review. Rendered for lane_suggest_dependencies:
 * the model proposes predecessor→successor edges; this resolves activity titles
 * from context, drops self-referential / already-linked edges, and lets the user
 * uncheck any before applying the rest in one shot via dependency.bulkCreate
 * (lane_apply_action). Read-only until the user hits Connect.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;
type Row = Record<string, unknown>;
type Ctx = { activities?: Row[]; dependencies?: Row[] };
type Edge = { predecessorId: string; successorId: string; lagDays: number };
type Candidate = { key: string; label: string; edge: Edge };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const app = new App({ name: "Lane Suggested Dependencies", version: "0.1.0" });
wireTheme(app);

let projectId = "";
let proposed: Edge[] = [];
let ctx: Ctx = {};
let candidates: Candidate[] = [];
let checked = new Set<string>();
let applying = false;
let done = false;

app.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
  const a = params?.arguments ?? {};
  if (typeof a.projectId === "string") projectId = a.projectId;
  if (Array.isArray(a.edges)) {
    proposed = (a.edges as Row[]).map((e) => ({
      predecessorId: str(e.predecessorId),
      successorId: str(e.successorId),
      lagDays: typeof e.lagDays === "number" ? e.lagDays : 0,
    })).filter((e) => e.predecessorId && e.successorId);
  }
};

function build(): void {
  const acts = ctx.activities ?? [];
  const titleById = new Map<string, string>();
  for (const a of acts) titleById.set(str(a.id), str(a.title) || "Activity");
  const existing = new Set<string>();
  for (const d of ctx.dependencies ?? []) existing.add(`${str(d.predecessor_id)}→${str(d.successor_id)}`);
  const seen = new Set<string>();
  candidates = [];
  for (const e of proposed) {
    const key = `${e.predecessorId}→${e.successorId}`;
    if (e.predecessorId === e.successorId || seen.has(key) || existing.has(key)) continue;
    const p = titleById.get(e.predecessorId);
    const s = titleById.get(e.successorId);
    if (!p || !s) continue; // points at an activity not in this project
    seen.add(key);
    const lag = e.lagDays;
    const lagNote = lag > 0 ? ` (+${lag}d)` : lag < 0 ? ` (${lag}d)` : "";
    candidates.push({ key, label: `${p} → ${s}${lagNote}`, edge: e });
  }
  checked = new Set(candidates.map((c) => c.key));
}

function render(): void {
  if (done) return;
  if (!ctx.activities) {
    root.innerHTML = `<div class="card">${badge("Lane")}<p class="muted" style="padding:6px 0">Loading…</p></div>`;
    return;
  }
  if (candidates.length === 0) {
    root.innerHTML = `<div class="card">${badge("Lane")}<h2 style="margin:6px 0 0;font-size:16px">Nothing to connect</h2><p class="muted">These activities are already linked, self-referential, or outside this project.</p></div>`;
    return;
  }
  const rows = candidates.map((c) => `<label class="srow"><input type="checkbox" data-key="${esc(c.key)}" ${checked.has(c.key) ? "checked" : ""}/><span>${esc(c.label)}</span></label>`).join("");
  root.innerHTML = `<div class="card">
    <header class="sh">${badge("Lane")}<h2>Suggested dependencies (${candidates.length})</h2></header>
    <p class="muted shint">Uncheck any you don't want. Each reads predecessor → successor.</p>
    <div class="slist">${rows}</div>
    <div id="smsg"></div>
    <footer class="sfoot"><button class="btn" id="scancel" type="button">Cancel</button><button class="btn btn-primary" id="sapply" type="button">Connect ${checked.size}</button></footer>
  </div>`;
  wire();
}

function wire(): void {
  root.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-key]').forEach((box) => {
    box.addEventListener("change", () => {
      const key = box.getAttribute("data-key") || "";
      if (box.checked) checked.add(key); else checked.delete(key);
      const btn = document.getElementById("sapply");
      if (btn) { btn.textContent = `Connect ${checked.size}`; (btn as HTMLButtonElement).disabled = checked.size === 0; }
    });
  });
  document.getElementById("scancel")?.addEventListener("click", () => {
    done = true;
    root.innerHTML = `<div class="card">${badge("Lane")}<p class="muted" style="padding:6px 0">No dependencies were created.</p></div>`;
  });
  document.getElementById("sapply")?.addEventListener("click", () => void apply());
}

async function apply(): Promise<void> {
  if (applying || checked.size === 0) return;
  applying = true;
  const btn = document.getElementById("sapply") as HTMLButtonElement | null;
  if (btn) { btn.disabled = true; btn.textContent = "Connecting…"; }
  const edges = candidates.filter((c) => checked.has(c.key)).map((c) => c.edge);
  try {
    const result = await app.callServerTool({
      name: "lane_apply_action",
      arguments: { action: { action: "dependency.bulkCreate", projectId, edges }, preview: false },
    });
    const structured = (result as { structuredContent?: { applied?: boolean; message?: string } }).structuredContent;
    done = true;
    const ok = Boolean(structured?.applied);
    root.innerHTML = `<div class="card">${badge("Lane")}<h2 style="margin:6px 0 0;font-size:16px">${ok ? "Connected ✓" : "Not applied"}</h2><p class="muted">${esc(structured?.message ?? (ok ? "Dependencies created." : "Nothing was applied."))}</p></div>`;
  } catch {
    applying = false;
    const msg = document.getElementById("smsg");
    if (msg) msg.innerHTML = `<p class="muted" style="color:var(--red);margin:8px 0 0">Couldn't reach Lane to apply. Try again.</p>`;
    if (btn) { btn.disabled = false; btn.textContent = `Connect ${checked.size}`; }
  }
}

const style = document.createElement("style");
style.textContent = `
  .sh { display:flex; align-items:baseline; gap:8px; }
  .sh h2 { margin:0; font-size:16px; letter-spacing:-.02em; }
  .shint { margin:4px 0 10px; font-size:12px; }
  .slist { display:grid; gap:2px; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .srow { display:flex; align-items:center; gap:10px; padding:10px 12px; font-size:13.5px; cursor:pointer; }
  .srow + .srow { border-top:1px solid color-mix(in srgb,var(--line) 70%,transparent); }
  .srow:hover { background:var(--subtle); }
  .srow input { width:16px; height:16px; accent-color:var(--purple); }
  .sfoot { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
`;
document.head.appendChild(style);

app.ontoolresult = () => {};
app.onerror = (error: unknown) => console.error("[lane-suggest]", error);

app
  .connect()
  .then(async () => {
    applyInitialTheme(app);
    try {
      const result = await app.callServerTool({ name: "lane_get_context", arguments: projectId ? { projectId } : {} });
      const sc = (result as { structuredContent?: Ctx }).structuredContent;
      ctx = sc && typeof sc === "object" ? sc : {};
      build();
      render();
    } catch (error) {
      console.error("[lane-suggest] context load failed", error);
      root.innerHTML = `<div class="card">${badge("Lane")}<p class="muted" style="padding:6px 0">Couldn't load the plan to review dependencies.</p></div>`;
    }
  })
  .catch((error) => console.error("[lane-suggest] connect failed", error));

render();
