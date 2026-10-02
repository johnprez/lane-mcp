/**
 * Ask Lane journey card. Rendered for lane_get_journey, lane_propose_journey_changes
 * and lane_apply_journey_proposal:
 *   - always: the journey grid (stage › step columns × rows, card titles per cell);
 *   - with a proposalId: a review overlay — every pending item with a checkbox,
 *     proposed new cards ghosted into their cells, and Accept / Reject.
 * Accept calls lane_apply_journey_proposal (preview:false, checked itemIds) back
 * through the host. Reject changes nothing (the proposal simply expires). The
 * card never re-runs a write on its own: it only re-reads (lane_get_journey) and
 * previews (lane_apply_journey_proposal preview:true) to fill itself in.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

type Row = Record<string, unknown>;
type Journey = {
  journey: { id: string; title: string; type: string; status: string; canEdit: boolean };
  stages: Array<{ id: string; name: string; steps: Array<{ id: string; name: string }> }>;
  rows: Array<{ id: string; name: string; rowType: string }>;
  cards: Array<{ id: string; ref: string; title: string; rowId: string; stepId: string; emotion: number | null }>;
};
type Item = { id: string; op: string; targetId: string; payload: Row; rationale: string; status: string };
type Proposal = { proposalId: string; itemsHash: string; title: string; summary: string; status: string; items: Item[] };

const root = document.getElementById("root")!;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const app = new App({ name: "Lane Journey", version: "0.1.0" });
wireTheme(app);

let journeyId = "";
let proposalId = "";
let journey: Journey | null = null;
let proposal: Proposal | null = null;
let draft: Item[] = []; // propose preview: validated items that were NOT stored
let checked = new Set<string>();
let busy = false;
let banner: { tone: "ok" | "err" | ""; text: string } | null = null;
let decided = false; // Accepted or rejected in this card
let loadError = "";

function isJourney(value: unknown): boolean {
  const v = value as Journey | null;
  return Boolean(v && typeof v === "object" && v.journey && Array.isArray(v.stages) && Array.isArray(v.rows) && Array.isArray(v.cards));
}

function toItems(value: unknown): Item[] {
  if (!Array.isArray(value)) return [];
  return (value as Row[]).map((raw, index) => ({
    id: str(raw.id) || `draft-${index}`,
    op: str(raw.op),
    targetId: str(raw.targetId) || str((raw.payload as Row | undefined)?.targetId),
    payload: (raw.payload && typeof raw.payload === "object" ? raw.payload : {}) as Row,
    rationale: str(raw.rationale),
    status: str(raw.status) || "pending",
  }));
}

function setProposal(sc: Row): void {
  proposal = {
    proposalId: str(sc.proposalId), itemsHash: str(sc.itemsHash), title: str(sc.title) || "Proposed changes", summary: str(sc.summary),
    status: str(sc.status) || "pending", items: toItems(sc.items),
  };
  checked = new Set(proposal.items.filter((i) => i.status === "pending").map((i) => i.id));
}

// ── Inputs ──────────────────────────────────────────────────────────────────
app.ontoolinput = (params: { arguments?: Row }) => {
  const a = params?.arguments ?? {};
  if (str(a.journeyId)) journeyId = str(a.journeyId);
  if (str(a.proposalId)) proposalId = str(a.proposalId);
};

app.ontoolresult = (result: unknown) => {
  const r = result as { structuredContent?: Row; isError?: boolean; content?: Array<{ text?: string }> };
  const sc = r.structuredContent;
  if (r.isError || !sc) {
    loadError = str(sc?.error) || str(r.content?.[0]?.text) || "Lane couldn't complete that request.";
    render();
    return;
  }
  if (isJourney(sc)) { journey = sc as unknown as Journey; journeyId = journey.journey.id; }
  if (str(sc.journeyId)) journeyId = str(sc.journeyId);
  if (str(sc.proposalId)) proposalId = str(sc.proposalId);
  if (sc.kind === "propose" && sc.preview) draft = toItems(sc.draftItems);
  if (sc.kind === "apply" && sc.preview) setProposal(sc);
  if (sc.kind === "apply" && sc.applied) {
    decided = true;
    banner = { tone: "ok", text: str(sc.message) || "Applied." };
  }
  void load();
};

// ── Data ────────────────────────────────────────────────────────────────────
async function call(name: string, args: Row): Promise<{ sc: Row | null; error: string }> {
  try {
    const result = (await app.callServerTool({ name, arguments: args })) as { structuredContent?: Row; isError?: boolean; content?: Array<{ text?: string }> };
    if (result.isError) return { sc: null, error: str(result.structuredContent?.error) || str(result.content?.[0]?.text) || "Lane rejected that request." };
    return { sc: result.structuredContent ?? null, error: "" };
  } catch {
    return { sc: null, error: "Couldn't reach Lane." };
  }
}

let inflight: Promise<void> | null = null;
function load(): Promise<void> {
  // Result + connect can both ask; run one fill-in at a time, then re-check.
  inflight = (inflight ?? Promise.resolve()).then(fill);
  return inflight;
}

async function fill(): Promise<void> {
  if (proposalId && !proposal) {
    const { sc, error } = await call("lane_apply_journey_proposal", { proposalId, preview: true });
    if (sc) { setProposal(sc); if (str(sc.journeyId)) journeyId = str(sc.journeyId); } else loadError = error;
  }
  if (journeyId && !journey) {
    const { sc, error } = await call("lane_get_journey", { journeyId });
    if (isJourney(sc)) journey = sc as unknown as Journey; else loadError = loadError || error;
  }
  render();
}

// ── Rendering ───────────────────────────────────────────────────────────────
function itemTitle(item: Item): string {
  const p = item.payload;
  return str(p.title) || str(p.name) || (item.op.startsWith("card.") ? cardTitle(item.targetId) : "") || item.op;
}

function cardTitle(id: string): string {
  return journey?.cards.find((c) => c.id === id)?.title ?? "";
}

function placement(item: Item): string {
  const p = item.payload;
  const stepName = journey?.stages.flatMap((s) => s.steps).find((s) => s.id === str(p.stepId))?.name;
  const rowName = journey?.rows.find((r) => r.id === str(p.rowId))?.name;
  const where = [rowName ?? (str(p.rowRef) ? `new row ${str(p.rowRef)}` : ""), stepName ?? (str(p.stepRef) ? `new step ${str(p.stepRef)}` : "")].filter(Boolean);
  return where.length ? ` · ${where.join(" × ")}` : "";
}

const OP_LABEL: Record<string, string> = {
  "stage.create": "New stage", "step.create": "New step", "row.create": "New row", "card.create": "New card",
  "card.update": "Edit card", "card.move": "Move card", "card.delete": "Remove card", "block.create": "New block",
  "block.link": "Link block", "work.link": "Link work",
};

function grid(ghosts: Item[]): string {
  if (!journey) return `<p class="muted" style="padding:8px 0">${loadError ? esc(loadError) : "Loading the journey…"}</p>`;
  const steps = journey.stages.flatMap((stage) => stage.steps.map((step) => ({ ...step, stage: stage.name })));
  if (!steps.length || !journey.rows.length) return `<p class="muted" style="padding:8px 0">This journey has no ${steps.length ? "rows" : "steps"} yet.</p>`;
  const stageHead = journey.stages.filter((s) => s.steps.length).map((s) => `<th scope="colgroup" colspan="${s.steps.length}" class="jstage">${esc(s.name)}</th>`).join("");
  const stepHead = steps.map((s) => `<th scope="col" class="jstep">${esc(s.name)}</th>`).join("");
  const changing = new Set(proposal ? proposal.items.filter((i) => i.status === "pending" && checked.has(i.id)).map((i) => i.targetId) : []);
  const body = journey.rows.map((row) => {
    const cells = steps.map((step) => {
      const cards = journey!.cards.filter((c) => c.rowId === row.id && c.stepId === step.id)
        .map((c) => `<div class="jc${changing.has(c.id) ? " jc-chg" : ""}" title="${esc(c.ref)}">${esc(c.title)}</div>`).join("");
      const ghost = ghosts.filter((g) => str(g.payload.rowId) === row.id && str(g.payload.stepId) === step.id)
        .map((g) => `<div class="jc jc-new">+ ${esc(str(g.payload.title))}</div>`).join("");
      return `<td>${cards}${ghost}</td>`;
    }).join("");
    return `<tr><th scope="row" class="jrow">${esc(row.name)}<span>${esc(row.rowType)}</span></th>${cells}</tr>`;
  }).join("");
  return `<div class="jwrap" tabindex="0" role="region" aria-label="Journey grid"><table class="jgrid"><thead><tr><td></td>${stageHead}</tr><tr><td></td>${stepHead}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function overlay(): string {
  if (draft.length && !proposal) {
    const list = draft.map((i) => `<li><b>${esc(OP_LABEL[i.op] ?? i.op)}</b> ${esc(itemTitle(i))}${esc(placement(i))}</li>`).join("");
    return `<section class="jprop" aria-label="Draft proposal"><h2>Draft — validated, not stored</h2><ul class="jdraft">${list}</ul></section>`;
  }
  if (!proposal) return "";
  const pending = proposal.items.filter((i) => i.status === "pending");
  const rows = proposal.items.map((i) => {
    const open = i.status === "pending" && !decided;
    return `<label class="jitem${open ? "" : " jitem-done"}"><input type="checkbox" data-id="${esc(i.id)}" ${checked.has(i.id) && open ? "checked" : ""} ${open ? "" : "disabled"}/>
      <span><b>${esc(OP_LABEL[i.op] ?? i.op)}</b> ${esc(itemTitle(i))}${esc(placement(i))}${i.rationale ? `<em>${esc(i.rationale)}</em>` : ""}</span>
      ${open ? "" : `<span class="jst">${esc(i.status)}</span>`}</label>`;
  }).join("");
  const actionable = pending.length > 0 && !decided && proposal.status === "pending";
  const foot = actionable
    ? `<footer class="jfoot"><button class="btn" id="jreject" type="button" ${busy ? "disabled" : ""}>Reject</button><button class="btn btn-primary" id="jaccept" type="button" ${busy || checked.size === 0 ? "disabled" : ""}>${busy ? "Applying…" : `Accept ${checked.size}`}</button></footer>`
    : "";
  return `<section class="jprop" aria-label="Proposal review">
    <h2>${esc(proposal.title)} · ${pending.length} pending</h2>
    ${proposal.summary ? `<p class="muted jsum">${esc(proposal.summary)}</p>` : ""}
    <div class="jlist">${rows}</div>${foot}</section>`;
}

function render(): void {
  const ghosts = proposal
    ? proposal.items.filter((i) => i.op === "card.create" && i.status === "pending" && checked.has(i.id) && !decided)
    : draft.filter((i) => i.op === "card.create");
  const title = journey ? esc(journey.journey.title) : "Journey";
  const meta = journey ? `${esc(journey.journey.type)} · ${esc(journey.journey.status)}${journey.journey.canEdit ? "" : " · view only"}` : "";
  const note = banner ? `<p class="flash ${banner.tone}" role="status">${esc(banner.text)}</p>` : loadError && journey ? `<p class="flash err" role="status">${esc(loadError)}</p>` : "";
  root.innerHTML = `<div class="card wide">
    <div class="head">${badge("Lane · Journey")}</div>
    <h1>${title}</h1>${meta ? `<p>${meta}</p>` : ""}
    ${note}${overlay()}${grid(ghosts)}</div>`;
  wire();
}

function wire(): void {
  root.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-id]').forEach((box) => {
    box.addEventListener("change", () => {
      const id = box.getAttribute("data-id") || "";
      if (box.checked) checked.add(id); else checked.delete(id);
      render();
    });
  });
  document.getElementById("jreject")?.addEventListener("click", () => {
    decided = true;
    banner = { tone: "", text: "Rejected — nothing was applied. The proposal stays unapplied until it expires." };
    render();
  });
  document.getElementById("jaccept")?.addEventListener("click", () => void accept());
}

async function accept(): Promise<void> {
  if (busy || !proposal || checked.size === 0) return;
  busy = true;
  render();
  const pending = proposal.items.filter((i) => i.status === "pending");
  const all = pending.every((i) => checked.has(i.id));
  const { sc, error } = await call("lane_apply_journey_proposal", {
    proposalId: proposal.proposalId, itemsHash: proposal.itemsHash, preview: false, ...(all ? {} : { itemIds: [...checked] }),
  });
  busy = false;
  if (sc?.applied) {
    decided = true;
    banner = { tone: "ok", text: str(sc.message) || "Applied." };
    // Re-read so the grid shows what actually landed.
    journey = null;
    proposal = null;
    await load();
    return;
  }
  banner = { tone: "err", text: error || "Nothing was applied." };
  render();
}

const style = document.createElement("style");
style.textContent = `
  .card.wide { max-width:760px; }
  .jwrap { margin-top:12px; overflow:auto; border:1px solid var(--line); border-radius:12px; max-height:460px; }
  .jwrap:focus { outline:2px solid var(--purple); outline-offset:2px; }
  .jgrid { border-collapse:separate; border-spacing:0; font-size:12px; min-width:100%; }
  .jgrid th, .jgrid td { vertical-align:top; padding:6px; border-bottom:1px solid var(--line); border-right:1px solid color-mix(in srgb,var(--line) 70%,transparent); }
  .jgrid thead th { position:sticky; background:var(--card-bg); z-index:1; text-align:left; }
  .jgrid thead tr:first-child th { top:0; }
  .jgrid thead tr:nth-child(2) th { top:27px; }
  .jstage { font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--purple); }
  .jstep { font-weight:650; color:var(--ink); min-width:130px; }
  .jrow { position:sticky; left:0; background:var(--subtle); text-align:left; font-weight:650; min-width:110px; z-index:1; }
  .jrow span { display:block; font-size:10px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
  .jc { padding:5px 7px; margin-bottom:4px; border:1px solid var(--line); border-radius:7px; background:var(--card-bg); line-height:1.35; }
  .jc-new { border-style:dashed; border-color:var(--purple); color:var(--purple); background:var(--purple-bg); }
  .jc-chg { border-color:var(--amber); box-shadow:0 0 0 1px color-mix(in srgb,var(--amber) 40%,transparent); }
  .jprop { margin-top:12px; padding:10px 12px; border:1px solid color-mix(in srgb,var(--purple) 35%,var(--line)); border-radius:12px; background:var(--subtle); }
  .jprop h2 { margin:0 0 6px; }
  .jsum { margin-bottom:8px; }
  .jlist { display:grid; gap:2px; max-height:240px; overflow:auto; }
  .jitem { display:flex; align-items:flex-start; gap:9px; padding:7px 6px; font-size:12.5px; cursor:pointer; border-radius:8px; }
  .jitem:hover { background:var(--card-bg); }
  .jitem input { width:16px; height:16px; margin-top:1px; accent-color:var(--purple); flex:none; }
  .jitem em { display:block; font-style:normal; color:var(--muted); font-size:11.5px; }
  .jitem-done { opacity:.6; cursor:default; }
  .jst { margin-left:auto; flex:none; font-size:10px; font-weight:700; text-transform:uppercase; color:var(--muted); }
  .jdraft { margin:0; padding-left:18px; font-size:12.5px; display:grid; gap:3px; }
  .jfoot { display:flex; justify-content:flex-end; gap:8px; margin-top:10px; }
`;
document.head.appendChild(style);

app.onerror = (error: unknown) => console.error("[lane-journey]", error);

render();
app
  .connect()
  .then(() => {
    applyInitialTheme(app);
    // The host doesn't always replay the triggering result to a fresh iframe;
    // fill in from the captured input (reads/previews only — never a write).
    void load();
  })
  .catch((error: unknown) => console.error("[lane-journey] connect failed", error));
