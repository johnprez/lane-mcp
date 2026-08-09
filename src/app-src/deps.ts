/**
 * Ask Lane dependencies card (behind lane_edit_dependencies). Lists the project's
 * activity dependencies (predecessor → successor, with lag), lets the user add a
 * new one (two activity pickers + lag days) or remove one. Each mutation is a
 * lane_apply_action call; context is re-read afterward.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;
const app = new App({ name: "Lane Dependencies", version: "0.1.0" });
wireTheme(app);

type Row = Record<string, unknown>;
type Ctx = { activities?: Row[]; dependencies?: Row[] };
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

let projectId: string | undefined;
let ctx: Ctx = {};
let connected = false;
let started = false;
let busy = false;

const acts = (): Row[] => ctx.activities ?? [];
const deps = (): Row[] => ctx.dependencies ?? [];
const titleOf = (id: string): string => str(acts().find((a) => str(a.id) === id)?.title) || "(unknown)";
const options = (): string => acts().map((a) => `<option value="${esc(str(a.id))}">${esc(str(a.title) || "Activity")}</option>`).join("");

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

function render(): void {
  const rows = deps().map((d) => {
    const p = str(d.predecessor_id);
    const s = str(d.successor_id);
    const lag = num(d.lag_days);
    return `<div class="item"><span class="item-title">${esc(titleOf(p))} → ${esc(titleOf(s))}</span>` +
      `<span class="item-meta">${lag ? `${lag > 0 ? "+" : ""}${lag}d lag` : "no lag"}</span>` +
      `<button class="link-btn" data-del-p="${esc(p)}" data-del-s="${esc(s)}" data-v="${num(d.version)}">Remove</button></div>`;
  }).join("") || '<div class="item"><span class="item-meta">No dependencies yet.</span></div>';
  root.innerHTML =
    `<div class="card wide">${badge("Lane · Dependencies")}<h1>Dependencies</h1>` +
    `<p class="flash" id="flash" style="display:none"></p>` +
    `<div class="list">${rows}</div>` +
    `<h2>Add a dependency</h2>` +
    `<div class="field"><label class="flabel" for="pre">Predecessor (finishes first)</label><select id="pre">${options()}</select></div>` +
    `<div class="field"><label class="flabel" for="suc">Successor (starts after)</label><select id="suc">${options()}</select></div>` +
    `<div class="field"><label class="flabel" for="lag">Lag (days)</label><input id="lag" type="number" value="0"></div>` +
    `<div class="actions"><button class="btn btn-primary" id="add">Add dependency</button></div></div>`;
  wire();
}

function wire(): void {
  document.getElementById("add")?.addEventListener("click", guard(async () => {
    const pre = (document.getElementById("pre") as HTMLSelectElement | null)?.value ?? "";
    const suc = (document.getElementById("suc") as HTMLSelectElement | null)?.value ?? "";
    const lag = Number((document.getElementById("lag") as HTMLInputElement | null)?.value) || 0;
    if (!pre || !suc) return flash("Pick both activities.", false);
    if (pre === suc) return flash("Pick two different activities.", false);
    const res = await apply({ action: "dependency.create", projectId, predecessorId: pre, successorId: suc, lagDays: lag });
    if (!res.ok) return flash(res.message, false);
    await reload();
    render();
  }));
  root.querySelectorAll<HTMLButtonElement>("button[data-del-p]").forEach((b) => b.addEventListener("click", guard(async () => {
    const res = await apply({ action: "dependency.delete", projectId, predecessorId: b.dataset.delP, successorId: b.dataset.delS, expectedVersion: num(b.dataset.v) });
    if (!res.ok) return flash(res.message, false);
    await reload();
    render();
  })));
}

async function start(): Promise<void> {
  if (started || !connected || !projectId) return;
  started = true;
  await reload();
  render();
}

root.innerHTML = `<div class="card wide">${badge("Lane · Dependencies")}<h1>Loading…</h1></div>`;

app.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
  const pid = params?.arguments?.projectId;
  if (typeof pid === "string") projectId = pid;
  void start();
};
app.onerror = (error: unknown) => console.error("[lane-deps]", error);

app
  .connect()
  .then(() => {
    applyInitialTheme(app);
    connected = true;
    void start();
    window.setTimeout(() => {
      if (!started) root.innerHTML = `<div class="card wide">${badge("Lane · Dependencies")}<h1>Waiting for details</h1><p>Ask Lane to open dependencies again.</p></div>`;
    }, 2500);
  })
  .catch((error: unknown) => console.error("[lane-deps] connect failed", error));
